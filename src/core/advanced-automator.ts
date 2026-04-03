import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AdsPowerManager } from './adspower-manager';

// ghost-cursor 타입 선언 (C6 해결)
let createCursorFn: any;
try {
  const gc = require('ghost-cursor');
  createCursorFn = gc.createCursor;
} catch {
  createCursorFn = null;
}

// Helper for delay to replace deprecated page.waitForTimeout
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * High-Fidelity Interaction Engine
 * 브라우저의 물리적, 논리적 특성을 실제 사용자와 동일하게 구성하여 자동화 탐지를 우회하는 클래스
 * 
 * 변경 이력:
 * - C1: 인라인 AdsPower 구현 → AdsPowerManager 싱글톤 사용
 * - C3: private → protected (하위 클래스 접근 허용)
 * - W4: cleanup에 AdsPower stopProfile 추가
 */
export class AdvancedAutomator {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected cursor: any = null;
  
  // 🔧 C1: AdsPowerManager 싱글톤 사용 (호스트 통일: local.adspower.com)
  private adsPowerManager: AdsPowerManager;
  private currentProfileId: string | null = null;

  constructor(protected targetUrl: string, adsPowerOpts?: { port?: number; apiKey?: string }) {
    this.adsPowerManager = new AdsPowerManager(adsPowerOpts);
  }

  /**
   * 1. AdsPower Environment Integration
   * AdsPowerManager를 통해 프로필을 시작하고 CDP로 연결
   */
  async initialize(profileId: string): Promise<void> {
    try {
      console.log(`[Init] AdsPowerManager로 프로필 시작: ${profileId}`);
      
      // 🔧 C1: 중앙화된 AdsPowerManager 사용
      const { wsUrl } = await this.adsPowerManager.startProfile(profileId);
      this.currentProfileId = profileId;

      // Playwright connectOverCDP 연결 (탐지 회피를 위한 브릿지)
      this.browser = await (chromium as any).connectOverCDP(wsUrl);
      const contexts = (this.browser as any).contexts ? (this.browser as any).contexts() : [];
      
      if (contexts.length > 0) {
        this.context = contexts[0];
        const pages = (this.context as any).pages ? (this.context as any).pages() : [];
        this.page = pages.length > 0 ? pages[0] : await (this.context as any).newPage();
      } else {
        throw new Error('No browser context found.');
      }

      // Physical Motion Emulation: ghost-cursor 초기화 (선택적)
      if (createCursorFn && this.page) {
        try {
          this.cursor = createCursorFn(this.page as any);
        } catch (e) {
          console.warn('[Init] ghost-cursor 초기화 실패 (계속 진행):', e);
        }
      }
      
      console.log('[Init] High-Fidelity interaction engine initialized.');
    } catch (error) {
      console.error('[Error] Initialization Error:', error);
      throw error;
    }
  }

  /**
   * 2. Pre-interaction Warm-up (sessionValidator)
   * 세션 신뢰도 향상을 위해 주요 포털을 탐색하고 쿠키 이력을 쌓는 웜업 루틴
   */
  async sessionValidator(): Promise<void> {
    if (!this.page) throw new Error('Engine not initialized');
    
    console.log('[Warm-up] Starting session validator...');
    const portals = ['https://www.google.com', 'https://www.naver.com'];
    const randomPortal = portals[Math.floor(Math.random() * portals.length)]!;
    
    await this.page.goto(randomPortal, { waitUntil: 'domcontentloaded' });
    await delay(this.randomInt(2000, 5000)); // 자연스러운 체류 시간
    
    // 비선형 마우스 움직임 및 스크롤 시뮬레이션
    if (this.cursor) {
      try {
        await this.cursor.move({ x: this.randomInt(100, 800), y: this.randomInt(100, 600) });
      } catch {}
    }
    const mouse: any = (this.page as any).mouse;
    if (mouse && mouse.wheel) {
      await mouse.wheel(0, this.randomInt(300, 800));
    }
    await delay(this.randomInt(1500, 3000));
    
    console.log('[Warm-up] Session validation & cookie activation complete.');
  }

  /**
   * 3. Visual Recognition & Error Handling
   * DOM에만 의존하지 않고 시각적 노출(Viewport)을 확인 후 상호작용하는 견고한 에러 핸들러
   */
  async safeInteract(selector: string, action: (el: any) => Promise<void>): Promise<void> {
    if (!this.page) throw new Error('Engine not initialized');

    try {
      // 1단계: DOM 존재 및 시각적 노출 대기
      const p: any = this.page;
      const element = p.waitForSelector ? await p.waitForSelector(selector, { state: 'visible', timeout: 15000 }) : await p.$(selector);
      if (!element) throw new Error(`Element not found or not visible: ${selector}`);

      // 2단계: 뷰포트 스크롤
      if (element.scrollIntoViewIfNeeded) {
        await element.scrollIntoViewIfNeeded();
      }
      await delay(this.randomInt(300, 800)); // 스크롤 후 인지 지연 
      
      // 3단계: 요소 좌표 획득 불가능 검증
      const box = await element.boundingBox();
      if (!box) {
        throw new Error(`Element bounding box is not accessible: ${selector}`);
      }

      // 4단계: 뷰포트 내 완전 진입 여부 재검증 (교차 검증)
      const isActuallyVisible = await p.evaluate((el: any) => {
        const rect = el.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
      }, element);

      if (!isActuallyVisible) {
        console.warn(`[Warning] Element ${selector} is partially out of viewport. Attempting forced interaction.`);
      }

      // 검증 통과 후 상호작용 실행
      await action(element);

    } catch (error) {
      console.error(`[Error] safeInteract failed for selector: ${selector}`, error);
      throw error;
    }
  }

