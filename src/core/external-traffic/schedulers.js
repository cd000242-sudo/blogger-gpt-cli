// src/core/external-traffic/schedulers.js
// 백그라운드 주기 작업:
//   1) 자동 캘리브레이션 — 피드백 100+ 누적 시 임계값 권고 갱신 (1일 1회)
//   2) 90일 재검증 — lastVerified > 90일 채널 알림 (주 1회)
//   3) 사용 로그 자동 prune — 90일 초과 비-consent 레코드 삭제 (1일 1회)

'use strict';

const dispatcher = require('./index');
const calibration = require('./calibration');
const usageLog = require('./_shared/usage-log');
const secure = require('./_shared/secure-store');

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const REVALIDATE_THRESHOLD_DAYS = 90;
const STATE_KEY = 'scheduler-state';

function _now() { return Date.now(); }

function _loadState() {
  return secure.secureRead(STATE_KEY) || {
    lastCalibration: 0,
    lastPrune: 0,
    lastRevalidationCheck: 0,
    revalidationAlerts: [],
  };
}

function _saveState(state) {
  secure.secureWrite(STATE_KEY, state);
}

/**
 * 자동 캘리브레이션 1회 실행.
 * @returns {{ updated: number, channels: any[] }}
 */
function runCalibration() {
  const channelIds = dispatcher.listChannels().map((c) => c.id);
  const recs = calibration.computeAll(channelIds);
  const eligible = recs.filter((r) => r.eligible);
  if (eligible.length > 0) {
    calibration.persistRecommendations(eligible);
  }
  const state = _loadState();
  state.lastCalibration = _now();
  _saveState(state);
  return { updated: eligible.length, channels: eligible };
}

/**
 * lastVerified > 90일 채널 식별 → 알림 큐에 추가.
 * @returns {{ stale: string[] }}
 */
function runRevalidationCheck() {
  const cutoff = _now() - REVALIDATE_THRESHOLD_DAYS * MS_PER_DAY;
  const stale = [];
  for (const meta of dispatcher.listChannels()) {
    const channel = dispatcher.getChannel(meta.id);
    const verified = channel && channel.lastVerified;
    if (!verified) continue;
    const ts = new Date(verified).getTime();
    if (Number.isFinite(ts) && ts < cutoff) {
      stale.push(meta.id);
    }
  }
  const state = _loadState();
  state.lastRevalidationCheck = _now();
  state.revalidationAlerts = stale;
  _saveState(state);
  return { stale };
}

function runPrune() {
  const result = usageLog.pruneOldLogs();
  const state = _loadState();
  state.lastPrune = _now();
  _saveState(state);
  return result;
}

/**
 * 모든 주기 작업을 적절한 간격에서 실행 — 다음 호출까지의 ms 반환.
 * 앱 시작 시 1회 + 6시간 간격 호출 권장.
 * @returns {Object} 실행 요약
 */
function runDueJobs() {
  const state = _loadState();
  const now = _now();
  const out = { ranCalibration: false, ranPrune: false, ranRevalidationCheck: false };

  // 캘리브레이션 — 24시간 간격
  if (now - (state.lastCalibration || 0) >= MS_PER_DAY) {
    try {
      const cr = runCalibration();
      out.ranCalibration = true;
      out.calibrationUpdated = cr.updated;
    } catch (e) {
      out.calibrationError = e && e.message;
    }
  }

  // 프룬 — 24시간 간격
  if (now - (state.lastPrune || 0) >= MS_PER_DAY) {
    try {
      const pr = runPrune();
      out.ranPrune = true;
      out.pruneRemoved = pr.removed;
    } catch (e) {
      out.pruneError = e && e.message;
    }
  }

  // 재검증 체크 — 7일 간격
  if (now - (state.lastRevalidationCheck || 0) >= 7 * MS_PER_DAY) {
    try {
      const rr = runRevalidationCheck();
      out.ranRevalidationCheck = true;
      out.staleChannels = rr.stale;
    } catch (e) {
      out.revalidationError = e && e.message;
    }
  }

  return out;
}

function getState() {
  return _loadState();
}

function clearState() {
  secure.secureDelete(STATE_KEY);
}

let _timer = null;

/**
 * Electron app.whenReady() 직후 호출.
 * 시작 5초 후 1회 + 6시간 간격으로 반복.
 *
 * @param {{ onLog?: (msg: string) => void }} [opts]
 * @returns {() => void} stop function
 */
function startScheduler(opts) {
  if (_timer) return () => stopScheduler();
  const log = (opts && opts.onLog) || ((msg) => console.log('[EXT-TRAFFIC SCHED]', msg));
  const TICK = 6 * MS_PER_HOUR;
  let kicked = false;

  function tick() {
    try {
      const summary = runDueJobs();
      const did = Object.entries(summary).filter(([k, v]) => k.startsWith('ran') && v).map(([k]) => k);
      if (did.length > 0) log(`스케줄러 실행: ${did.join(', ')}`);
    } catch (e) {
      log(`스케줄러 오류: ${e && e.message}`);
    }
  }

  // 시작 5초 후 1회 (앱 부팅 안정화 대기), 이후 6시간 간격
  const initial = setTimeout(() => {
    if (!kicked) {
      kicked = true;
      tick();
      _timer = setInterval(tick, TICK);
      try { if (_timer && _timer.unref) _timer.unref(); } catch {}
    }
  }, 5000);
  try { if (initial && initial.unref) initial.unref(); } catch {}

  return () => stopScheduler();
}

function stopScheduler() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = {
  runCalibration,
  runRevalidationCheck,
  runPrune,
  runDueJobs,
  startScheduler,
  stopScheduler,
  getState,
  clearState,
  REVALIDATE_THRESHOLD_DAYS,
};
