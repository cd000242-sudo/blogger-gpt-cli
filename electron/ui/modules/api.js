// 🔧 백엔드 API 통신 래퍼
import { getErrorHandler, addLog, debugLog } from './core.js';

// 백엔드 API 호출 래퍼
export async function callBackendAPI(endpoint, data = {}) {
  try {
    debugLog('API', `백엔드 호출: ${endpoint}`, data);
    
    if (!window.blogger || !window.blogger[endpoint]) {
      throw new Error(`백엔드 API를 찾을 수 없습니다: ${endpoint}`);
    }
    
    const result = await window.blogger[endpoint](data);
    
    if (result && result.ok) {
      debugLog('API', `백엔드 응답 성공: ${endpoint}`, result);
      return result;
    } else {
      throw new Error(result?.error || `백엔드 호출 실패: ${endpoint}`);
    }
  } catch (error) {
    getErrorHandler().handle(error, {
      function: 'callBackendAPI',
      endpoint: endpoint
    });
    throw error;
  }
}

// 포스팅 실행
export async function runPost(payload) {
  return await callBackendAPI('runPost', payload);
}

// 환경 변수 가져오기
export async function getEnv() {
  return await callBackendAPI('getEnv');
}

// 환경 변수 저장
export async function saveEnv(envData) {
  return await callBackendAPI('saveEnv', envData);
}

// 라이선스 파일 읽기
export async function readLicenseFile() {
  return await callBackendAPI('readLicenseFile');
}

// 라이선스 파일 쓰기
export async function writeLicenseFile(licenseData) {
  return await callBackendAPI('writeLicenseFile', licenseData);
}

// 백업 생성
export async function createBackup() {
  return await callBackendAPI('createBackup');
}

// 백업 복원
export async function restoreBackup() {
  return await callBackendAPI('restoreBackup');
}

// 엑셀 배치 처리
export async function runExcelBatch(batchData) {
  return await callBackendAPI('runExcelBatch', batchData);
}

// 엑셀 결과 다운로드
export async function downloadExcelResults() {
  return await callBackendAPI('downloadExcelResults');
}

// WordPress 카테고리 로드
export async function loadWordPressCategories() {
  return await callBackendAPI('loadWordPressCategories');
}

// Blogger OAuth URL 가져오기
export async function getBloggerAuthUrl() {
  return await callBackendAPI('getBloggerAuthUrl');
}

// Blogger 인증 상태 확인
export async function checkBloggerAuthStatus() {
  return await callBackendAPI('checkBloggerAuthStatus');
}

// WordPress 인증 상태 확인
export async function checkWordPressAuthStatus() {
  if (window.electronAPI && window.electronAPI.checkWordPressAuthStatus) {
    return await window.electronAPI.checkWordPressAuthStatus();
  }
  throw new Error('WordPress 인증 API를 찾을 수 없습니다.');
}

// CSE 연결 테스트
export async function testCseConnection(key, cx) {
  if (window.blogger && window.blogger.testCseConnection) {
    return await window.blogger.testCseConnection(key, cx);
  }
  throw new Error('CSE 연결 테스트 API를 찾을 수 없습니다.');
}

// 외부 링크 열기
export function openExternal(url) {
  if (window.blogger && window.blogger.openExternal) {
    window.blogger.openExternal(url);
  } else if (window.electronAPI && window.electronAPI.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

// 로그 리스너 등록
export function onLog(callback) {
  if (window.blogger && window.blogger.onLog) {
    window.blogger.onLog(callback);
  }
}

// 진행 상황 리스너 등록
export function onProgress(callback) {
  if (window.blogger && window.blogger.onProgress) {
    window.blogger.onProgress(callback);
  }
}




