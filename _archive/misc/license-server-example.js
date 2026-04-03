/**
 * 라이선스 서버 예시 코드 (Node.js/Express)
 * 
 * 이 파일은 참고용 예시입니다.
 * 실제 라이선스 서버에 이 코드를 참고하여 구현하세요.
 * 
 * ✅ 중복 로그인 방지 기능 포함:
 * - 하나의 계정으로 동시에 여러 기기에서 로그인 불가
 * - 새 기기에서 로그인 시 기존 세션 자동 종료
 * - 세션 유효성 실시간 검증
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();

// CORS 설정 (클라이언트 앱에서 접근 가능하도록)
app.use(cors());
app.use(express.json());

// ============================================
// 세션 저장소 (실제 구현 시 Redis/DB 사용 권장)
// ============================================
const activeSessions = new Map(); // userId -> { sessionToken, deviceId, loginAt, appId }

/**
 * 세션 토큰 생성
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 디바이스 ID 생성 (클라이언트에서 전송한 정보 기반)
 */
function hashDeviceInfo(deviceInfo) {
  return crypto.createHash('sha256').update(JSON.stringify(deviceInfo)).digest('hex').slice(0, 32);
}

// ============================================
// 1. 서버 시간 API (필수)
// ============================================
app.get('/time', (req, res) => {
  // 현재 서버 시간을 밀리초 단위 Unix timestamp로 반환
  res.json({
    timestamp: Date.now()
  });
});

