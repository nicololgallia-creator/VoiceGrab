#!/usr/bin/env node
// Compiles resources/windows-key-listener.c to resources/bin/windows-key-listener.exe. Windows only.
const { compileWindowsHelper } = require("./lib/compile-windows-helper");

compileWindowsHelper("windows-key-listener", ["user32"]);
