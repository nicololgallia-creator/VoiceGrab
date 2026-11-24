/**
 * Compiles one Windows helper from its C source in resources/. No downloads: if no
 * compiler works the build fails, so a helper never comes from a binary we did not build.
 *
 * MSVC needs its environment: run from "x64 Native Tools Command Prompt for VS 2022",
 * or call vcvars64.bat first. MinGW-w64 gcc and clang also work.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");

function canRun(command, args) {
  const result = spawnSync(command, args, { stdio: "pipe", shell: true });
  return !result.error && result.status !== null;
}

/**
 * @param {string} name  helper name, as in resources/<name>.c and resources/bin/<name>.exe
 * @param {string[]} libs  Windows libraries without extension, e.g. ["user32"]
 */
function compileWindowsHelper(name, libs) {
  if (process.platform !== "win32") return;

  const log = (message) => console.log(`[${name}] ${message}`);
  const source = path.join(projectRoot, "resources", `${name}.c`);
  const outputDir = path.join(projectRoot, "resources", "bin");
  const output = path.join(outputDir, `${name}.exe`);

  if (!fs.existsSync(source)) throw new Error(`[${name}] C source not found: ${source}`);
  fs.mkdirSync(outputDir, { recursive: true });

  if (fs.existsSync(output) && fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs) {
    log("Binary is up to date, skipping build");
    return;
  }

  const objectDir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-obj-`));
  const compilers = [
    {
      name: "MSVC",
      available: () => canRun("cl", []),
      command: "cl",
      args: [
        "/O2",
        "/nologo",
        source,
        `/Fe:${output}`,
        `/Fo:${objectDir}${path.sep}`,
        ...libs.map((lib) => `${lib}.lib`),
        "uuid.lib",
      ],
    },
    {
      name: "MinGW-w64",
      available: () => canRun("gcc", ["--version"]),
      command: "gcc",
      args: ["-O2", source, "-o", output, ...libs.map((lib) => `-l${lib}`), "-luuid"],
    },
    {
      name: "Clang",
      available: () => canRun("clang", ["--version"]),
      command: "clang",
      args: ["-O2", source, "-o", output, ...libs.map((lib) => `-l${lib}`), "-luuid"],
    },
  ];

  try {
    for (const compiler of compilers) {
      if (!compiler.available()) {
        log(`${compiler.name} not found, trying next...`);
        continue;
      }
      log(`Compiling with ${compiler.name}`);
      const result = spawnSync(compiler.command, compiler.args, {
        stdio: "inherit",
        cwd: objectDir,
        shell: false,
      });
      if (result.status === 0 && fs.existsSync(output)) {
        log(`Built ${output}`);
        return;
      }
      log(`${compiler.name} compilation failed, trying next...`);
    }
  } finally {
    fs.rmSync(objectDir, { recursive: true, force: true });
  }

  throw new Error(
    `[${name}] No compiler could build ${source}. Install Visual Studio Build Tools and run from ` +
      `"x64 Native Tools Command Prompt for VS 2022", or install MinGW-w64.`
  );
}

module.exports = { compileWindowsHelper };
