// src/core/adspower-manager.ts
// 🛡️ AdsPower Local API 독립 모듈 — 네이버 자동화 도구 패턴 적용
import axios from 'axios';

// ── 타입 정의 ──
export interface AdsPowerProfile {
  user_id: string;
  name: string;
  serial_number: string;
  group_name: string;
  domain_name?: string;
  ip?: string;
  ip_country?: string;
  created_time: string;
  last_open_time?: string;
  status: 'Active' | 'Inactive' | string;
}

export interface AdsPowerStatus {
  running: boolean;
  version?: string;
  error?: string;
}

export interface AdsPowerBrowserResult {
  wsUrl: string;
  webdriverUrl?: string;
}

export interface AdsPowerListResult {
  profiles: AdsPowerProfile[];
  total: number;
}

/**
 * AdsPower Local API 래퍼 클래스
 * 
 * - 네이버 자동화 도구와 동일한 패턴 사용
 * - local.adspower.com 호스트 + API Key 인증 지원
 * - serial_number 기반 프로필 시작 지원
 * - 독립 모듈 — 모든 크롤러에서 재사용
 * 
 * @example
 * const mgr = new AdsPowerManager({ port: 50325, apiKey: '...' });
 * const status = await mgr.checkStatus();
 * const { wsUrl } = await mgr.startProfile('profile-id');
 */
export class AdsPowerManager {
  private baseUrl: string;
  private statusUrl: string;
  private timeout: number;
  private apiKey: string;

  constructor(opts: { port?: number; apiKey?: string; timeout?: number } = {}) {
    const port = opts.port || 50325;
    this.apiKey = opts.apiKey || '';
    this.timeout = opts.timeout || 10000;
    // 네이버 자동화 도구와 동일 — local.adspower.com 사용
    this.baseUrl = `http://local.adspower.com:${port}/api/v1`;
    this.statusUrl = `http://local.adspower.com:${port}`;
  }

  /**
   * API Key 쿼리 파라미터 생성
   * @param prefix '?' 또는 '&'
   */
  private apiKeyParam(prefix: '?' | '&' = '?'): string {
    return this.apiKey ? `${prefix}api_key=${this.apiKey}` : '';
  }

  /**
   * 포트 변경 (런타임에서 동적 변경 가능)
   */
  setPort(port: number): void {
    this.baseUrl = `http://local.adspower.com:${port}/api/v1`;
    this.statusUrl = `http://local.adspower.com:${port}`;
  }

  /**
   * API Key 변경
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * AdsPower 실행 상태 확인
   */
  async checkStatus(): Promise<AdsPowerStatus> {
    try {
      const url = `${this.statusUrl}/status${this.apiKeyParam()}`;
      const res = await axios.get(url, { timeout: 5000 });

      if (res.data && res.data.code === 0) {
        return {
          running: true,
          version: res.data.data?.version || 'unknown',
        };
      }

      return { running: true, version: 'unknown' };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
        return { running: false, error: 'AdsPower가 실행 중이 아닙니다' };
      }
      return { running: false, error: error.message || '상태 확인 실패' };
    }
  }

  /**
   * 프로필 목록 조회
   */
  async listProfiles(page: number = 1, pageSize: number = 100): Promise<AdsPowerListResult> {
    try {
      const url = `${this.baseUrl}/user/list${this.apiKeyParam()}`;
      const res = await axios.get(url, {
        params: { page, page_size: pageSize },
        timeout: this.timeout,
      });

      if (res.data && res.data.code === 0) {
        const list = res.data.data?.list || [];
        return {
          profiles: list.map((p: any) => ({
            user_id: p.user_id || p.serial_number || '',
            name: p.name || p.remark || `프로필 ${p.serial_number}`,
            serial_number: String(p.serial_number || ''),
            group_name: p.group_name || '',
            domain_name: p.domain_name || '',
            ip: p.ip || '',
            ip_country: p.ip_country || '',
            created_time: p.created_time || '',
            last_open_time: p.last_open_time || '',
            status: p.status || 'Inactive',
          })),
          total: res.data.data?.page?.total || list.length,
        };
      }

      throw new Error(res.data?.msg || '프로필 목록 조회 실패');
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('AdsPower가 실행 중이 아닙니다. AdsPower를 먼저 실행해주세요.');
      }
      throw new Error(`프로필 목록 조회 실패: ${error.message}`);
    }
  }

  /**
   * 프로필 브라우저 시작
   * serial_number & user_id 모두 지원 (네이버 자동화 도구 패턴)
   * @returns WebSocket CDP URL (Playwright connectOverCDP 용)
   */
  async startProfile(profileId: string): Promise<AdsPowerBrowserResult> {
    try {
      console.log(`[AdsPower] 프로필 시작: ${profileId}`);

      // user_id와 serial_number 모두 전달 — AdsPower가 알아서 매칭
      const url = `${this.baseUrl}/browser/start?user_id=${encodeURIComponent(profileId)}&serial_number=${encodeURIComponent(profileId)}${this.apiKeyParam('&')}`;
      const res = await axios.get(url, {
        timeout: 30000, // 브라우저 시작은 시간이 걸릴 수 있음
      });

      if (res.data && res.data.code === 0) {
        const wsUrl = res.data.data?.ws?.puppeteer;
        const webdriverUrl = res.data.data?.webdriver;

        if (!wsUrl) {
          throw new Error('WebSocket URL을 받지 못했습니다. AdsPower 프로필 설정을 확인하세요.');
        }

        console.log(`[AdsPower] ✅ 프로필 시작 완료 — WS: ${wsUrl.substring(0, 50)}...`);

        return { wsUrl, webdriverUrl };
      }

      throw new Error(res.data?.msg || '프로필 시작 실패');
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('AdsPower가 실행 중이 아닙니다. AdsPower를 먼저 실행해주세요.');
      }
      throw new Error(`프로필 시작 실패: ${error.message}`);
    }
  }

  /**
   * 프로필 브라우저 중지
   */
  async stopProfile(profileId: string): Promise<void> {
    try {
      console.log(`[AdsPower] 프로필 중지: ${profileId}`);

      const url = `${this.baseUrl}/browser/stop?user_id=${encodeURIComponent(profileId)}&serial_number=${encodeURIComponent(profileId)}${this.apiKeyParam('&')}`;
      const res = await axios.get(url, {
        timeout: this.timeout,
      });

      if (res.data && res.data.code === 0) {
        console.log(`[AdsPower] ✅ 프로필 중지 완료: ${profileId}`);
        return;
      }

      console.warn(`[AdsPower] ⚠️ 프로필 중지 응답: ${res.data?.msg || 'unknown'}`);
    } catch (error: any) {
      console.warn(`[AdsPower] ⚠️ 프로필 중지 실패 (무시): ${error.message}`);
    }
  }

  /**
   * 프로필 브라우저 활성 상태 확인
   */
  async checkProfileStatus(profileId: string): Promise<{ active: boolean }> {
    try {
      const url = `${this.baseUrl}/browser/active?user_id=${encodeURIComponent(profileId)}${this.apiKeyParam('&')}`;
      const res = await axios.get(url, { timeout: 5000 });

      if (res.data && res.data.code === 0) {
        return { active: res.data.data?.status === 'Active' };
      }

      return { active: false };
    } catch {
      return { active: false };
    }
  }
}
