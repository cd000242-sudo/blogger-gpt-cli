"use strict";
/**
 * electron/auth-utils.ts
 * 무료/유료 사용자 판별 + 쿼터 가드 + 페이월 응답
 *
 * 기존 license-manager-new.ts의 라이선스 정보를 활용하여
 * 무료 체험 사용자에게 일일 2회 제한을 적용한다.
 */
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
exports.activateFreeTrial = activateFreeTrial;
exports.isFreeTrial = isFreeTrial;
exports.isFreeTierUser = isFreeTierUser;
exports.getFreeQuotaLimit = getFreeQuotaLimit;
exports.getFreeQuotaStatus = getFreeQuotaStatus;
exports.enforceFreeTier = enforceFreeTier;
exports.getPaywallResponse = getPaywallResponse;
const electron_1 = require("electron");
const quotaManager = __importStar(require("./quota-manager"));
const FREE_DAILY_LIMIT = 2;
// 무료 체험 세션 플래그 (앱 재시작 시 리셋)
let _freeTrialSession = false;
/** 무료 체험 모드 활성화 */
function activateFreeTrial() {
    _freeTrialSession = true;
    console.log('[AuthUtils] 🆓 무료 체험 세션 활성화');
}
/** 무료 체험 세션 여부 확인 */
function isFreeTrial() {
    return _freeTrialSession;
}
/**
 * 무료 체험 사용자인지 판별한다.
 * - 개발 모드 (!app.isPackaged): 항상 false (무제한)
 * - 라이선스 파일 없음: true (무료)
 * - 라이선스 만료: true (무료)
 * - 유효한 라이선스: false (무제한)
 */
async function isFreeTierUser() {
    // 무료 체험 세션이면 항상 무료
    if (_freeTrialSession) {
        return true;
    }
    // 개발 모드는 무제한
    const forceLicenseCheck = process.env.FORCE_LICENSE_CHECK === 'true';
    if (!electron_1.app.isPackaged && !forceLicenseCheck) {
        return false;
    }
    try {
        // 동적 import — 빌드 후 dist/utils/에 컴파일됨
        const { getLicenseManager } = require('../dist/utils/license-manager-new');
        const lm = getLicenseManager();
        if (!lm)
            return true;
        const license = lm.getLicenseData ? lm.getLicenseData() : null;
        if (!license)
            return true; // 라이선스 없음 → 무료
        // 만료 체크
        if (license.licenseType === 'temporary' && license.expiresAt) {
            if (Date.now() > license.expiresAt) {
                return true; // 만료됨 → 무료
            }
        }
        // 유효한 라이선스 → 유료 (무제한)
        return false;
    }
    catch (e) {
        console.warn('[AuthUtils] 라이선스 확인 실패, 무료 모드 적용:', e);
        return true; // 에러 시 안전하게 무료로 처리
    }
}
/** 일일 무료 한도 반환 */
function getFreeQuotaLimit() {
    return FREE_DAILY_LIMIT;
}
/** 현재 쿼터 상태 조회 */
async function getFreeQuotaStatus() {
    return quotaManager.getQuotaStatus(FREE_DAILY_LIMIT);
}
/**
 * 무료 사용자 쿼터 가드.
 * 발행/생성 전에 호출하여 허용 여부를 확인한다.
 */
async function enforceFreeTier() {
    const isFree = await isFreeTierUser();
    if (!isFree) {
        return { allowed: true, quota: null }; // 유료 → 무조건 통과
    }
    const quota = await getFreeQuotaStatus();
    if (quota.isPaywalled) {
        return { allowed: false, response: await getPaywallResponse() };
    }
    const canUse = await quotaManager.canConsume(FREE_DAILY_LIMIT);
    if (!canUse) {
        return { allowed: false, response: await getPaywallResponse() };
    }
    return { allowed: true, quota };
}
/** 페이월 응답 생성 */
async function getPaywallResponse(message) {
    const quota = await getFreeQuotaStatus();
    return {
        ok: false,
        code: 'PAYWALL',
        message: message || '⛔ 오늘의 무료 사용 한도(2회)를 모두 사용했어요.\n라이선스를 등록하면 무제한으로 사용할 수 있습니다.',
        quota,
    };
}
