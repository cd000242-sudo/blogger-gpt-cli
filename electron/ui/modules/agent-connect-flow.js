// agent-connect-flow.js
// One-button connection of a subscription agent CLI (Claude Code / Codex):
//   [1/4 준비 확인] -> [2/4 설치] -> [3/4 로그인] -> [4/4 실제 답 확인]
// Steps that are already done are skipped. The first failing step stops the flow with its own reason.
// A program that a run found too old ("upgrade") is upgraded in step 2 - but only after the user says yes in the app.
// A check that is only SLOW ("delayed") stops the flow without installing or logging in: the program and
// the login are still there. Nothing here switches to another engine - the caller keeps the user's choice.
//
// No DOM and no IPC: everything the flow needs is injected (`api`), so it runs the same in the app and in tests.
import { classifyAgentConnect } from './agent-connect-state.js';

const STEP_LABELS = { 1: '준비 확인', 2: '설치', 3: '로그인', 4: '실제 답 확인' };
const LOGIN_POLL_MS = 5000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export function agentConnectProgressLine(step, text) {
  return `[${step}/4 ${STEP_LABELS[step]}] ${text}`;
}

export function agentConnectFailureLine(step, reason) {
  return `[${step}/4 ${STEP_LABELS[step]}]에서 멈춤: ${reason}`;
}

export function agentConnectSuccessLine(elapsedMs) {
  return `연결 완료 — 실제 답 확인됨 (${Math.max(1, Math.round(elapsedMs / 1000))}초)`;
}

function delayedReason(label) {
  return `${label} 확인 지연 — 설치·로그인은 그대로 유지됩니다. 잠시 뒤 [다시 확인]을 눌러 주세요.`;
}

const stop = (step, reason, delayed = false) => ({ ok: false, step, reason, delayed });

/**
 * Runs the whole chain. Never throws: every failure comes back as the step that stopped.
 *
 * api (all async):
 *   loadStatus()                     -> { tools, profiles } fresh from main
 *   getProfile(status)               -> the profile that will be used (or null)
 *   ensureProfile()                  -> creates this PC's login profile when there is none
 *   checkLogin(profileId)            -> { ready, delayed, authRequired, quotaExceeded, message }
 *   installTool()                    -> { ok, delayed, message }       (main refuses without the user's yes)
 *   upgradeTool()                    -> { ok, delayed, message }       (official download only; main refuses without the user's yes)
 *   startLogin(profileId)            -> { ok, message }
 *   verifyAnswer()                   -> { ok, delayed, authRequired, message }
 * confirmInstall()                   -> Promise<boolean> (or boolean), the plain "install it?" question asked in the app
 * confirmUpgrade()                   -> Promise<boolean> (or boolean), the "upgrade it?" question; missing means "no"
 * report(line, tone)                 -> progress text for the screen ('info' | 'error' | 'success')
 */
