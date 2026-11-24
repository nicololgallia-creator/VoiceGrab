const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const debugLogger = require("./debugLogger");
const { killProcess } = require("../utils/process");

// spawnSync capped a child's output at 1 MB and killed anything past it. Keep
// that bound: these helpers emit a few KB, and an unbounded buffer would let a
// runaway one grow main-process memory until its deadline.
const MAX_OUTPUT_BYTES = 1024 * 1024;

// Runs `cmd args` asynchronously and resolves with
// { status, stdout, stderr, timedOut }. Times out after `timeout` ms; on
// timeout it kills the child and resolves with the exit code the child already
// reported, or status: null and timedOut: true when it never exited. A spawn
// failure also resolves with status: null but timedOut: false. Output is
// capped at MAX_OUTPUT_BYTES. Never rejects — callers branch on status === 0.
//
// Every media helper goes through here rather than spawnSync: a synchronous
// spawn parks the Electron main thread in a nested libuv loop until the
// child's stdio pipes close, which froze hotkeys, IPC and the dictation
// window mid-recording (#2073).
function spawnAsync(cmd, args, { timeout = 3000 } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch (err) {
      resolve({ status: null, stdout: "", stderr: String(err?.message || err), timedOut: false });
      return;
    }

    const chunks = { stdout: [], stderr: [] };
    let bufferedBytes = 0;
    const collect = (stream, chunk) => {
      if (bufferedBytes >= MAX_OUTPUT_BYTES) return;
      bufferedBytes += chunk.length;
      chunks[stream].push(chunk);
    };
    let settled = false;
    const settle = (status, timedOut = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        status,
        stdout: Buffer.concat(chunks.stdout).toString("utf8"),
        stderr: Buffer.concat(chunks.stderr).toString("utf8"),
        timedOut,
      });
    };

    const timer = setTimeout(() => {
      // A helper can finish its work and exit while a descendant it spawned
      // keeps the inherited pipes open, so the deadline can arrive with the
      // outcome already known. Honour that exit code: discarding it sends the
      // Windows pause into the media-key fallback, which toggles playback back
      // on mid-dictation and then leaves it paused afterwards (#2073).
      const exitCode = child.exitCode;
      try {
        // A no-op once the child has exited; dropping our own pipe ends is
        // what lets the deadline resolve while a descendant lingers.
        killProcess(child, "SIGKILL");
        child.stdout.destroy();
        child.stderr.destroy();
        debugLogger.warn(
          "Media helper timed out",
          { cmd: path.basename(cmd), timeout, exitCode },
          "media"
        );
      } catch {
        // Teardown and logging are best effort; the deadline must still settle
        // below, or the serialized queue stalls for the rest of the session.
      }
      settle(exitCode, exitCode === null);
    }, timeout);

    child.stdout.on("data", (d) => collect("stdout", d));
    child.stderr.on("data", (d) => collect("stderr", d));
    child.on("error", (err) => {
      // Pushed past the cap on purpose: this is the only diagnostic a failed
      // spawn produces, and it must not be the thing the cap drops.
      chunks.stderr.push(Buffer.from(String(err?.message || err)));
      settle(null);
    });
    child.on("close", (code) => settle(code));
  });
}

class MediaPlayer {
  constructor() {
    this._linuxBinaryChecked = false;
    this._linuxBinaryPath = null;
    this._macBinaryChecked = false;
    this._macBinaryPath = null;
    this._pausedPlayers = []; // MPRIS players we paused (Linux)
    this._didPause = false; // Whether we sent a pause via toggle fallback
    this._pausedWinApps = []; // GSMTC app IDs we paused (Windows)
    this._adapterChecked = false;
    this._adapterPaths = null; // { perl, script, framework } once resolved
    this._pausedViaAdapter = false; // macOS: whether we paused via the adapter
    // Pause/resume/toggle run one at a time. macOS was already async and had
    // the race this prevents: a quick tap could run the resume before the
    // pause had recorded what it paused, stranding media until the next
    // dictation ended. Windows and Linux inherited the risk by becoming async
    // too (#2073).
    this._queue = Promise.resolve();
  }

