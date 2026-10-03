"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBrowserBackgroundCommand = isBrowserBackgroundCommand;
exports.installWindowsBrowserProcessGuard = installWindowsBrowserProcessGuard;
const path = __importStar(require("path"));
/**
 * Playwright/Patchright and Puppeteer's browser launchers omit windowsHide.
 * chrome-headless-shell.exe can consequently create an empty Windows console,
 * even though Orbit's own AI CLI launches already set windowsHide: true.
 * Their forced browser cleanup also launches `taskkill /pid N /T /F` via cmd.
 * Restrict this compatibility guard to those known browser/helper commands.
 * Do not change arbitrary child processes or explicitly visible login terminals.
 */
function isBrowserBackgroundCommand(command) {
    if (typeof command !== 'string')
        return false;
    const base = path.win32.basename(command).toLowerCase();
    if (/^(?:chrome|chromium|msedge|firefox|chrome-headless-shell|headless_shell)\.exe$/.test(base))
        return true;
    return /^taskkill\s+\/pid\s+\d+\s+\/t\s+\/f$/i.test(command.trim());
}
const INSTALLED = Symbol.for('orbit.windowsBrowserProcessGuard');
/** Exported dependency seam lets tests exercise the real wrapper without launching processes. */
function installWindowsBrowserProcessGuard(childProcess = require('child_process'), platform = process.platform) {
    if (platform !== 'win32' || childProcess[INSTALLED])
        return;
    for (const method of ['spawn', 'spawnSync']) {
        const original = childProcess[method];
        if (typeof original !== 'function')
            continue;
        childProcess[method] = function (...args) {
            if (isBrowserBackgroundCommand(args[0])) {
                const optionsIndex = Array.isArray(args[1]) ? 2 : 1;
                const options = args[optionsIndex] || {};
                // An explicit visible request remains visible; browser headless/headed
                // selection and all command arguments are untouched.
                if (options.windowsHide === undefined)
                    args[optionsIndex] = { ...options, windowsHide: true };
            }
            return original.apply(this, args);
        };
    }
    childProcess[INSTALLED] = true;
}
