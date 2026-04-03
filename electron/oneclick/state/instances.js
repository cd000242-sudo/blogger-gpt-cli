"use strict";
// electron/oneclick/state/instances.ts
// 각 도메인별 StateManager 싱글턴 인스턴스
Object.defineProperty(exports, "__esModule", { value: true });
exports.webmasterStateManager = exports.infraStateManager = exports.connectStateManager = exports.setupStateManager = void 0;
const StateManager_1 = require("./StateManager");
exports.setupStateManager = new StateManager_1.StateManager('ONECLICK-SETUP');
exports.connectStateManager = new StateManager_1.StateManager('ONECLICK-CONNECT');
exports.infraStateManager = new StateManager_1.StateManager('ONECLICK-INFRA');
exports.webmasterStateManager = new StateManager_1.StateManager('ONECLICK-WEBMASTER');
