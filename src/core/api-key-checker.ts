import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
        model: 'gpt-5.4'
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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // 간단한 테스트 요청
      await model.generateContent('테스트');
      status.gemini = {
        valid: true,
        model: 'gemini-2.5-flash'
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

  // 네이버 API 키 확인
  if (payload.naverClientId && payload.naverClientSecret) {
    try {
      const response = await fetch('https://openapi.naver.com/v1/search/news.json?query=테스트&display=1', {
        headers: {
          'X-Naver-Client-Id': payload.naverClientId,
          'X-Naver-Client-Secret': payload.naverClientSecret
        }
      });

      if (response.ok) {
        status.naver = { valid: true };
        console.log('✅ 네이버 API 키 유효함');
      } else {
        status.naver = {
          valid: false,
          error: `네이버 API 오류 (${response.status})`
        };
        console.log('❌ 네이버 API 오류:', response.status);
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


