"use strict";
// electron/oneclick/utils/skinLoader.ts
// 블로그 스킨 CSS 로드 유틸
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
exports.loadSkinCSS = loadSkinCSS;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const CSS_FILES = {
    blogspot: 'blogspot-cloud-skin.css',
    wordpress: 'cloud-skin.css',
};
/**
 * 스킨 CSS 파일을 읽어 문자열로 반환한다.
 * 파일이 없으면 빈 문자열을 반환한다.
 */
function loadSkinCSS(type) {
    try {
        const cssName = CSS_FILES[type];
        if (!cssName)
            return '';
        const cssPath = path.join(__dirname, '..', 'ui', cssName);
        if (fs.existsSync(cssPath)) {
            return fs.readFileSync(cssPath, 'utf-8');
        }
    }
    catch (e) {
        console.error(`[ONECLICK] 스킨 CSS 로드 실패:`, e);
    }
    return '';
}
