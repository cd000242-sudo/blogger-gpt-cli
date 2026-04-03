"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConfigIpcHandlers = exports.registerEnvIpcHandlers = exports.registerScheduleIpcHandlers = void 0;
exports.registerAllSplitHandlers = registerAllSplitHandlers;
/**
 * IPC 핸들러 통합 등록
 *
 * main.ts에서 이 파일만 import하면 모든 분리된 핸들러가 등록됩니다.
 * 새 핸들러 파일을 추가할 때 여기에 import하세요.
 */
var scheduleIpcHandlers_1 = require("./scheduleIpcHandlers");
Object.defineProperty(exports, "registerScheduleIpcHandlers", { enumerable: true, get: function () { return scheduleIpcHandlers_1.registerScheduleIpcHandlers; } });
var envIpcHandlers_1 = require("./envIpcHandlers");
Object.defineProperty(exports, "registerEnvIpcHandlers", { enumerable: true, get: function () { return envIpcHandlers_1.registerEnvIpcHandlers; } });
var configIpcHandlers_1 = require("./configIpcHandlers");
Object.defineProperty(exports, "registerConfigIpcHandlers", { enumerable: true, get: function () { return configIpcHandlers_1.registerConfigIpcHandlers; } });
/**
 * 분리된 모든 IPC 핸들러를 한번에 등록
 */
function registerAllSplitHandlers() {
    const { registerScheduleIpcHandlers } = require('./scheduleIpcHandlers');
    const { registerEnvIpcHandlers } = require('./envIpcHandlers');
    const { registerConfigIpcHandlers } = require('./configIpcHandlers');
    // 기존 핸들러
    const { registerAdsenseIpcHandlers } = require('../adsenseIpcHandlers');
    const { registerAdspowerIpcHandlers } = require('../adspowerIpcHandlers');
    const { registerOneclickSetupIpcHandlers } = require('../oneclickSetupIpcHandlers');
    registerScheduleIpcHandlers();
    registerEnvIpcHandlers();
    registerConfigIpcHandlers();
    registerAdsenseIpcHandlers();
    registerAdspowerIpcHandlers();
    registerOneclickSetupIpcHandlers();
}
