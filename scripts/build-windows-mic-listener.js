#!/usr/bin/env node
// Compiles resources/windows-mic-listener.c to resources/bin/windows-mic-listener.exe. Windows only.
const { compileWindowsHelper } = require("./lib/compile-windows-helper");

compileWindowsHelper("windows-mic-listener", ["ole32", "oleaut32", "user32"]);
