/**
 * Google Apps Script에 서버 시간 API 추가
 * 
 * 기존 doPost 함수 아래에 이 doGet 함수를 추가하세요.
 */

/** ===================== GET 요청 처리 (서버 시간 API) ===================== **/
function doGet(e) {
  try {
    // 서버 시간 API: /time 엔드포인트
    // 경로는 e.parameter.path 또는 e.pathInfo로 확인 가능
    const path = (e.parameter && e.parameter.path) || (e.pathInfo) || '';
    
    // /time 경로 처리
    if (path === 'time' || !path) {
      // 현재 서버 시간을 밀리초 단위 Unix timestamp로 반환
      return ContentService.createTextOutput(JSON.stringify({
        timestamp: Date.now()
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 알 수 없는 경로
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'unknown_path'
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log('doGet error: %s', err && err.stack || err);
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: String(err && err.message || err)
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 사용 방법:
 * 
 * 1. Google Apps Script 편집기에서 기존 코드의 doPost 함수 아래에 위 doGet 함수를 추가
 * 
 * 2. 웹 앱으로 배포:
 *    - "배포" > "새 배포" > "유형: 웹 앱"
 *    - 실행 사용자: "나"
 *    - 액세스 권한: "모든 사용자"
 *    - 배포 후 URL을 복사
 * 
 * 3. 클라이언트 앱에서 사용:
 *    - LICENSE_SERVER_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
 *    - 서버 시간 API: {LICENSE_SERVER_URL}?path=time
 *    - 또는: {LICENSE_SERVER_URL}/time (경로 설정에 따라)
 * 
 * 4. 테스트:
 *    - 브라우저에서 직접 접속: https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?path=time
 *    - 응답: {"timestamp":1234567890123}
 */






