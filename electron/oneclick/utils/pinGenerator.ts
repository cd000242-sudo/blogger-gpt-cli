// electron/oneclick/utils/pinGenerator.ts
// 암호학적으로 안전한 PIN 생성기

import { randomInt } from 'crypto';

const PIN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 영문소문자+숫자 조합의 랜덤 PIN을 생성한다.
 * crypto.randomInt를 사용하여 CSPRNG 보장.
 */
export function generateRandomPin(length: number = 10): string {
  return Array.from({ length }, () =>
    PIN_CHARS[randomInt(PIN_CHARS.length)]
  ).join('');
}
