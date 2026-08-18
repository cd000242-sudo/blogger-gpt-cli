import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveNaverCredentials, naverSearch, describeNaverFailure } from './naver-search-client';

export interface ApiKeyStatus {
  openai: {
    valid: boolean;
    error?: string;
    model?: string;
  };
  gemini: {
    valid: boolean;
    error?: string;
    model?: string;
  };
  naver: {
    valid: boolean;
    error?: string;
  };
  googleCse: {
    valid: boolean;
    error?: string;
  };
}

/**
 * v3.8.525 — 네이버 API 실패를 "처방까지" 알려준다.
 *
 * 2026-06-25 NAVER API HUB(네이버클라우드) 출시로 검색 API·Search Trend 가 이관됐다.
 * 쇼핑·책·전문자료 검색은 2026-07-31 완전 종료(대체 없음), 이관 신청자만
 * 기존 방식을 2027-06-30 까지 쓸 수 있다.
 * 예전엔 `네이버 API 오류 (401)` 만 띄워서 사용자가 할 수 있는 게 없었다 —
 * 상태코드마다 무엇이 문제이고 어디로 가야 하는지 적어 준다.
 */
export function describeNaverApiFailure(httpStatus: number): string {
  // v3.8.526: 문구는 중앙 창구(naver-search-client) 한 곳에서만 만든다.
  return describeNaverFailure(httpStatus, resolveNaverCredentials().mode);
}

export async function checkApiKeys(payload: any): Promise<ApiKeyStatus> {
  const status: ApiKeyStatus = {
    openai: { valid: false },
    gemini: { valid: false },
    naver: { valid: false },
    googleCse: { valid: false }
  };

  // OpenAI API 키 확인
  if (payload.openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: payload.openaiKey });
      await openai.models.list();
      status.openai = {
        valid: true,
        model: 'gpt-5.6-terra'
      };
      console.log('✅ OpenAI API 키 유효함');
    } catch (error: any) {
      status.openai = {
        valid: false,
        error: error.message || 'OpenAI API 키가 유효하지 않습니다.'
      };
      console.log('❌ OpenAI API 키 오류:', error.message);
    }
  } else {
    status.openai = {
      valid: false,
      error: 'OpenAI API 키가 설정되지 않았습니다.'
    };
    console.log('⚠️ OpenAI API 키 미설정');
  }

  // Gemini API 키 확인
  if (payload.geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(payload.geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

      // 간단한 테스트 요청
      await model.generateContent('테스트');
      status.gemini = {
        valid: true,
        model: 'gemini-3.5-flash'
      };
      console.log('✅ Gemini API 키 유효함');
    } catch (error: any) {
      status.gemini = {
        valid: false,
        error: error.message || 'Gemini API 키가 유효하지 않습니다.'
      };
      console.log('❌ Gemini API 키 오류:', error.message);
    }
  } else {
    status.gemini = {
      valid: false,
      error: 'Gemini API 키가 설정되지 않았습니다.'
    };
    console.log('⚠️ Gemini API 키 미설정');
  }

  /**
   * v3.8.526 — 네이버 키 점검도 중앙 창구(naver-search-client)로 나간다.
   * 여기서 URL·헤더를 따로 조립하면 HUB 키를 넣어도 점검만 옛 주소로 가서
   * "키가 틀렸다"는 엉뚱한 진단이 나온다 (배선이 두 벌이면 반드시 어긋난다).
   */
  const naverCred = resolveNaverCredentials(payload);
  if (naverCred.mode !== 'none') {
    try {
      const probe = await naverSearch('news', { query: '테스트', display: 1 }, { payload });
      if (probe.ok) {
        status.naver = { valid: true };
        console.log(`✅ 네이버 API 키 유효함 (${probe.mode === 'hub' ? 'API HUB' : '기존 키'})`);
      } else {
        status.naver = { valid: false, error: probe.error || '네이버 API 오류' };
        console.log('❌ 네이버 API 오류:', probe.error);
      }
    } catch (error: any) {
      status.naver = {
        valid: false,
        error: error.message || '네이버 API 키가 유효하지 않습니다.'
      };
      console.log('❌ 네이버 API 키 오류:', error.message);
    }
  } else {
    status.naver = {
      valid: false,
      error: '네이버 API 키가 설정되지 않았습니다.'
    };
    console.log('⚠️ 네이버 API 키 미설정');
  }

  // Google CSE API 키 확인
  if (payload.googleCseKey && payload.googleCseCx) {
    try {
      const testUrl = `https://www.googleapis.com/customsearch/v1?key=${payload.googleCseKey}&cx=${payload.googleCseCx}&q=테스트`;
      const response = await fetch(testUrl);

      if (response.ok) {
        status.googleCse = { valid: true };
        console.log('✅ Google CSE API 키 유효함');
      } else {
        status.googleCse = {
          valid: false,
          error: `Google CSE API 오류 (${response.status})`
        };
        console.log('❌ Google CSE API 오류:', response.status);
      }
    } catch (error: any) {
      status.googleCse = {
        valid: false,
        error: error.message || 'Google CSE API 키가 유효하지 않습니다.'
      };
      console.log('❌ Google CSE API 키 오류:', error.message);
    }
  } else {
    status.googleCse = {
      valid: false,
      error: 'Google CSE API 키가 설정되지 않았습니다.'
    };
    console.log('⚠️ Google CSE API 키 미설정');
  }

  return status;
}

export function getApiKeySummary(status: ApiKeyStatus): string {
  const summary = [];

  if (status.openai.valid) {
    summary.push(`✅ OpenAI: ${status.openai.model}`);
  } else {
    summary.push(`❌ OpenAI: ${status.openai.error}`);
  }

  if (status.gemini.valid) {
    summary.push(`✅ Gemini: ${status.gemini.model}`);
  } else {
    summary.push(`❌ Gemini: ${status.gemini.error}`);
  }

  if (status.naver.valid) {
    summary.push('✅ 네이버 API');
  } else {
    summary.push(`❌ 네이버 API: ${status.naver.error}`);
  }

  if (status.googleCse.valid) {
    summary.push('✅ Google CSE');
  } else {
    summary.push(`❌ Google CSE: ${status.googleCse.error}`);
  }

  return summary.join('\n');
}

