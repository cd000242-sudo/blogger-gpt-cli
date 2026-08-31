/**
 * 속도 하네스의 계산부 — 브라우저 없이 도는 순수 함수만 모았다.
 *
 * 왜 따로 뺐나: 측정값을 해석하는 로직(중앙값·증감·합격판정)이 틀리면
 * 측정 자체가 거짓말이 된다. "0건"이 검사기 고장인 적이 있었으므로,
 * 계산부는 브라우저 없이 테스트로 못박아 둔다.
 */

/** 표본 중 가운데 값. 평균이 아니라 중앙값을 쓰는 이유: 한 번의 네트워크 딸꾹질이 평균을 통째로 망친다. */
function median(nums) {
  const xs = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** 구글 Core Web Vitals 기준. 낮을수록 좋은 지표만 다룬다. */
const THRESHOLDS = Object.freeze({
  ttfb: { good: 800, ok: 1800, unit: 'ms', label: 'TTFB (첫 바이트)' },
  fcp: { good: 1800, ok: 3000, unit: 'ms', label: 'FCP (글자 보임)' },
  lcp: { good: 2500, ok: 4000, unit: 'ms', label: 'LCP (주요 화면)' },
  cls: { good: 0.1, ok: 0.25, unit: '', label: 'CLS (화면 밀림)' },
  connectMs: { good: 50, ok: 150, unit: 'ms', label: 'TCP 연결' },
  tlsMs: { good: 100, ok: 300, unit: 'ms', label: 'TLS 악수' },
  totalKB: { good: 500, ok: 1500, unit: 'KB', label: '전송량' },
  requests: { good: 40, ok: 80, unit: '개', label: '요청 수' },
});

/** 값 하나를 good / ok / bad 로 판정. 기준이 없는 지표는 null. */
function verdict(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t || typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= t.good) return 'good';
  if (value <= t.ok) return 'ok';
  return 'bad';
}

/** 여러 번 잰 것을 지표별 중앙값 하나로 접는다. */
function summarize(runs) {
  const keys = Object.keys(THRESHOLDS);
  const out = {};
  for (const k of keys) {
    const v = median(runs.map((r) => r[k]));
    if (v !== null) out[k] = k === 'cls' ? Number(v.toFixed(4)) : Math.round(v);
  }
  return { ...out, samples: runs.length };
}

/**
 * 기준선 대비 증감. 낮을수록 좋은 지표들이므로 줄면 improved.
 * 0 에서 0 이 아닌 값으로 바뀐 경우 퍼센트가 무한대가 되므로 null 로 둔다.
 */
function compare(before, after) {
  const rows = [];
  for (const metric of Object.keys(THRESHOLDS)) {
    const b = before?.[metric];
    const a = after?.[metric];
    if (typeof b !== 'number' || typeof a !== 'number') continue;
    const delta = a - b;
    const pct = b === 0 ? null : Number(((delta / b) * 100).toFixed(1));
    rows.push({
      metric,
      label: THRESHOLDS[metric].label,
      unit: THRESHOLDS[metric].unit,
      before: b,
      after: a,
      delta: Number(delta.toFixed(4)),
      pct,
      improved: delta < 0,
      unchanged: delta === 0,
      verdictBefore: verdict(metric, b),
      verdictAfter: verdict(metric, a),
    });
  }
  return rows;
}

/**
 * 호스트별 바이트를 "우리 것 / 폰트 / 광고·분석 / 기타" 로 나눈다.
 * 무엇을 줄여야 하는지는 총량이 아니라 이 구성이 알려준다.
 */
function classifyHosts(byHost, ownHost) {
  const buckets = { own: { KB: 0, count: 0 }, font: { KB: 0, count: 0 }, ads: { KB: 0, count: 0 }, other: { KB: 0, count: 0 } };
  const FONT = /jsdelivr|fonts\.(googleapis|gstatic)|cdn\.jsdelivr/i;
  const ADS = /googlesyndication|googletagmanager|doubleclick|adtrafficquality|google-analytics|analytics\.google|pixel\.wp\.com|google\.co|google\.com/i;
  for (const [host, v] of Object.entries(byHost || {})) {
    const kind = !host ? 'other'
      : host.includes(ownHost) ? 'own'
      : FONT.test(host) ? 'font'
      : ADS.test(host) ? 'ads'
      : 'other';
    buckets[kind] = { KB: buckets[kind].KB + (v.KB || 0), count: buckets[kind].count + (v.count || 0) };
  }
  return buckets;
}

module.exports = { median, summarize, compare, verdict, classifyHosts, THRESHOLDS };
