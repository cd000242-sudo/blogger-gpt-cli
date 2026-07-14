"use strict";
/**
 * electron/auth-utils.ts
 * 무료/유료 사용자 판별 + 쿼터 가드 + 페이월 응답
 *
 * 기존 license-manager-new.ts의 라이선스 정보를 활용하여
 * 무료 체험 사용자는 글포스팅의 실제 발행 완료 3회만 사용할 수 있다.
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
exports.FREE_TRIAL_PUBLISH_LIMIT = void 0;
exports.activateFreeTrial = activateFreeTrial;
exports.isFreeTrial = isFreeTrial;
exports.isFreeTierUser = isFreeTierUser;
exports.getFreeQuotaLimit = getFreeQuotaLimit;
exports.getFreeQuotaStatus = getFreeQuotaStatus;
exports.enforceFreeTier = enforceFreeTier;
exports.getPaywallResponse = getPaywallResponse;
exports.blockIfFreeTier = blockIfFreeTier;
exports.getFreeTrialRestrictedWorkflow = getFreeTrialRestrictedWorkflow;
exports.enforceFreeTrialPostingWorkflow = enforceFreeTrialPostingWorkflow;
exports.isConfirmedPublishedPost = isConfirmedPublishedPost;
exports.recordFreeTrialPublishCompletion = recordFreeTrialPublishCompletion;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const quotaManager = __importStar(require("./quota-manager"));
exports.FREE_TRIAL_PUBLISH_LIMIT = 3;
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
        // 라이선스 파일을 직접 읽어서 유료 여부 판단
        // (getLicenseStatus()는 패치 파일 해시까지 검증하는 엄격한 체크라서,
        //  서버 인증으로 로그인한 유료 사용자가 무료로 표시되는 버그가 있었음)
        const licensePath = path.join(electron_1.app.getPath('userData'), 'license.json');
        if (!fs.existsSync(licensePath))
            return true; // 파일 없음 → 무료
        const license = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
        if (!license || !license.licenseType)
            return true; // 데이터 없음 → 무료
        // 만료 체크 (기간제만)
        if (license.licenseType === 'temporary' && license.expiresAt) {
            if (Date.now() > license.expiresAt) {
                return true; // 만료됨 → 무료
            }
        }
        // 유효한 라이선스 파일 존재 → 유료 (무제한)
        console.log('[AuthUtils] 유료 사용자 확인:', license.licenseType);
        return false;
    }
    catch (e) {
        console.warn('[AuthUtils] 라이선스 확인 실패, 무료 모드 적용:', e);
        return true; // 에러 시 안전하게 무료로 처리
    }
}
/** 무료 체험 완료 발행 한도 반환 */
function getFreeQuotaLimit() {
    return exports.FREE_TRIAL_PUBLISH_LIMIT;
}
/** 현재 쿼터 상태 조회 */
async function getFreeQuotaStatus() {
    return quotaManager.getQuotaStatus(exports.FREE_TRIAL_PUBLISH_LIMIT);
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
    const canUse = await quotaManager.canConsume(exports.FREE_TRIAL_PUBLISH_LIMIT);
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
        message: message || '⛔ 무료 체험 발행 3회를 모두 사용했어요.\n라이선스를 등록하면 모든 발행 기능을 사용할 수 있습니다.',
        quota,
    };
}
/**
 * 글포스팅 외 기능을 무료 체험에서 차단한다.
 * 무료 체험은 글포스팅 탭의 실제 발행 완료 3회만 사용할 수 있다.
 */
async function blockIfFreeTier(featureName = '이 기능') {
    const isFree = await isFreeTierUser();
    if (!isFree)
        return { allowed: true };
    const quota = await getFreeQuotaStatus();
    return {
        allowed: false,
        response: {
            ok: false,
            code: 'PAYWALL',
            message: `⛔ ${featureName}은(는) 유료 플랜 전용 기능입니다.\n\n무료 체험에서는 글포스팅 탭에서 실제 발행이 완료된 글만 최대 3회 이용할 수 있습니다.\n${featureName} 사용은 라이선스 등록 후 가능합니다.`,
            quota,
        },
    };
}
/**
 * 일반 글포스팅의 contentMode와 충돌하지 않도록 명시적인 workflow 표식만 사용한다.
 */
function getFreeTrialRestrictedWorkflow(payload) {
    if (!payload || typeof payload !== 'object')
        return null;
    const request = payload;
    const workflow = [
        request.workflow,
        request.publishWorkflow,
        request.feature,
        request.entryPoint,
    ]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLowerCase();
    if (/(spider[-_\s]?web|internal[-_\s]?links|거미줄)/i.test(workflow)) {
        return '거미줄 포스팅';
    }
    if (/(external[-_\s]?(traffic|inflow)|외부유입)/i.test(workflow)) {
        return '외부유입 글 생성';
    }
    return null;
}
/** 무료 체험의 유료 전용 발행 경로를 백엔드에서도 차단한다. */
async function enforceFreeTrialPostingWorkflow(payload) {
    const restrictedFeature = getFreeTrialRestrictedWorkflow(payload);
    if (!restrictedFeature)
        return { allowed: true };
    return blockIfFreeTier(restrictedFeature);
}
function isImmediatePublicPublish(payload) {
    if (!payload || typeof payload !== 'object')
        return true;
    const request = payload;
    if (request.previewOnly === true)
        return false;
    const mode = String(request.postingMode
        || request.publishType
        || request.status
        || '').trim().toLowerCase();
    return !['draft', 'save', 'schedule', 'scheduled', 'preview'].includes(mode);
}
/** 실제 공개 발행이 완료됐다는 응답인지 판별한다. */
function isConfirmedPublishedPost(result, payload) {
    if (!result || typeof result !== 'object')
        return false;
    if (!isImmediatePublicPublish(payload))
        return false;
    const response = result;
    if (response.ok !== true && response.success !== true)
        return false;
    if (response.preview === true || response.published === false)
        return false;
    return ['url', 'postUrl', 'postId', 'post_id', 'id'].some((key) => {
        const value = response[key];
        return (typeof value === 'string' && value.trim().length > 0)
            || (typeof value === 'number' && Number.isFinite(value));
    });
}
/** 실제 발행 완료 후에만 무료 체험 사용량을 1회 기록한다. */
async function recordFreeTrialPublishCompletion() {
    const isFree = await isFreeTierUser();
    if (!isFree)
        return { counted: false, quota: null };
    const counted = await quotaManager.consumeIfAvailable(exports.FREE_TRIAL_PUBLISH_LIMIT);
    const quota = await getFreeQuotaStatus();
    return { counted, quota };
}
