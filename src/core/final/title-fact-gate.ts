/**
 * 🚧 Title Fact Gate (v3.8.735)
 *
 * 제목이 만들어진 직후, 본문으로 넘어가기 전에 제목의 값(날짜·금액·비율·인원·기간·순위)이 근거에 있는지 본다.
 * 하나라도 근거에 없으면 제목을 다시 만든다. 다시 만들어도 안 되면 그 값을 걷어낸 제목으로 간다 —
 * **근거 없는 값이 든 제목으로는 본문을 쓰지 않는다.**
 */

import { checkClaims, stripClaims, type LedgerItem, type SupportedClaim } from './fact-claims';

export interface TitleAudit {
  status: 'PASS' | 'FAIL';
  title: string;
  supportedClaims: SupportedClaim[];
  unsupportedClaims: string[];
}

export function auditTitle(title: string, ledger: LedgerItem[]): TitleAudit {
  const r = checkClaims(title, ledger);
  return { status: r.unsupported.length ? 'FAIL' : 'PASS', title, supportedClaims: r.supported, unsupportedClaims: r.unsupported };
}

/** 재생성 지시 — 어떤 값이 근거에 없는지 콕 집어 준다 */
export function titleRegenerateDirective(audit: TitleAudit): string {
  return [
    '🚧 **직전 제목이 사실 검사에서 떨어졌습니다.** 아래 값은 근거 어디에도 없습니다:',
    ...audit.unsupportedClaims.map((c) => `  - "${c}"`),
    '이 값을 넣지 마세요. 근거(Research Packet)에 적힌 값만 쓰거나, 값 없이 조건·상황으로 제목을 만드세요.',
  ].join('\n');
}

/**
 * 제목을 확정한다: 검사 → (실패) 다시 만들기 최대 N회 → (그래도 실패) 값 걷어내기.
 * `regenerate(directive)` 는 새 제목 문자열을 돌려준다.
 */
export async function ensureGroundedTitle(
  initial: string,
  ledger: LedgerItem[],
  regenerate: (directive: string) => Promise<string>,
  opts: { maxRetries?: number; onLog?: (m: string) => void } = {},
): Promise<{ title: string; audit: TitleAudit; attempts: number; stripped: boolean; history: TitleAudit[] }> {
  const maxRetries = opts.maxRetries ?? 2;
  const history: TitleAudit[] = [];
  let title = String(initial || '').trim();
  let audit = auditTitle(title, ledger);
  history.push(audit);
  let attempts = 0;
  while (audit.status === 'FAIL' && attempts < maxRetries) {
    attempts += 1;
    opts.onLog?.(`[PROGRESS] 26% - 🚧 제목 사실 검사 실패: 근거에 없는 값 ${audit.unsupportedClaims.map((c) => `"${c}"`).join(', ')} → 제목 다시 만들기 ${attempts}/${maxRetries}`);
    try {
      const next = String(await regenerate(titleRegenerateDirective(audit)) || '').trim();
      if (next) title = next;
    } catch (err: any) {
      opts.onLog?.(`[PROGRESS] 26% - ⚠️ 제목 재생성 실패: ${String(err?.message || err).slice(0, 80)}`);
      break;
    }
    audit = auditTitle(title, ledger);
    history.push(audit);
  }
  let stripped = false;
  if (audit.status === 'FAIL') {
    const cleaned = stripClaims(title, audit.unsupportedClaims);
    if (cleaned.length >= 8) {
      title = cleaned;
      stripped = true;
      audit = auditTitle(title, ledger);
      history.push(audit);
      opts.onLog?.(`[PROGRESS] 26% - ✂️ 근거 없는 값을 제목에서 걷어냈습니다 → "${title}"`);
    }
  }
  return { title, audit, attempts, stripped, history };
}
