"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOnePost = void 0;
// src/public-core.ts
// core/index.ts가 내보내는 이름을 앱에서 쓰는 이름으로 매핑
var index_1 = require("./core/index");
Object.defineProperty(exports, "runOnePost", { enumerable: true, get: function () { return index_1.runPost; } });
