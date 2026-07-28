// src/core/final/engine-lock.ts
// 🛡️ 텍스트 엔진 직렬화 락 + 대기자 워치독 (v3.8.380 R5)
//
// 설계 결정: "강제 해제"가 아니라 "대기자 타임아웃"이다.
//   강제 해제는 멈춘 보유자와 새 작업을 동시에 실행시켜 process.env 오염
//   (PRIMARY_TEXT_MODEL, DISABLE_GEMINI_GROUNDING 등)을 일으킨다.
//   대기자 타임아웃은 직렬성을 보존하면서 "조용한 무한 대기"를 "보이는 실패"로 바꾼다.
//
// 핵심 불변식 (engine-lock.test.ts가 고정):
//   타임아웃으로 탈락한 대기자가 체인을 끊으면 안 된다 — 뒤 대기자는 여전히
//   원래 보유자의 해제를 기다린다. 안 그러면 몰래 동시 실행이 생긴다.

let chain: Promise<void> = Promise.resolve();
let heldSince = 0;
let heldLabel = '';

const DEFAULT_WAIT_LIMIT_MS = 60 * 60_000; // 60분 — 정상 생성 최장(큐 타임아웃 45분) + 여유

function resolveWaitLimitMs(): number {
  const raw = process.env['ENGINE_LOCK_WAIT_MS'];
  if (raw === '0') return 0; // 킬스위치: 무제한 대기 (이전 동작)
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_WAIT_LIMIT_MS;
}

/**
 * 엔진 락을 획득한다. 반환된 함수를 호출하면 해제된다 (이중 호출 무해).
 * 대기가 상한(기본 60분)을 넘으면 ENGINE_LOCK_TIMEOUT 에러를 던진다 —
 * 이때 체인은 보존되어 뒤 대기자는 원래 보유자를 계속 기다린다.
 */
export async function acquireEngineLock(label = ''): Promise<() => void> {
  const waitLimitMs = resolveWaitLimitMs();

  let release: () => void = () => { /* assigned below */ };
  let released = false;
  const next = new Promise<void>(resolve => {
    release = () => {
      if (released) return; // 이중 해제 무해 — 다음 보유자의 락을 건드리지 않는다
      released = true;
      heldSince = 0;
      heldLabel = '';
      resolve();
    };
  });

  const prev = chain;
  chain = next;

  if (waitLimitMs > 0) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = await Promise.race([
      prev.then(() => false),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(true), waitLimitMs); }),
    ]);
    if (timer) clearTimeout(timer);

    if (timedOut) {
      // 체인 보존: 내가 빠져도 뒤 대기자는 원래 보유자(prev)의 해제를 기다리게 연결해 둔다.
      prev.then(() => release());
      const heldMin = heldSince > 0 ? Math.round((Date.now() - heldSince) / 60000) : -1;
      const holderInfo = heldMin >= 0 ? ` (현재 보유: ${heldLabel || '알 수 없음'}, ${heldMin}분째)` : '';
      throw new Error(
        `ENGINE_LOCK_TIMEOUT: 텍스트 엔진이 ${Math.round(waitLimitMs / 60000)}분째 잠겨 있어 대기를 중단합니다${holderInfo}. `
        + `이전 생성 작업이 멈춘 것으로 보입니다 — 앱을 재시작하면 해소됩니다. `
        + `(env ENGINE_LOCK_WAIT_MS로 상한 조정, 0이면 무제한 대기)`,
      );
    }
  } else {
    await prev;
  }

  heldSince = Date.now();
  heldLabel = label;
  return release;
}
