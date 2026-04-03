// src/ui/renderer.ts
(function () {
    const $ = (sel) => document.querySelector(sel);
    const logEl = ($('#log') || $('#logs'));
    const logLine = (msg) => {
        if (!logEl)
            return;
        const ts = new Date().toLocaleTimeString();
        const line = `[${ts}] ${msg}\n`;
        if ('value' in logEl) {
            logEl.value += line;
            logEl.scrollTop = logEl.scrollHeight;
        }
        else {
            logEl.textContent += line;
            logEl.scrollTop = logEl.scrollHeight;
        }
    };
    const val = (id) => document.querySelector(id)?.value?.trim() ?? '';
    const setVal = (id, v) => {
        const el = document.querySelector(id);
        if (el)
            el.value = v;
    };
    // 타입 가드
    function isIpcOk(r) { return r.ok === true; }
    function isIpcFail(r) { return r.ok === false; }
    // 표시-only 요소(있으면 반영)
    const leftTimeEl = $('#leftTime');
    // 관리자 입력(있으면 반영/사용), 구 이름도 겸용 지원
    const licExpireLocalI = $('#licExpireLocal') || $('#licExpires');
    const licSaveBtn = $('#btnLicSave') || $('#licSave');
    function fmtLeft(iso) {
        if (!iso)
            return '만료일 미설정';
        const diff = new Date(iso).getTime() - Date.now();
        if (!Number.isFinite(diff) || diff <= 0)
            return '만료됨';
        const s = Math.floor(diff / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${d}일 ${h}시간 ${m}분 남음`;
    }
    function isoToLocalInput(iso) {
        if (!iso)
            return '';
        const dt = new Date(iso);
        if (Number.isNaN(dt.getTime()))
            return '';
        const p = (n) => String(n).padStart(2, '0');
        return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
    }
    function localToIso(local) {
        if (!local)
            return '';
        const t = new Date(local).getTime();
        if (!Number.isFinite(t))
            return '';
        return new Date(t).toISOString();
    }
    function unusable(d) {
        const exp = !d.expiresAt || new Date(d.expiresAt).getTime() <= Date.now();
        return exp; // 만료일만 체크 (사용횟수 체크 제거)
    }
    async function getLicenseSafe() {
        try {
            const r = await window.blogger.getLicense();
            if (r && r.ok)
                return r.data;
        }
        catch { }
        return null;
    }
    async function renderLicenseFromMain() {
        const d = await getLicenseSafe();
        if (!d)
            return;
        // 배지/표시 전용 업데이트
        if (leftTimeEl)
            leftTimeEl.textContent = fmtLeft(d.expiresAt || '');
        // 실행 버튼 잠금
        const lock = unusable(d);
        $('#btnRunPost')?.setAttribute('disabled', lock ? 'true' : '');
        if (!lock) {
            $('#btnRunPost')?.removeAttribute('disabled');
        }
        // 관리자 입력값 반영(있을 때만)
        if (licExpireLocalI)
            licExpireLocalI.value = isoToLocalInput(d.expiresAt || '');
        logLine(`[LICENSE] 상태 — 만료:${d.expiresAt || '-'}`);
    }
    // 관리자: 저장 버튼 (있는 경우에만 동작)
    licSaveBtn?.addEventListener('click', async () => {
        try {
            const expiresAt = localToIso(licExpireLocalI?.value || '');
            const r = await window.blogger.saveLicense({ expiresAt });
            if (r && r.ok) {
                await renderLicenseFromMain();
                logLine('[LICENSE] 저장 완료');
            }
            else {
                logLine('[LICENSE] 저장 실패');
            }
        }
        catch (e) {
            logLine(`[LICENSE] 저장 오류: ${e?.message ?? e}`);
        }
    });
    // 메인 브로드캐스트 구독(있을 때만)
    if (window.blogger.onLicense) {
        window.blogger.onLicense((_d) => {
            // 실시간 업데이트
            renderLicenseFromMain();
        });
    }
    // 주기적으로 남은시간 텍스트 갱신
    setInterval(async () => {
        const d = await getLicenseSafe();
        if (!d)
            return;
        if (leftTimeEl)
            leftTimeEl.textContent = fmtLeft(d.expiresAt || '');
    }, 60 * 1000);
    // ─────────────────────────────────────────
    // 링크 버튼 (ID 겸용 지원)
    // ─────────────────────────────────────────
    $('#btnOpenAI')?.addEventListener('click', () => window.blogger.openLink('https://platform.openai.com/api-keys'));
    $('#btnOpenAIKey')?.addEventListener('click', () => window.blogger.openLink('https://platform.openai.com/api-keys'));
    $('#btnGemini')?.addEventListener('click', () => window.blogger.openLink('https://aistudio.google.com/app/apikey'));
    $('#btnGeminiKey')?.addEventListener('click', () => window.blogger.openLink('https://aistudio.google.com/app/apikey'));
    $('#btnGoogleConsole')?.addEventListener('click', () => window.blogger.openLink('https://console.cloud.google.com/'));
    $('#btnGcp')?.addEventListener('click', () => window.blogger.openLink('https://console.cloud.google.com/'));
    // ─────────────────────────────────────────
    // ENV 저장/로드
    // ─────────────────────────────────────────
    (async () => {
        try {
            const r = await window.blogger.getEnv();
            if (r.ok && r.data) {
                const d = r.data;
                setVal('#openaiKey', d.openaiKey ?? '');
                setVal('#geminiKey', d.geminiKey ?? '');
                setVal('#blogId', d.blogId ?? '');
                setVal('#googleClientId', d.googleClientId ?? '');
                setVal('#googleClientSecret', d.googleClientSecret ?? '');
                setVal('#redirectUri', d.redirectUri ?? 'http://localhost:8080');
                setVal('#minChars', String(d.minChars ?? 3000));
                logLine('[ENV] 불러오기 완료');
            }
        }
        catch (e) {
            logLine(`[ENV] 불러오기 예외: ${e?.message ?? e}`);
        }
    })();
    $('#btnSaveEnv')?.addEventListener('click', async () => {
        try {
            const env = {
                provider: val('#geminiKey') ? 'gemini' : 'openai',
                openaiKey: val('#openaiKey'),
                geminiKey: val('#geminiKey'),
                blogId: val('#blogId'),
                googleClientId: val('#googleClientId'),
                googleClientSecret: val('#googleClientSecret'),
                redirectUri: val('#redirectUri') || 'http://localhost:8080',
                minChars: val('#minChars') || '3000',
            };
            const r = await window.blogger.saveEnv(env);
            if (isIpcOk(r))
                logLine(r.logs ?? '[ENV] 저장 완료');
            else if (isIpcFail(r))
                logLine(`[ENV] 저장 실패: ${r.error ?? ''}`);
            else
                logLine('[ENV] 저장: 알 수 없는 결과');
        }
        catch (e) {
            logLine(`[ENV] 예외: ${e?.message ?? e}`);
        }
    });
    async function ensureUsableOrWarn() {
        const d = await getLicenseSafe();
        if (!d) {
            logLine('[멤버십] 상태 확인 실패');
            return false;
        }
        if (unusable(d)) {
            logLine('[멤버십] 만료로 실행 차단');
            return false;
        }
        return true;
    }
    $('#btnRunPost')?.addEventListener('click', async () => {
        try {
            if (!(await ensureUsableOrWarn()))
                return;
            const provider = val('#geminiKey') ? 'gemini' : 'openai';
            const payload = {
                provider,
                openaiKey: val('#openaiKey') || undefined,
                geminiKey: val('#geminiKey') || undefined,
                blogId: val('#blogId'),
                googleClientId: val('#googleClientId'),
                googleClientSecret: val('#googleClientSecret'),
                redirectUri: val('#redirectUri') || 'http://localhost:8080',
                topic: val('#topic'),
                keywords: val('#keywords'),
                publishType: val('#publishType') || document.querySelector('input[name="ptype"]:checked')?.value || 'draft',
                scheduleISO: val('#scheduleISO') || undefined,
                minChars: Number(val('#minChars') || '3000'),
            };
            const res = await window.blogger.runPost(payload);
            if (isIpcOk(res))
                logLine(res.logs ?? '[RUN] OK');
            else if (isIpcFail(res))
                logLine(`[RUN] FAIL: exit=${res.exitCode}\n${res.logs ?? res.error ?? ''}`);
            else
                logLine('[RUN] 실행: 알 수 없는 결과');
            await renderLicenseFromMain();
        }
        catch (e) {
            logLine(`[RUN] 예외: ${e?.message ?? e}`);
        }
    });
    // 실시간 로그 구독
    const off = window.blogger.onLog
        ? window.blogger.onLog((line) => logLine(line))
        : undefined;
    window.addEventListener('beforeunload', () => { try {
        if (typeof off === 'function')
            off();
    }
    catch { } });
    // 초기 렌더
    (async () => {
        await renderLicenseFromMain();
        logLine('UI 로딩 완료');
    })();
})();
