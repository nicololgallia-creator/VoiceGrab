#!/usr/bin/env node
// Compiles resources/windows-system-audio-helper.c to resources/bin/windows-system-audio-helper.exe. Windows only.
const { compileWindowsHelper } = require("./lib/compile-windows-helper");

compileWindowsHelper("windows-system-audio-helper", ["ole32", "mmdevapi"]);
