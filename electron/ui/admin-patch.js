(function adminTogglePatch(){
  if (window.__adminPatchApplied) return;
  window.__adminPatchApplied = true;

  const form = document.getElementById('licAdminForm');
  const chip = document.getElementById('adminToggleChip');
  const box  = document.getElementById('adminToggle');

  if (!form || !box || !chip) {
    console.warn('[ADMIN PATCH] licAdminForm/adminToggleChip/adminToggle 중 빠진 요소가 있습니다.');
    return;
  }

  function isOpen() {
    return getComputedStyle(form).display !== 'none';
  }
  function openAdmin() { form.style.display = '';  box.checked = true; }
  function closeAdmin(){ form.style.display = 'none'; box.checked = false; }

  async function authAndToggle() {
    if (isOpen()) { closeAdmin(); return; }
    const pin = prompt('관리자 PIN을 입력하세요');
    if (!pin) { closeAdmin(); return; }
    try {
      const r = await (window.blogger?.adminAuth?.(pin) ?? { ok: true });
      if (r?.ok) {
        openAdmin();
        setTimeout(()=> document.getElementById('licTotal')?.focus(), 50);
      } else {
        alert(r?.error || '인증 실패');
        closeAdmin();
      }
    } catch {
      alert('인증 중 오류가 발생했습니다.');
      closeAdmin();
    }
  }

  // 라벨/체크박스 어디를 눌러도 동작
  document.addEventListener('click', (e) => {
    const hit = e.target.closest('#adminToggleChip, #adminToggle');
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    authAndToggle();
  }, true);

  box.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      authAndToggle();
    }
  });

  closeAdmin();
  console.log('[ADMIN PATCH] 적용됨');
})();