export async function runAgentConnect({
  provider,
  label,
  api,
  confirmInstall,
  confirmUpgrade = () => false,
  report = () => {},
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  loginPollMs = LOGIN_POLL_MS,
  loginTimeoutMs = LOGIN_TIMEOUT_MS,
}) {
  const startedAt = now();
  const say = (step, text) => report(agentConnectProgressLine(step, text), 'info');
  let currentStep = 1;

  const execute = async () => {
    currentStep = 1;
    say(1, `${label} 설치·로그인 상태를 확인합니다…`);
    let status = await api.loadStatus();
    let profile = api.getProfile(status);
    let kind = classifyAgentConnect({ tool: status?.tools?.[provider], profile });
    if (kind === 'delayed') return stop(1, delayedReason(label), true);

    // Installed and a login on record: ask the CLI (non-billable status call) before going further.
    if (kind === 'ready' || (kind === 'login' && profile)) {
      const check = await api.checkLogin(profile.id);
      if (check?.delayed && !check?.ready) return stop(1, delayedReason(label), true);
      if (check?.ready) kind = 'ready';
      else if (check?.quotaExceeded) return { ok: true, step: 4, reason: `${label} 연결됨 — 지금은 구독 사용 한도에 걸려 있습니다.`, delayed: false };
      else kind = 'login';
    }

    if (kind === 'install') {
      currentStep = 2;
      // The question is asked inside the app and answered later (a Promise): wait for it, never treat it as truthy.
      if (!(await confirmInstall())) return stop(2, `${label} 설치를 하지 않았습니다. 필요하면 [연결하기]를 다시 눌러 주세요.`);
      say(2, `${label} 공식 설치 파일을 받아 설치합니다…`);
      const installed = await api.installTool();
      if (installed?.delayed) return stop(2, delayedReason(label), true);
      if (!installed?.ok) return stop(2, installed?.message || '설치에 실패했습니다.');
      status = await api.loadStatus();
      profile = api.getProfile(status);
      kind = classifyAgentConnect({ tool: status?.tools?.[provider], profile });
      if (kind === 'install') return stop(2, '설치는 끝났지만 실행 파일을 찾지 못했습니다. 보안 프로그램과 폴더 권한을 확인해 주세요.');
      if (kind === 'delayed') return stop(2, delayedReason(label), true);
    }

    if (kind === 'upgrade') {
      currentStep = 2;
      // Nothing is upgraded without a yes. A "no" (or no question at all) stops here and says why.
      if (!(await confirmUpgrade())) return stop(2, `${label} 업그레이드를 하지 않았습니다. 새 버전이 없으면 이 엔진으로는 글을 쓸 수 없습니다. 필요하면 [업그레이드]를 다시 눌러 주세요.`);
      say(2, `${label} 새 버전을 받아 업그레이드합니다…`);
      const upgraded = await api.upgradeTool();
      if (upgraded?.delayed) return stop(2, delayedReason(label), true);
      // A failed download stops here. The chain never tries another way of installing behind the user's back.
      if (!upgraded?.ok) return stop(2, upgraded?.message || '업그레이드에 실패했습니다.');
      status = await api.loadStatus();
      profile = api.getProfile(status);
      kind = classifyAgentConnect({ tool: status?.tools?.[provider], profile });
      if (kind === 'upgrade') return stop(2, '업그레이드는 끝났지만 새 버전을 확인하지 못했습니다. 잠시 뒤 [업그레이드]를 눌러 다시 확인해 주세요.');
      if (kind === 'delayed') return stop(2, delayedReason(label), true);
    }

    if (kind === 'login') {
      currentStep = 3;
      say(3, `${label} 로그인 창을 엽니다. 열린 창에서 로그인만 해 주세요…`);
      profile = profile || (await api.ensureProfile());
      if (!profile?.id) return stop(3, '로그인할 계정을 준비하지 못했습니다.');
      const started = await api.startLogin(profile.id);
      if (!started?.ok) return stop(3, started?.message || '로그인 창을 열지 못했습니다.');
      const deadline = now() + loginTimeoutMs;
      let ready = false;
      while (!ready && now() < deadline) {
        await sleep(loginPollMs);
        const check = await api.checkLogin(profile.id);
        ready = check?.ready === true;
        if (!ready && check?.quotaExceeded) return { ok: true, step: 4, reason: `${label} 연결됨 — 지금은 구독 사용 한도에 걸려 있습니다.`, delayed: false };
      }
      if (!ready) return stop(3, `${label} 로그인 완료를 아직 확인하지 못했습니다. 로그인을 마쳤다면 [다시 확인]을 눌러 주세요.`);
    }

    currentStep = 4;
    say(4, `${label}에 짧은 질문을 보내 실제 답이 오는지 확인합니다…`);
    const answer = await api.verifyAnswer();
    if (answer?.delayed) return stop(4, delayedReason(label), true);
    if (!answer?.ok) return stop(4, answer?.message || '답을 받지 못했습니다. 계정 상태를 확인해 주세요.');
    return { ok: true, step: 4, reason: '', delayed: false };
  };

  try {
    const outcome = await execute();
    const elapsedMs = Math.max(0, now() - startedAt);
    if (outcome.ok) {
      const message = outcome.reason || agentConnectSuccessLine(elapsedMs);
      report(message, 'success');
      return { ok: true, step: outcome.step, delayed: false, message, elapsedMs };
    }
    const message = agentConnectFailureLine(outcome.step, outcome.reason);
    report(message, outcome.delayed ? 'info' : 'error');
    return { ok: false, step: outcome.step, delayed: outcome.delayed === true, message, elapsedMs };
  } catch (error) {
    const reason = error?.message || String(error || '알 수 없는 오류');
    const message = agentConnectFailureLine(currentStep, reason);
    report(message, 'error');
    return { ok: false, step: currentStep, delayed: false, message, elapsedMs: Math.max(0, now() - startedAt) };
  }
}