// ============================================
// 2. 라이선스 코드 검증 및 로그인 API (중복 로그인 방지 포함)
// ============================================
app.post('/redeem', async (req, res) => {
  try {
    const { code, userId, password, deviceId, appId } = req.body;
    
    // 여기에 실제 라이선스 코드 검증 로직 구현
    // 예시:
    // - 데이터베이스에서 코드 조회
    // - 사용자 인증 확인
    // - 코드 유효성 검증
    // - 기간제/영구제 타입 확인
    
    let licenseInfo = null;
    
    // 예시 응답 (기간제)
    if (code && code.startsWith('TEMP-')) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // 1개월 후 만료
      licenseInfo = {
        valid: true,
        type: 'temporary',
        expiresAt: expiresAt.toISOString()
      };
    }
    // 예시 응답 (영구제)
    else if (code && code.startsWith('PERM-')) {
      licenseInfo = {
        valid: true,
        type: 'permanent'
      };
    }
    // 검증 실패
    else {
      return res.status(400).json({
        valid: false,
        message: '유효하지 않은 라이선스 코드입니다.'
      });
    }
    
    // ✅ 중복 로그인 방지: 새 세션 생성 및 기존 세션 종료
    const sessionToken = generateSessionToken();
    const previousSession = activeSessions.get(userId);
    let previousSessionTerminated = false;
    
    if (previousSession && previousSession.deviceId !== deviceId) {
      // 다른 기기에서 로그인 중이었음 → 기존 세션 종료
      console.log(`[SESSION] 사용자 ${userId}의 기존 세션 종료 (기기: ${previousSession.deviceId})`);
      previousSessionTerminated = true;
    }
    
    // 새 세션 저장
    activeSessions.set(userId, {
      sessionToken,
      deviceId: deviceId || 'unknown',
      loginAt: Date.now(),
      appId: appId || 'unknown'
    });
    
    console.log(`[SESSION] 새 세션 생성 - 사용자: ${userId}, 기기: ${deviceId}`);
    
    res.json({
      ...licenseInfo,
      ok: true,
      sessionToken,
      previousSessionTerminated,
      message: previousSessionTerminated 
        ? '로그인 성공 (다른 기기에서 로그아웃됨)' 
        : '로그인 성공'
    });
    
  } catch (error) {
    console.error('[LICENSE-SERVER] 검증 오류:', error);
    res.status(500).json({
      valid: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 3. 세션 유효성 검증 API (중복 로그인 감지)
// ============================================
app.post('/session/validate', async (req, res) => {
  try {
    const { userId, sessionToken, appId } = req.body;
    
    if (!userId || !sessionToken) {
      return res.status(400).json({
        valid: false,
        code: 'INVALID_REQUEST',
        message: '필수 파라미터가 누락되었습니다.'
      });
    }
    
    const activeSession = activeSessions.get(userId);
    
    // 세션이 없음 (로그아웃됨 또는 만료됨)
    if (!activeSession) {
      return res.json({
        valid: false,
        code: 'SESSION_NOT_FOUND',
        message: '세션이 존재하지 않습니다. 다시 로그인해주세요.'
      });
    }
    
    // 세션 토큰 불일치 (다른 기기에서 로그인함)
    if (activeSession.sessionToken !== sessionToken) {
      console.log(`[SESSION] 세션 토큰 불일치 - 사용자: ${userId}`);
      return res.json({
        valid: false,
        code: 'SESSION_EXPIRED_BY_OTHER_LOGIN',
        message: '다른 기기에서 로그인되어 현재 세션이 종료되었습니다.'
      });
    }
    
    // 세션 유효
    res.json({
      valid: true,
      code: 'SESSION_VALID',
      message: '세션이 유효합니다.',
      loginAt: activeSession.loginAt
    });
    
  } catch (error) {
    console.error('[SESSION] 검증 오류:', error);
    res.status(500).json({
      valid: false,
      code: 'SERVER_ERROR',
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 4. 로그아웃 API (세션 명시적 종료)
// ============================================
app.post('/session/logout', async (req, res) => {
  try {
    const { userId, sessionToken } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: '사용자 ID가 필요합니다.'
      });
    }
    
    const activeSession = activeSessions.get(userId);
    
    // 세션 토큰이 일치하는 경우에만 로그아웃 (보안)
    if (activeSession && activeSession.sessionToken === sessionToken) {
      activeSessions.delete(userId);
      console.log(`[SESSION] 로그아웃 완료 - 사용자: ${userId}`);
      return res.json({
        ok: true,
        message: '로그아웃되었습니다.'
      });
    }
    
    res.json({
      ok: true,
      message: '이미 로그아웃된 상태입니다.'
    });
    
  } catch (error) {
    console.error('[SESSION] 로그아웃 오류:', error);
    res.status(500).json({
      ok: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 5. 활성 세션 조회 API (관리자용)
// ============================================
app.get('/session/active', async (req, res) => {
  try {
    // 실제 구현 시 관리자 인증 필요
    const sessions = [];
    activeSessions.forEach((session, odriverId) => {
      sessions.push({
        userId,
        deviceId: session.deviceId,
        loginAt: new Date(session.loginAt).toISOString(),
        appId: session.appId
      });
    });
    
    res.json({
      ok: true,
      count: sessions.length,
      sessions
    });
    
  } catch (error) {
    console.error('[SESSION] 조회 오류:', error);
    res.status(500).json({
      ok: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 서버 시작
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`라이선스 서버가 포트 ${PORT}에서 실행 중`);
  console.log('');
  console.log('📡 사용 가능한 API:');
  console.log(`  GET  /time              - 서버 시간`);
  console.log(`  POST /redeem            - 라이선스 등록 및 로그인`);
  console.log(`  POST /session/validate  - 세션 유효성 검증`);
  console.log(`  POST /session/logout    - 로그아웃`);
  console.log(`  GET  /session/active    - 활성 세션 조회`);
  console.log('');
  console.log(`🌐 http://localhost:${PORT}`);
});

// ============================================
// 테스트 예시
// ============================================
/*
// 1. 서버 시간 확인
curl http://localhost:3000/time

// 2. 라이선스 등록 및 로그인
curl -X POST http://localhost:3000/redeem \
  -H "Content-Type: application/json" \
  -d '{"code":"TEMP-2025","userId":"user1","password":"pass","deviceId":"device1","appId":"blogger-app"}'

// 3. 세션 유효성 검증
curl -X POST http://localhost:3000/session/validate \
  -H "Content-Type: application/json" \
  -d '{"userId":"user1","sessionToken":"YOUR_SESSION_TOKEN","appId":"blogger-app"}'

// 4. 다른 기기에서 로그인 (기존 세션 종료됨)
curl -X POST http://localhost:3000/redeem \
  -H "Content-Type: application/json" \
  -d '{"code":"TEMP-2025","userId":"user1","password":"pass","deviceId":"device2","appId":"blogger-app"}'

// 5. 이전 기기에서 세션 검증 시 실패 (SESSION_EXPIRED_BY_OTHER_LOGIN)
curl -X POST http://localhost:3000/session/validate \
  -H "Content-Type: application/json" \
  -d '{"userId":"user1","sessionToken":"OLD_SESSION_TOKEN","appId":"blogger-app"}'

// 6. 로그아웃
curl -X POST http://localhost:3000/session/logout \
  -H "Content-Type: application/json" \
  -d '{"userId":"user1","sessionToken":"YOUR_SESSION_TOKEN"}'
*/






