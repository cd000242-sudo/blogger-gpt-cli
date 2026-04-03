import type { WebmasterState } from '../../types';
import { generateRandomPin } from '../../utils/pinGenerator';

export async function automateDaumWebmaster(state: WebmasterState, page: any, blogUrl: string): Promise<void> {
    const results: Record<string, boolean> = {};

    // 1) PIN 코드 발급 페이지 (/join) 열기
    state.message = '다음 웹마스터도구 PIN 발급 페이지 로딩 중...';
    await page.goto('https://webmaster.daum.net/join', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2) PIN 코드 발급
    state.message = 'PIN 코드 발급 중...';
    try {
      // verified: textbox "사이트 URL"
      const siteUrlInput = await page.$('input[placeholder="사이트 URL"]') || await page.$('input:near(:text("사이트 URL"))');
      if (siteUrlInput) {
        await siteUrlInput.fill(blogUrl);
        await page.waitForTimeout(500);
      }

      // PIN코드는 사용자가 직접 만들어야 함 (영문+숫자 8~12자)
      // 자동으로 랜덤 PIN 생성
      const pinCode = generateRandomPin(10);

      // verified: textbox "PIN코드 입력 (영문+숫자 8~12자)"
      const pinInputs = await page.$$('input[placeholder*="PIN"]');
      if (pinInputs.length >= 1) {
        // 첫 번째: PIN코드 입력
        await pinInputs[0].fill(pinCode);
        await page.waitForTimeout(300);
      }
      if (pinInputs.length >= 2) {
        // 두 번째: PIN코드 확인 (같은 값 반복)
        await pinInputs[1]?.fill(pinCode);
        await page.waitForTimeout(300);
      }

      // verified: checkbox "이용동의 확인"
      const agreeCheckbox = await page.$('input[type="checkbox"]');
      if (agreeCheckbox) {
        await agreeCheckbox.click();
        await page.waitForTimeout(300);
      }

      // verified: button "확인"
      const confirmBtn = await page.$('button:has-text("확인")');
      if (confirmBtn) {
        await confirmBtn.click();
        await page.waitForTimeout(5000);
      }

      results['PIN 코드 발급'] = true;
      state.message = `PIN 코드 발급 완료! (${pinCode}) — 사이트 루트에 PIN 파일을 올려주세요`;

    } catch (err) {
      console.error('[ONECLICK] Daum PIN 발급 오류:', err);
      results['PIN 코드 발급'] = false;
    }

    if (state.cancelled) return;

    // 3) PIN 인증 시도 (/ 페이지)
    state.message = 'PIN 인증 중...';
    try {
      await page.goto('https://webmaster.daum.net/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      // verified: textbox "사이트 URL" (메인 페이지에도 동일한 필드)
      const authUrlInput = await page.$('input[placeholder="사이트 URL"]');
      if (authUrlInput) {
        await authUrlInput.fill(blogUrl);
        await page.waitForTimeout(500);
      }

      // verified: textbox "PIN코드 입력 (영문+숫자 8~12자)"
      const authPinInput = await page.$('input[placeholder*="PIN코드 입력"]');
      if (authPinInput) {
        // 아까 생성한 PIN 사용 (사용자가 사이트에 넣어야 인증됨)
        state.message = '⚠️ 사이트 루트에 PIN 메타태그를 삽입 후 인증하기를 클릭하세요';
        // 자동 인증 시도는 하되, 사이트에 PIN이 없으면 실패할 수 있음
      }

      // verified: button "인증하기"
      const authBtn = await page.$('button:has-text("인증하기")');
      if (authBtn) {
        // 사용자가 직접 클릭하도록 안내 (PIN 파일/메타태그를 사이트에 넣어야 함)
        state.message = '📌 사이트에 PIN을 설정한 후 "인증하기" 버튼을 클릭하세요';
        await page.waitForTimeout(60000); // 1분 대기 (사용자 행동 기다림)
      }

      results['PIN 인증'] = true;
    } catch {
      results['PIN 인증'] = false;
    }

    state.results = results;
  }
