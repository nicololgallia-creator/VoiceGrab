# VoiceGrab

Voice dictation for Windows that runs on your own computer. Hold a hotkey, talk, and the words are typed wherever your cursor is. Transcription is local by default, with no account and no auto-update.

VoiceGrab is a fork of [OpenWhispr](https://github.com/OpenWhispr/openwhispr) by the OpenWhispr team (MIT licence, forked at commit `7970fda` on 2026-11-23). The dictation engine and the app are their work. This fork reviews the code and trims it down to a local-first app. [SECURITY.md](SECURITY.md) lists every change and what the review did and did not cover.

## What changed from OpenWhispr

- **No update feed.** The auto-updater, its feed and its settings are gone.
- **No OpenWhispr account.** No default sign-in server, no `openwhispr://` links, no cloud fallback. Dictation, meetings and file uploads transcribe locally unless you add your own API key for a provider.
- **Helpers built from source.** The five Windows helper programs (hotkey listener, paste, mic listener, system audio, text monitor) are compiled from the C files in `resources/` with MSVC. The prebuilt downloads and nircmd are gone.
- **Pinned downloads.** Every engine the build downloads (whisper.cpp, llama.cpp, qdrant, sherpa-onnx, yt-dlp) and every model the app downloads (Whisper, the local LLMs, speaker detection) is pinned to a version or commit and a sha256. A download with no pinned hash is refused.
- **Model list stays local.** The catalog does not update from OpenWhispr unless you turn that on in Settings.
- **Quieter by default.** Auto-learn (which reads the text field after a paste to learn your corrections) is off. The CLI bridge does not start. Parakeet, whose server listens on every network interface, is off.
- **Content Security Policy** on the app window, limited to local servers and the AI providers you can add keys for.
- Electron pinned to 43.8.3.

## Build it on Windows

You need Node 24, Git, Python 3 (for building `better-sqlite3`) and the Visual Studio C++ Build Tools.

```
npm.cmd ci
npm.cmd run build:win -- --config electron-builder.unsigned-win.json
```

`build:win` compiles the helpers, downloads the pinned engines and checks their hashes, then builds the installer in `dist/`. It is unsigned, so Windows SmartScreen warns the first time you run it.

## Licence

MIT, see [LICENSE](LICENSE). The original OpenWhispr copyright notice stays. ffmpeg, which `ffmpeg-static` bundles, is GPL-3.0.
