# Security review

VoiceGrab was forked from OpenWhispr at commit `7970fda` on 2026-11-23 and reviewed before anything was installed or run. This page says what was checked, what was changed, and what is still open. Reviewed by Claude (Anthropic's AI) working for Nicolo Gallia, 2026-11-23 and 24. It is a careful read, not a professional audit.

## Verdict

No sign of malice in OpenWhispr: no `eval` or `new Function`, no obfuscated or minified source, no committed binaries, and every npm package comes from the npm registry with an integrity hash. Its Electron setup is careful. The risks were about who controls what the app pulls in: the update feed, prebuilt helper programs (one is a keyboard hook), unhashed engine and model downloads, and a model catalog signed by OpenWhispr's keys. All are removed or pinned below.

## What was read

| Part | How |
|---|---|
| `main.js`, `preload.js`, window and navigation setup, updater, deep links, local servers, download code, model registry and its trust rules | read |
| The five Windows helpers in `resources/*.c` | read in full; their linked libraries checked with `dumpbin /dependents` (no network or file APIs) |
| `src/helpers/ipcHandlers.js` (about 16,000 lines), `audioManager.js`, `database.js`, the renderer components | targeted greps and the sections they led to, not line by line |
| `package-lock.json` | every entry checked for registry source and integrity hash; install scripts listed; OSV check |
| All tracked files | scanned for `eval`, dynamic code, long lines, base64 blobs, binaries and hard-coded hosts |

Not read: the source of npm dependencies, the macOS and Linux helpers, `native/meeting-aec-helper`.

## What was changed

| Risk in OpenWhispr | Change |
|---|---|
| The updater checked OpenWhispr's GitHub at launch and every 4 hours and would install their build over this one | Updater, feed, `publish` config and update UI removed |
| `build:win` downloaded prebuilt helper exes (a global keyboard hook, paste injector, mic and audio capture) from OpenWhispr's latest release with no hash | Helpers compiled from `resources/*.c`; download scripts removed; the build fails without a compiler |
| whisper.cpp, llama.cpp, qdrant, sherpa-onnx and nircmd downloaded with no checksum | Each pinned to a version and sha256; nircmd removed; the build download helper refuses a missing hash |
| The app downloaded Whisper models from Hugging Face `main` and most LLM and speaker models with no hash; a GPU pack trusted the digest its own release reported | Every runtime download pinned to a commit and an LFS sha256 (read 2026-11-24); the shared checker refuses a missing hash; GPU packs accept only digests pinned here |
| Model catalog fetched from OpenWhispr every 15 minutes | Off unless turned on in Settings |
| `openwhispr://?bearer_token=` links could sign the app into someone else's account | URL scheme, deep-link handlers and protocol registration removed; no default auth server |
| Cloud fallbacks for transcription | Local by default; cloud only with your own key |
| The Parakeet server binds every interface with no auth | Parakeet and the models that use it are off; its server exes are not shipped |
| A root `.env` was copied into the installer | Removed from the package |
| A CLI HTTP bridge started on every launch | No longer started |
| Auto-learn read the focused text field after each paste, on by default | Off by default |
| Window CSP only covered images | Full CSP; `connect-src` limited to local servers and the providers you can add keys for |
| Electron on a caret range | Pinned to 43.8.3; fast-xml-parser updated |
| Release, signing and publishing workflows; the mobile app | Removed |

## Still open

- **The Control Panel window runs with `sandbox: false` and `webSecurity: false`** (upstream's choice, for its file:// origin). The new CSP limits what injected script could reach, but a renderer bug would still have the full IPC surface. Turning both on needs the cross-origin calls moved to the main process. Not done.
- **`ffmpeg-static` downloads an ffmpeg exe from GitHub during `npm ci`** with no hash check. It is a widely used package, but the file is not pinned here.
- **15 moderate npm advisories** remain (fast-uri, minimatch), in build tooling.
- **Linear and Slack connectors** send their sign-in through an openwhispr.com relay. They only run if you connect those apps.
- **Dormant upstream code** remains (affiliate links, enterprise console, docs links). None of it runs without an account.
- **Only Windows was built.** macOS and Linux helper builds were not reviewed.
- **Not tested:** the full test suite does not finish here (about 1,270 files), and the app has not yet been run with its network traffic watched.

## Updating

To take a newer engine or model, read the new release or commit, then update its version or revision and its sha256 together. A download with no hash will not run.

## Reporting a problem

Open a private security advisory on this repo (Security tab, "Report a vulnerability"). Problems in the original app belong with [OpenWhispr](https://github.com/OpenWhispr/openwhispr).
