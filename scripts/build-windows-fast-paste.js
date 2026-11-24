#!/usr/bin/env node
// Compiles resources/windows-fast-paste.c to resources/bin/windows-fast-paste.exe. Windows only.
const { compileWindowsHelper } = require("./lib/compile-windows-helper");

compileWindowsHelper("windows-fast-paste", ["user32"]);
