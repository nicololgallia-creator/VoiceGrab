const GpuBinaryManager = require("./gpuBinaryManager");

// Pinned to the same build as the bundled CPU binary (download-llama-server.js).
// Bump together with the digests below (from the GitHub release, 2026-11-24).
const LLAMA_CPP_TAG = "b12110";
const EXPECTED_DIGESTS = {
  "llama-b12110-bin-win-vulkan-x64.zip":
    "9732a5e48887ca54d0bfe4af4324dc85fd56cd8cda19b52df3542fa6ebe6874f",
  "llama-b12110-bin-ubuntu-vulkan-x64.tar.gz":
    "a5d741940956ec62e8783aee7e5a4c7c761af867d6f027c3277a51e1a3ac59b0",
};

const BIN_SUBDIR = "llama-vulkan";

class LlamaVulkanManager extends GpuBinaryManager {
  constructor() {
    super({
      name: "Vulkan llama",
      dirName: BIN_SUBDIR,
      releaseUrl: `https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/${LLAMA_CPP_TAG}`,
      expectedDigests: EXPECTED_DIGESTS,
      assets: {
        "win32-x64": {
          assetPattern: /^llama-.*-bin-win-vulkan-x64\.zip$/,
          binaryName: "llama-server.exe",
          outputName: "llama-server-vulkan.exe",
          libPattern: /\.dll$/i,
        },
        "linux-x64": {
          assetPattern: /^llama-.*-bin-ubuntu-vulkan-x64\.tar\.gz$/,
          binaryName: "llama-server",
          outputName: "llama-server-vulkan",
          libPattern: /\.so(\.\d+)*$/,
        },
      },
    });
  }

  async download(onProgress) {
    try {
      await super.download(onProgress);
      return { success: true };
    } catch (error) {
      if (error.isAbort) return { success: false, cancelled: true };
      throw error;
    }
  }

  async deleteBinary() {
    const { deletedCount } = await this.delete();
    return { success: true, deletedCount };
  }
}

module.exports = LlamaVulkanManager;
module.exports.BIN_SUBDIR = BIN_SUBDIR;