  // The queue holds a caught copy so a failed operation can't stall the ones
  // behind it, while the caller still gets the raw run.
  _serialize(operation) {
    const run = this._queue.then(operation);
    this._queue = run.catch(() => {});
    return run;
  }

  _resolveLinuxFastPaste() {
    if (this._linuxBinaryChecked) return this._linuxBinaryPath;
    this._linuxBinaryChecked = true;

    const candidates = [
      path.join(__dirname, "..", "..", "resources", "bin", "linux-fast-paste"),
      path.join(__dirname, "..", "..", "resources", "linux-fast-paste"),
    ];

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "bin", "linux-fast-paste"));
    }

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          fs.accessSync(candidate, fs.constants.X_OK);
          this._linuxBinaryPath = candidate;
          return candidate;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async _sendWindowsMediaKey() {
    const result = await spawnAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class KB { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo); }'; [KB]::keybd_event(0xB3, 0, 1, 0); [KB]::keybd_event(0xB3, 0, 3, 0)",
      ],
      { timeout: 5000 }
    );
    return result.status === 0;
  }

  async _pauseWindows() {
    this._pausedWinApps = [];
    this._didPause = false;

    // GSMTC (Windows 10 1809+) — state-aware, targets specific apps
    const result = await spawnAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", this._gsmtcPauseScript()],
      { timeout: 5000 }
    );

    if (result.status === 0) {
      const output = result.stdout.trim();
      if (output === "GSMTC_FAIL") {
        debugLogger.debug("GSMTC unavailable, falling back to media key", {}, "media");
        return this._pauseWindowsFallback();
      }
      this._pausedWinApps = output.split("|").filter(Boolean);
      if (this._pausedWinApps.length > 0) {
        debugLogger.debug("Media paused via GSMTC", { apps: this._pausedWinApps }, "media");
        return true;
      }
      debugLogger.debug("GSMTC found no playing sessions", {}, "media");
      return false;
    }

    const stderr = result.stderr.trim();
    debugLogger.debug(
      "GSMTC PowerShell failed, falling back to media key",
      {
        status: result.status,
        timedOut: result.timedOut,
        stderr: stderr ? stderr.slice(0, 200) : undefined,
      },
      "media"
    );
    return this._pauseWindowsFallback();
  }

  async _pauseWindowsFallback() {
    if (await this._sendWindowsMediaKey()) {
      this._didPause = true;
      debugLogger.debug("Media paused via media key fallback", {}, "media");
      return true;
    }
    return false;
  }

  async _resumeWindows() {
    // Resume via GSMTC if we paused that way
    if (this._pausedWinApps && this._pausedWinApps.length > 0) {
      const apps = this._pausedWinApps;
      this._pausedWinApps = [];

      const result = await spawnAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", this._gsmtcResumeScript(apps)],
        { timeout: 5000 }
      );

      if (result.status === 0) {
        debugLogger.debug("Media resumed via GSMTC", { apps }, "media");
        return true;
      }

      // GSMTC resume failed, fall back to media key
      debugLogger.debug("GSMTC resume failed, falling back to media key", {}, "media");
      return this._sendWindowsMediaKey();
    }

    // Resume via media key toggle if we paused with the fallback
    if (this._didPause) {
      this._didPause = false;
      if (await this._sendWindowsMediaKey()) {
        debugLogger.debug("Media resumed via media key fallback", {}, "media");
        return true;
      }
    }

    return false;
  }

  async _toggleWindows() {
    if (await this._sendWindowsMediaKey()) {
      debugLogger.debug("Media toggled via Windows media key", {}, "media");
      return true;
    }
    return false;
  }
}

module.exports = new MediaPlayer();
