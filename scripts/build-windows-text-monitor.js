#!/usr/bin/env node
// Compiles resources/windows-text-monitor.c to resources/bin/windows-text-monitor.exe. Windows only.
const { compileWindowsHelper } = require("./lib/compile-windows-helper");

compileWindowsHelper("windows-text-monitor", ["ole32", "oleaut32"]);
