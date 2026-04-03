"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOneclickSetupIpcHandlers = void 0;
// electron/oneclickSetupIpcHandlers.ts
// Thin re-export — 실제 구현은 electron/oneclick/ 모듈에 분할됨
var oneclick_1 = require("./oneclick");
Object.defineProperty(exports, "registerOneclickSetupIpcHandlers", { enumerable: true, get: function () { return oneclick_1.registerOneclickSetupIpcHandlers; } });
