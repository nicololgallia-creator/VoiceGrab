const fs = require("fs");
const os = require("os");
const path = require("path");
const debugLogger = require("./debugLogger");
const onnxWorkerClient = require("./onnxWorkerClient");

const MODEL_SUBDIR = "all-MiniLM-L6-v2";

class LocalEmbeddings {
  constructor() {
    this.loadPromise = null;
    this.loadedGeneration = null;
    this.operationQueue = Promise.resolve();
    this.modelDir = this._resolveModelDir();
  }

  _resolveModelDir() {
    const cacheDir = path.join(
      os.homedir(),
      ".cache",
      "openwhispr",
      "embedding-models",
      MODEL_SUBDIR
    );

    if (process.resourcesPath) {
      const bundled = path.join(process.resourcesPath, "bin", MODEL_SUBDIR);
      if (
        fs.existsSync(path.join(bundled, "model.onnx")) &&
        fs.existsSync(path.join(bundled, "tokenizer.json"))
      ) {
        return bundled;
      }
    }

    const projectBin = path.resolve(__dirname, "..", "..", "resources", "bin", MODEL_SUBDIR);
    if (
      fs.existsSync(path.join(projectBin, "model.onnx")) &&
      fs.existsSync(path.join(projectBin, "tokenizer.json"))
    ) {
      return projectBin;
    }

    return cacheDir;
  }

  isAvailable() {
    return (
      fs.existsSync(path.join(this.modelDir, "model.onnx")) &&
      fs.existsSync(path.join(this.modelDir, "tokenizer.json"))
    );
  }

  _ensureLoaded() {
    if (this.loadPromise && this.loadedGeneration === onnxWorkerClient.generation) {
      return this.loadPromise;
    }
    if (!this.isAvailable()) {
      return Promise.reject(
        new Error("Embedding model not found. Run: node scripts/download-minilm.js")
      );
    }
    debugLogger.debug("local-embeddings loading model", { modelDir: this.modelDir });
    this.loadedGeneration = onnxWorkerClient.generation;
    this.loadPromise = onnxWorkerClient
      .request("text.load", { modelDir: this.modelDir })
      .then(() => debugLogger.debug("local-embeddings model loaded"))
      .catch((err) => {
        this.loadPromise = null;
        throw err;
      });
    return this.loadPromise;
  }

  _enqueue(operation) {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.catch(() => {});
    return result;
  }

  async _embedText(text) {
    await this._ensureLoaded();
    const { embeddingBuffer } = await onnxWorkerClient.request("text.embed", { text });
    return new Float32Array(embeddingBuffer);
  }

  embedText(text) {
    return this._enqueue(() => this._embedText(text));
  }

  embedTexts(texts) {
    return this._enqueue(async () => {
      const results = [];
      for (const text of texts) {
        results.push(await this._embedText(text));
      }
      return results;
    });
  }

  unload() {
    return this._enqueue(async () => {
      try {
        await onnxWorkerClient.request("text.unload", {});
      } finally {
        this.loadPromise = null;
        this.loadedGeneration = null;
        await onnxWorkerClient.releaseIfIdle();
      }
    });
  }

  static noteEmbedText(title, content, enhancedContent) {
    return `${title}\n${enhancedContent || content}`.slice(0, 1500);
  }

  async downloadModel() {
    if (this.isAvailable()) return;

    const { downloadFile } = require("./downloadUtils");
    // Same commit and hashes as scripts/download-minilm.js.
    const commit = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41";
    const base = `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/${commit}`;
    const files = [
      {
        name: "model.onnx",
        url: `${base}/onnx/model.onnx`,
        sha256: "6fd5d72fe4589f189f8ebc006442dbb529bb7ce38f8082112682524616046452",
      },
      {
        name: "tokenizer.json",
        url: `${base}/tokenizer.json`,
        sha256: "be50c3628f2bf5bb5e3a7f17b1f74611b2561a3a27eeab05e5aa30f411572037",
      },
    ];

    fs.mkdirSync(this.modelDir, { recursive: true });

    for (const file of files) {
      const dest = path.join(this.modelDir, file.name);
      if (fs.existsSync(dest)) continue;
      debugLogger.debug("local-embeddings downloading", { file: file.name });
      await downloadFile(file.url, dest, { expectedSha256: file.sha256 });
    }

    debugLogger.info("local-embeddings model downloaded", { modelDir: this.modelDir });
  }
}

const instance = new LocalEmbeddings();
module.exports = instance;
module.exports.LocalEmbeddings = LocalEmbeddings;