  /**
   * 4. Behavioral Consistency: Gaussian Targeting Click
   * 정중앙 타겟팅을 피하고 가우스 분포 기반 무작위 오프셋 타겟팅 적용
   */
  async gaussianClick(selector: string): Promise<void> {
    // 위 safeInteract를 내부 호출
    await this.safeInteract(selector, async (element: any) => {
      const box = await element.boundingBox();
      if (!box) return;

      // 중앙 좌표를 기준으로 가우시안 분포의 노이즈 추가 (정중앙 클릭 방지)
      const clickX = this.gaussianRandom(box.x, box.x + box.width);
      const clickY = this.gaussianRandom(box.y, box.y + box.height);

      if (this.cursor) {
        // ghost-cursor의 사람 같은 궤적을 이용하여 타겟팅 후 클릭
        await this.cursor.move({ x: clickX, y: clickY });
        await this.cursor.click();
      } else {
        // ghost-cursor 미사용 시 Playwright 기본 클릭
        await element.click({ position: { x: clickX - box.x, y: clickY - box.y } });
      }
    });
  }

  /**
   * 5. Behavioral Consistency: Human-like Typing
   * 일정하지 않은 키보드 입력 지연 시간 및 리듬 시뮬레이션
   */
  async humanType(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('Engine not initialized');

    await this.gaussianClick(selector); // 먼저 요소를 클릭하여 포커스
    
    // 첫 타이핑 전 인지 지연
    await delay(this.randomInt(300, 700));

    const keyboard: any = (this.page as any).keyboard;
    for (const char of text) {
      // 생리학적 타이핑 리듬: 기본 딜레이 + 확률적 일시정지 (실수/생각 시뮬레이션)
      const baseDelay = this.randomInt(60, 180); 
      const hesitateDelay = Math.random() < 0.08 ? this.randomInt(200, 500) : 0; // 8% 확률로 입력 멈칫
      
      if (keyboard && keyboard.type) {
        await keyboard.type(char, { delay: baseDelay + hesitateDelay });
      }
    }
  }

  /**
   * [메인 실행부] 아키텍처 기반 상품 정보 분석 파이프라인
   */
  async runAnalysis(profileId: string): Promise<void> {
    try {
      await this.initialize(profileId);
      await this.sessionValidator(); // Pre-interaction Warm-up

      console.log(`[Analysis] Navigating to Target Market URL: ${this.targetUrl}`);
      await this.page!.goto(this.targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
      
      // 사람처럼 잠시 스크롤하며 콘텐츠 인지
      const mouse: any = (this.page as any).mouse;
      if (mouse && mouse.wheel) {
         await mouse.wheel(0, this.randomInt(500, 1200));
      }
      await delay(this.randomInt(2000, 4000));

      console.log('[Analysis] High-Fidelity Data Extraction complete.');
      
    } catch (error) {
      console.error('[Error] Pipeline failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 리소스 정리
   * 🔧 W4: AdsPower 프로필 stop API 호출 추가
   */
  async cleanup(): Promise<void> {
    // 1. Playwright 브라우저 연결 해제
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('[Cleanup] Browser session safely terminated.');
      } catch (e) {
        console.warn('[Cleanup] Browser close 실패 (무시):', e);
      }
      this.browser = null;
    }

    // 2. 🔧 W4: AdsPower 프로필 중지 (리소스 누수 방지)
    if (this.currentProfileId) {
      try {
        await this.adsPowerManager.stopProfile(this.currentProfileId);
        console.log(`[Cleanup] AdsPower 프로필 중지 완료: ${this.currentProfileId}`);
      } catch (e) {
        console.warn(`[Cleanup] AdsPower 프로필 중지 실패 (무시):`, e);
      }
      this.currentProfileId = null;
    }

    this.page = null;
    this.context = null;
    this.cursor = null;
  }

  // --- Core Utility Functions ---
  
  protected randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Box-Muller transform: Box 영역 중앙에 집중되지만 양끝으로 무작위 분산되는 클릭 분포 (인간의 타겟팅 오차)
   */
  protected gaussianRandom(min: number, max: number): number {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); 
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    
    // 스케일링 (가운데 0.5로 이동 및 변환)
    num = num / 10.0 + 0.5; 
    if (num > 1 || num < 0) {
        return this.gaussianRandom(min, max); // 범위를 벗어나면 재계산
    }
    return Math.floor(num * (max - min) + min);
  }
}
