/**
 * Google Apps Script에 추가할 doGet 함수
 * 
 * 기존 doPost 함수 아래에 이 전체 함수를 복사해서 붙여넣으세요.
 */

function doGet(e) {
  try {
    // 서버 시간 API: /time 엔드포인트
    // Google Apps Script는 쿼리 파라미터로 경로를 전달
    const path = (e.parameter && e.parameter.path) || (e.pathInfo) || '';
    
    // /time 경로 처리 (또는 경로가 없으면 기본으로 시간 반환)
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






