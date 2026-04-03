"use strict";
// electron/oneclick/utils/pinGenerator.ts
// 암호학적으로 안전한 PIN 생성기
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomPin = generateRandomPin;
const crypto_1 = require("crypto");
const PIN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
/**
 * 영문소문자+숫자 조합의 랜덤 PIN을 생성한다.
 * crypto.randomInt를 사용하여 CSPRNG 보장.
 */
function generateRandomPin(length = 10) {
    return Array.from({ length }, () => PIN_CHARS[(0, crypto_1.randomInt)(PIN_CHARS.length)]).join('');
}
