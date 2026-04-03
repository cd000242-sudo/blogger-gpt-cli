/**
 * 🎯 라이선스 티어 관리 시스템
 * 
 * 패널에서 기간을 수정하면 자동으로 인식하고 해당 티어의 기능을 활성화합니다.
 * 
 * 티어별 기능:
 * - 1개월: 기본 기능
 * - 3개월: 기본 + AI 이미지
 * - 6개월: 기본 + AI 이미지 + 키워드마스터
 * - 1년: 모든 기능 (LEWORD 포함)
 * - 무제한: 모든 기능 + 우선 지원
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// ============================================
// 🎯 티어 정의
// ============================================

export type LicenseTier = 'basic' | 'standard' | 'premium' | 'professional' | 'unlimited' | 'expired' | 'none';

export interface TierFeatures {
  tier: LicenseTier;
  name: string;
  durationMonths: number | -1;  // -1 = 무제한
  features: {
    basicPosting: boolean;       // 기본 포스팅
    aiContent: boolean;          // AI 콘텐츠 생성
    aiImages: boolean;           // AI 이미지 (Pollinations/DALL-E)
    keywordMaster: boolean;      // 키워드마스터
    leword: boolean;             // LEWORD 기능
    scheduling: boolean;         // 예약 포스팅
    bulkPosting: boolean;        // 대량 포스팅
    analytics: boolean;          // 분석 기능
    prioritySupport: boolean;    // 우선 지원
  };
}

// 티어별 기능 정의
const TIER_DEFINITIONS: Record<LicenseTier, TierFeatures> = {
  none: {
    tier: 'none',
    name: '미등록',
    durationMonths: 0,
    features: {
      basicPosting: false,
      aiContent: false,
      aiImages: false,
      keywordMaster: false,
      leword: false,
      scheduling: false,
      bulkPosting: false,
      analytics: false,
      prioritySupport: false,
    }
  },
  expired: {
    tier: 'expired',
    name: '만료됨',
    durationMonths: 0,
    features: {
      basicPosting: false,
      aiContent: false,
      aiImages: false,
      keywordMaster: false,
      leword: false,
      scheduling: false,
      bulkPosting: false,
      analytics: false,
      prioritySupport: false,
    }
  },
  basic: {
    tier: 'basic',
    name: '기본 (1개월)',
    durationMonths: 1,
    features: {
      basicPosting: true,
      aiContent: true,
      aiImages: false,
      keywordMaster: false,
      leword: false,
      scheduling: false,
      bulkPosting: false,
      analytics: false,
      prioritySupport: false,
    }
  },
  standard: {
    tier: 'standard',
    name: '스탠다드 (3개월)',
    durationMonths: 3,
    features: {
      basicPosting: true,
      aiContent: true,
      aiImages: true,
      keywordMaster: false,
      leword: false,
      scheduling: true,
      bulkPosting: false,
      analytics: false,
      prioritySupport: false,
    }
  },
  premium: {
    tier: 'premium',
    name: '프리미엄 (6개월)',
    durationMonths: 6,
    features: {
      basicPosting: true,
      aiContent: true,
      aiImages: true,
      keywordMaster: true,
      leword: false,
      scheduling: true,
      bulkPosting: true,
      analytics: true,
      prioritySupport: false,
    }
  },
  professional: {
    tier: 'professional',
    name: '프로페셔널 (1년)',
    durationMonths: 12,
    features: {
      basicPosting: true,
      aiContent: true,
      aiImages: true,
      keywordMaster: true,
      leword: true,
      scheduling: true,
      bulkPosting: true,
      analytics: true,
      prioritySupport: false,
    }
  },
  unlimited: {
    tier: 'unlimited',
    name: '무제한',
    durationMonths: -1,
    features: {
      basicPosting: true,
      aiContent: true,
      aiImages: true,
      keywordMaster: true,
      leword: true,
      scheduling: true,
      bulkPosting: true,
      analytics: true,
      prioritySupport: true,
    }
  }
};

// ============================================
// 🔧 티어 매니저
// ============================================

export class LicenseTierManager {
  private licensePath: string;
  private cachedTier: TierFeatures | null = null;
  private lastCheck: number = 0;
  private checkInterval: number = 5 * 60 * 1000; // 5분마다 체크

  constructor() {
    const userDataPath = app.getPath('userData');
    this.licensePath = path.join(userDataPath, 'license.json');
  }

  /**
   * 현재 라이선스 데이터 로드
   */
  private loadLicenseData(): any | null {
    try {
      if (!fs.existsSync(this.licensePath)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(this.licensePath, 'utf8'));
    } catch (error) {
      console.error('[TIER] 라이선스 데이터 로드 실패:', error);
      return null;
    }
  }

  /**
   * 만료일로부터 남은 기간 계산 (개월 수)
   */
  private calculateRemainingMonths(expiresAt: number): number {
    const now = Date.now();
    if (expiresAt <= now) return 0;
    
    const remainingMs = expiresAt - now;
    const remainingDays = remainingMs / (24 * 60 * 60 * 1000);
    return Math.ceil(remainingDays / 30);
  }

  /**
   * 🔥 핵심: 라이선스 데이터로부터 티어 결정
   * 패널에서 기간을 수정하면 expiresAt이 변경되고, 이를 기반으로 티어 자동 결정
   */
  public determineTierFromLicense(licenseData: any): LicenseTier {
    if (!licenseData) {
      return 'none';
    }

    // 1. 무제한 체크 (plan이 unlimited이거나 maxUses가 -1)
    if (licenseData.plan === 'unlimited' || 
        licenseData.maxUses === -1 || 
        licenseData.remaining === -1 ||
        licenseData.licenseType === 'permanent') {
      console.log('[TIER] ✅ 무제한 라이선스 감지');
      return 'unlimited';
    }

    // 2. 만료일 기반 티어 결정
    if (licenseData.expiresAt) {
      const expiresAt = typeof licenseData.expiresAt === 'number' 
        ? licenseData.expiresAt 
        : new Date(licenseData.expiresAt).getTime();
      
      const now = Date.now();
      
      // 만료 체크
      if (expiresAt <= now) {
        console.log('[TIER] ⚠️ 라이선스 만료됨');
        return 'expired';
      }

      // 남은 기간으로 티어 결정
      const remainingMs = expiresAt - now;
      const remainingDays = remainingMs / (24 * 60 * 60 * 1000);
      
      console.log(`[TIER] 📅 남은 기간: ${Math.ceil(remainingDays)}일`);
      
      // 🔥 패널에서 기간 수정 시 자동으로 인식되는 부분
      // 남은 기간에 따라 해당 티어의 기능 제공
      if (remainingDays >= 330) {  // 11개월 이상 = 1년 티어
        console.log('[TIER] ✅ 프로페셔널 (1년) 티어');
        return 'professional';
      } else if (remainingDays >= 150) {  // 5개월 이상 = 6개월 티어
        console.log('[TIER] ✅ 프리미엄 (6개월) 티어');
        return 'premium';
      } else if (remainingDays >= 60) {  // 2개월 이상 = 3개월 티어
        console.log('[TIER] ✅ 스탠다드 (3개월) 티어');
        return 'standard';
      } else {
        console.log('[TIER] ✅ 기본 (1개월) 티어');
        return 'basic';
      }
    }

    // 3. 티어가 명시적으로 저장된 경우
    if (licenseData.tier && TIER_DEFINITIONS[licenseData.tier as LicenseTier]) {
      console.log(`[TIER] 명시적 티어: ${licenseData.tier}`);
      return licenseData.tier as LicenseTier;
    }

    return 'basic';
  }

  /**
   * 현재 티어 정보 가져오기
   */
  public getCurrentTier(forceRefresh: boolean = false): TierFeatures {
    const now = Date.now();
    
    // 캐시 사용 (5분 이내)
    if (!forceRefresh && this.cachedTier && (now - this.lastCheck) < this.checkInterval) {
      return this.cachedTier;
    }

    const licenseData = this.loadLicenseData();
    const tier = this.determineTierFromLicense(licenseData);
    
    this.cachedTier = TIER_DEFINITIONS[tier];
    this.lastCheck = now;
    
    console.log(`[TIER] 현재 티어: ${this.cachedTier.name}`);
    
    return this.cachedTier;
  }

  /**
   * 특정 기능 사용 가능 여부 체크
   */
  public canUseFeature(feature: keyof TierFeatures['features']): boolean {
    const tier = this.getCurrentTier();
    return tier.features[feature] === true;
  }

  /**
   * 기능 체크 with 에러 메시지
   */
  public checkFeatureAccess(feature: keyof TierFeatures['features']): { allowed: boolean; error?: any } {
    const tier = this.getCurrentTier();
    const allowed = tier.features[feature] === true;

    if (!allowed) {
      const requiredTier = this.getMinimumTierForFeature(feature);
      return {
        allowed: false,
        error: {
          error: '기능 접근 제한',
          message: `이 기능은 ${requiredTier.name} 이상 라이선스가 필요합니다.\n\n현재 티어: ${tier.name}`,
          currentTier: tier.tier,
          requiredTier: requiredTier.tier
        }
      };
    }

    return { allowed: true };
  }

  /**
   * 특정 기능을 위한 최소 필요 티어 찾기
   */
  private getMinimumTierForFeature(feature: keyof TierFeatures['features']): TierFeatures {
    const tierOrder: LicenseTier[] = ['basic', 'standard', 'premium', 'professional', 'unlimited'];
    
    for (const tier of tierOrder) {
      if (TIER_DEFINITIONS[tier].features[feature]) {
        return TIER_DEFINITIONS[tier];
      }
    }
    
    return TIER_DEFINITIONS['unlimited'];
  }

  /**
   * 라이선스 갱신 (서버에서 최신 정보 동기화)
   */
  public async syncWithServer(serverUrl: string, userId: string, passwordHash: string): Promise<boolean> {
    try {
      const axios = (await import('axios')).default;
      
      const response = await axios.post(
        `${serverUrl}/api/license/status`,
        { userId, passwordHash },
        { timeout: 10000 }
      );

      if (response.data && response.data.valid) {
        // 서버에서 받은 정보로 로컬 라이선스 업데이트
        const licenseData = this.loadLicenseData() || {};
        
        // 🔥 핵심: 서버에서 받은 expiresAt으로 업데이트
        if (response.data.expiresAt) {
          licenseData.expiresAt = new Date(response.data.expiresAt).getTime();
        }
        if (response.data.plan) {
          licenseData.plan = response.data.plan;
        }
        if (response.data.tier) {
          licenseData.tier = response.data.tier;
        }

        fs.writeFileSync(this.licensePath, JSON.stringify(licenseData, null, 2), 'utf8');
        
        // 캐시 초기화 (다음 호출 시 새로운 티어 계산)
        this.cachedTier = null;
        
        console.log('[TIER] ✅ 서버와 동기화 완료, 새 만료일:', new Date(licenseData.expiresAt).toLocaleDateString());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[TIER] 서버 동기화 실패:', error);
      return false;
    }
  }

  /**
   * 라이선스 만료일 직접 업데이트 (관리자 기능)
   */
  public updateExpiresAt(newExpiresAt: number): boolean {
    try {
      const licenseData = this.loadLicenseData();
      if (!licenseData) {
        console.error('[TIER] 라이선스 데이터가 없습니다');
        return false;
      }

      licenseData.expiresAt = newExpiresAt;
      fs.writeFileSync(this.licensePath, JSON.stringify(licenseData, null, 2), 'utf8');
      
      // 캐시 초기화
      this.cachedTier = null;
      
      const newTier = this.getCurrentTier(true);
      console.log(`[TIER] ✅ 만료일 업데이트 완료: ${new Date(newExpiresAt).toLocaleDateString()}`);
      console.log(`[TIER] ✅ 새 티어: ${newTier.name}`);
      
      return true;
    } catch (error) {
      console.error('[TIER] 만료일 업데이트 실패:', error);
      return false;
    }
  }

  /**
   * 티어 정보 전체 가져오기 (UI용)
   */
  public getAllTierInfo(): { current: TierFeatures; all: Record<LicenseTier, TierFeatures> } {
    return {
      current: this.getCurrentTier(),
      all: TIER_DEFINITIONS
    };
  }
}

// 싱글톤 인스턴스
let tierManagerInstance: LicenseTierManager | null = null;

export function getLicenseTierManager(): LicenseTierManager {
  if (!tierManagerInstance) {
    tierManagerInstance = new LicenseTierManager();
  }
  return tierManagerInstance;
}

// 기능별 빠른 체크 함수들
export function canUseAiImages(): boolean {
  return getLicenseTierManager().canUseFeature('aiImages');
}

export function canUseKeywordMaster(): boolean {
  return getLicenseTierManager().canUseFeature('keywordMaster');
}

export function canUseLeword(): boolean {
  return getLicenseTierManager().canUseFeature('leword');
}

export function canUseScheduling(): boolean {
  return getLicenseTierManager().canUseFeature('scheduling');
}

export function canUseBulkPosting(): boolean {
  return getLicenseTierManager().canUseFeature('bulkPosting');
}

export function checkFeatureAccess(feature: keyof TierFeatures['features']): { allowed: boolean; error?: any } {
  return getLicenseTierManager().checkFeatureAccess(feature);
}



