"""
라이선스 서버 예시 코드 (Python/Flask)

이 파일은 참고용 예시입니다.
실제 라이선스 서버에 이 코드를 참고하여 구현하세요.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)  # CORS 설정 (클라이언트 앱에서 접근 가능하도록)

# ============================================
# 1. 서버 시간 API (필수)
# ============================================
@app.route('/time', methods=['GET'])
def get_time():
    """서버의 현재 시간을 반환"""
    return jsonify({
        'timestamp': int(time.time() * 1000)  # 밀리초 단위
    })

# ============================================
# 2. 라이선스 코드 검증 API (기존)
# ============================================
@app.route('/redeem', methods=['POST'])
def redeem_license():
    """라이선스 코드 검증 및 등록"""
    try:
        data = request.get_json()
        code = data.get('code')
        user_id = data.get('userId')
        password = data.get('password')
        
        # 여기에 실제 라이선스 코드 검증 로직 구현
        # 예시:
        # - 데이터베이스에서 코드 조회
        # - 사용자 인증 확인
        # - 코드 유효성 검증
        # - 기간제/영구제 타입 확인
        
        # 예시 응답 (기간제)
        if code and code.startswith('TEMP-'):
            # 기간제 코드 검증 로직
            expires_at = datetime.now() + timedelta(days=30)  # 30일 후 만료
            
            return jsonify({
                'valid': True,
                'type': 'temporary',
                'expiresAt': expires_at.isoformat()
            })
        # 예시 응답 (영구제)
        elif code and code.startswith('PERM-'):
            return jsonify({
                'valid': True,
                'type': 'permanent'
            })
        # 검증 실패
        else:
            return jsonify({
                'valid': False,
                'message': '유효하지 않은 라이선스 코드입니다.'
            }), 400
            
    except Exception as e:
        print(f'[LICENSE-SERVER] 검증 오류: {e}')
        return jsonify({
            'valid': False,
            'message': '서버 오류가 발생했습니다.'
        }), 500

# ============================================
# 서버 시작
# ============================================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f'라이선스 서버가 포트 {port}에서 실행 중')
    print(f'서버 시간 API: http://localhost:{port}/time')
    print(f'라이선스 검증 API: http://localhost:{port}/redeem')
    app.run(host='0.0.0.0', port=port)

# ============================================
# 테스트
# ============================================
# curl http://localhost:3000/time
# 응답: {"timestamp":1234567890123}






