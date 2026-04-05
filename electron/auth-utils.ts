/**
 * electron/auth-utils.ts
 * 무료/유료 사용자 판별 + 쿼터 가드 + 페이월 응답
 *
 * 기존 license-manager-new.ts의 라이선스 정보를 활용하여
 * 무료 체험 사용자에게 일일 2회 제한을 적용한다.
 */

import { app } from 'electron';
import * as quotaManager from './quota-manager';

const FREE_DAILY_LIMIT = 2;

// 무료 체험 세션 플래그 (앱 재시작 시 리셋)
let _freeTrialSession = false;

/** 무료 체험 모드 활성화 */
export function activateFreeTrial(): void {
  _freeTrialSession = true;
  console.log('[AuthUtils] 🆓 무료 체험 세션 활성화');
}

/** 무료 체험 세션 여부 확인 */
export function isFreeTrial(): boolean {
  return _freeTrialSession;
}

export interface PaywallResponse {
  ok: false;
  code: 'PAYWALL';
  message: string;
  quota: quotaManager.QuotaStatus;
}

/**
 * 무료 체험 사용자인지 판별한다.
 * - 개발 모드 (!app.isPackaged): 항상 false (무제한)
 * - 라이선스 파일 없음: true (무료)
 * - 라이선스 만료: true (무료)
 * - 유효한 라이선스: false (무제한)
 */
export async function isFreeTierUser(): Promise<boolean> {
  // 무료 체험 세션이면 항상 무료
  if (_freeTrialSession) {
    return true;
  }

  // 개발 모드는 무제한
  const forceLicenseCheck = process.env.FORCE_LICENSE_CHECK === 'true';
  if (!app.isPackaged && !forceLicenseCheck) {
    return false;
  }

  try {
    // 동적 import — 빌드 후 dist/utils/에 컴파일됨
    const { getLicenseManager } = require('../dist/utils/license-manager-new');
    const lm = getLicenseManager();
    if (!lm) return true;

    // getLicenseStatus()로 라이선스 확인 (getLicenseData 메서드 없음)
    const status = lm.getLicenseStatus ? lm.getLicenseStatus() : null;
    if (!status || !status.valid) return true; // 무효 → 무료
    const license = status.licenseData;
    if (!license) return true; // 라이선스 데이터 없음 → 무료

    // 만료 체크
    if (license.licenseType === 'temporary' && license.expiresAt) {
      if (Date.now() > license.expiresAt) {
        return true; // 만료됨 → 무료
      }
    }

    // 유효한 라이선스 → 유료 (무제한)
    return false;
  } catch (e) {
    console.warn('[AuthUtils] 라이선스 확인 실패, 무료 모드 적용:', e);
    return true; // 에러 시 안전하게 무료로 처리
  }
}

/** 일일 무료 한도 반환 */
export function getFreeQuotaLimit(): number {
  return FREE_DAILY_LIMIT;
}

/** 현재 쿼터 상태 조회 */
export async function getFreeQuotaStatus(): Promise<quotaManager.QuotaStatus> {
  return quotaManager.getQuotaStatus(FREE_DAILY_LIMIT);
}

/**
 * 무료 사용자 쿼터 가드.
 * 발행/생성 전에 호출하여 허용 여부를 확인한다.
 */
export async function enforceFreeTier(): Promise<
  { allowed: true; quota: quotaManager.QuotaStatus | null } |
  { allowed: false; response: PaywallResponse }
> {
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
export async function getPaywallResponse(message?: string): Promise<PaywallResponse> {
  const quota = await getFreeQuotaStatus();
  return {
    ok: false,
    code: 'PAYWALL',
    message: message || '⛔ 오늘의 무료 사용 한도(2회)를 모두 사용했어요.\n라이선스를 등록하면 무제한으로 사용할 수 있습니다.',
    quota,
  };
}
