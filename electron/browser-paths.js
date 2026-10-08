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
exports.systemBrowserCandidates = systemBrowserCandidates;
exports.installPuppeteerBrowserPath = installPuppeteerBrowserPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function systemBrowserCandidates(env, platform) {
    if (platform === 'win32') {
        const programFiles = env['PROGRAMFILES'] || 'C:\\Program Files';
        const programFilesX86 = env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
        const localAppData = env['LOCALAPPDATA'] || '';
        return [
            path.win32.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
            path.win32.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
            localAppData ? path.win32.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe') : '',
            path.win32.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.win32.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
        ].filter(Boolean);
    }
    if (platform === 'darwin') {
        return [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ];
    }
    return [];
}
function installPuppeteerBrowserPath(env = process.env, platform = process.platform, exists = (p) => { try {
    return fs.existsSync(p);
}
catch {
    return false;
} }) {
    const current = env['PUPPETEER_EXECUTABLE_PATH'];
    if (current && exists(current))
        return current;
    const found = systemBrowserCandidates(env, platform).find(exists);
    if (found)
        env['PUPPETEER_EXECUTABLE_PATH'] = found;
    return found;
}
