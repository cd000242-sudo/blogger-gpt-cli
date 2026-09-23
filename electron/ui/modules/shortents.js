let results = [];
let busy = false;
const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function initShortents() {
  const host = el('keywordInputBlock');
  if (!host || el('shortentsOpen')) return;
  const button = document.createElement('button');
  button.id = 'shortentsOpen';
  button.type = 'button';
  button.textContent = '숏텐츠 글감 분석';
  button.style.cssText = 'margin:8px 0;padding:9px 14px;background:#164e63;color:#cffafe;border:1px solid #0e7490;border-radius:8px;cursor:pointer;';
  el('keywordInput').insertAdjacentElement('afterend', button);
  button.addEventListener('click', openShortents);
}

function openShortents() {
  if (el('shortentsDialog')) { el('shortentsDialog').showModal(); return; }
  const dialog = document.createElement('dialog');
  dialog.id = 'shortentsDialog';
  dialog.setAttribute('aria-labelledby', 'shortentsTitle');
  dialog.style.cssText = 'width:min(880px,90vw);max-height:86vh;background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:16px;padding:24px;';
  dialog.innerHTML = `
    <h2 id="shortentsTitle" style="margin:0 0 10px">숏텐츠 글감 분석</h2>
    <p>현재 수집한 네이버 숏텐츠를 비교해 지금 먼저 검토할 글감을 정합니다. 작성 우선순위 점수이며 상위노출을 보장하지 않습니다.</p>
    <p style="color:#94a3b8;font-size:13px">검색 API의 문서 수·관련도순 블로그 20개·최신 뉴스 20개를 사용합니다. 실제 검색 화면의 순위, 검색량, 내 블로그 경쟁력은 측정하지 않습니다. LLM 호출은 없습니다.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button id="shortentsCollect" type="button">현재 숏텐츠 수집·분석</button>
      <button id="shortentsClose" type="button">닫기</button>
    </div>
    <details style="margin:16px 0"><summary>숏텐츠를 직접 입력해서 분석</summary>
      <label for="shortentsInput">숏텐츠 제목을 한 줄에 하나씩 입력하세요 (최대 20개).</label>
      <textarea id="shortentsInput" rows="4" style="display:block;width:100%;box-sizing:border-box;margin:8px 0;background:#1e293b;color:#f1f5f9;padding:10px" placeholder="네이버에서 확인한 숏텐츠 제목"></textarea>
      <button id="shortentsManual" type="button">입력한 목록 분석</button>
    </details>
    <p id="shortentsStatus" role="status" aria-live="polite"></p>
    <div id="shortentsResults"></div>`;
  document.body.appendChild(dialog);
  dialog.querySelectorAll('button').forEach(b => { b.style.cssText = 'padding:9px 14px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#e2e8f0;cursor:pointer;'; });
  el('shortentsClose').onclick = () => dialog.close();
  el('shortentsCollect').onclick = () => analyze();
  el('shortentsManual').onclick = () => analyze(el('shortentsInput').value);
  el('shortentsResults').addEventListener('click', e => {
    const b = e.target.closest('[data-shortents-pick]');
    if (!b) return;
    const item = results[Number(b.dataset.shortentsPick)];
    if (!item) return;
    const field = el('keywordInput');
    if (field.value.trim() && !window.confirm(`기존 키워드를 “${item.keyword}”(으)로 바꿀까요?`)) return;
    field.value = item.keyword;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.close();
    field.focus();
  });
  dialog.showModal();
}

async function analyze(text) {
  if (busy) return;
  const manual = typeof text === 'string';
  const keywords = manual ? text.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : undefined;
  if (manual && (!keywords.length || keywords.length > 20)) { el('shortentsStatus').textContent = '1~20개의 제목을 입력해 주세요.'; return; }
  busy = true;
  el('shortentsCollect').disabled = el('shortentsManual').disabled = true;
  el('shortentsStatus').textContent = '숏텐츠와 검색 근거를 분석 중입니다. 최대 수 분 걸릴 수 있습니다.';
  el('shortentsResults').replaceChildren();
  results = [];
  try {
    const res = await window.electronAPI.invoke('shortents:analyze', manual ? { keywords } : {});
    if (!res?.ok) throw Error(res?.error || '분석하지 못했습니다.');
    results = res.results || [];
    el('shortentsStatus').textContent = `${res.scope} · ${results.length}개 분석 · ${new Date(res.fetchedAt).toLocaleString('ko-KR')} 수집${res.cached ? ' · 저장된 결과' : ''}`;
    el('shortentsResults').innerHTML = results.map((r, index) => `
      <article style="padding:16px;margin:10px 0;border:1px solid #334155;border-radius:10px">
        <strong>${esc(r.keyword)}</strong>
        <span style="float:right;color:#67e8f9">${r.score === null ? '점수 없음' : `${esc(r.score)}/100`} · ${esc(r.verdict)}</span>
        <ul>${(r.reasons || []).map(reason => `<li>${esc(reason)}</li>`).join('')}</ul>
        ${r.error ? `<p style="color:#fda4af">${esc(r.error)}</p>` : ''}
        <p style="font-size:12px;color:#94a3b8">${(r.evidence || []).map(n => `${/^https?:\/\//i.test(n.url || '') ? `<a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd">${esc(n.title)}</a>` : esc(n.title)} (${esc(n.publishedAt)})`).join('<br>')}</p>
        <button type="button" data-shortents-pick="${index}" style="padding:8px 12px;background:#164e63;border:1px solid #0e7490;border-radius:7px;color:#cffafe;cursor:pointer">이 주제로 작성</button>
        <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" style="margin-left:14px;color:#93c5fd">검색 결과 확인</a>
      </article>`).join('');
  } catch (e) { el('shortentsStatus').textContent = `분석 실패: ${e.message || e}`; }
  finally { busy = false; el('shortentsCollect').disabled = el('shortentsManual').disabled = false; }
}
