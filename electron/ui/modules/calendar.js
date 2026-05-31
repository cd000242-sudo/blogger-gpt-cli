// 🔧 달력 및 작업 기록 관련 함수들
import { getStorageManager, addLog, debugLog } from './core.js';
import { formatDate } from './utils.js';

// 작업 일기 데이터
let workDiary = {};

// 작업 일기 초기화
export function initWorkDiary() {
  try {
    const storage = getStorageManager();
    const saved = storage.getSync('workDiary', true);
    if (saved) {
      workDiary = saved;
    }
  } catch (error) {
    console.error('[WORK_DIARY] 초기화 실패:', error);
    workDiary = {};
  }
}

// 작업 기록 저장
export function saveWorkRecord(date, record) {
  debugLog('WORK_DIARY', '작업 기록 저장 시도', { date, record });
  const dateKey = formatDateKey(date);
  debugLog('WORK_DIARY', '날짜 키', dateKey);

  if (!workDiary[dateKey]) {
    workDiary[dateKey] = [];
  }

  workDiary[dateKey].push({
    id: Date.now(),
    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    content: record,
    completed: false,
    timestamp: new Date().toISOString()
  });

  const storage = getStorageManager();
  storage.setSync('workDiary', workDiary, true);
}

// 날짜 키 포맷팅
export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 특정 날짜의 작업 기록 가져오기
export function getWorkRecords(date) {
  const dateKey = formatDateKey(date);
  debugLog('WORK_DIARY', '작업 기록 조회', { dateKey });
  const records = workDiary[dateKey] || [];
  debugLog('WORK_DIARY', '조회된 기록 개수', records.length);

  return records.map(record => ({
    ...record,
    completed: record.completed || false
  }));
}

// 달력 렌더링
export function renderCalendar() {
  debugLog('CALENDAR', 'renderCalendar() 호출됨');

  // script.js의 전역 변수 사용 (currentCalendarYear, currentCalendarMonth)
  const now = new Date();
  const year = window.currentCalendarYear || now.getFullYear();
  const month = window.currentCalendarMonth !== undefined ? window.currentCalendarMonth : now.getMonth();

  // 월 표시 업데이트
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const monthElement = document.getElementById('calendar-month');
  if (monthElement) {
    monthElement.innerHTML = `
      <button id="prevMonth" style="background: none; border: none; color: #0ea5e9; font-size: 18px; cursor: pointer; margin-right: 10px;">‹</button>
      <span>${year}년 ${monthNames[month]}</span>
      <button id="nextMonth" style="background: none; border: none; color: #0ea5e9; font-size: 18px; cursor: pointer; margin-left: 10px;">›</button>
    `;

    document.getElementById('prevMonth').addEventListener('click', () => {
      window.currentCalendarMonth = (window.currentCalendarMonth || month) - 1;
      if (window.currentCalendarMonth < 0) { window.currentCalendarMonth = 11; window.currentCalendarYear = (window.currentCalendarYear || year) - 1; }
      renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
      window.currentCalendarMonth = (window.currentCalendarMonth || month) + 1;
      if (window.currentCalendarMonth > 11) { window.currentCalendarMonth = 0; window.currentCalendarYear = (window.currentCalendarYear || year) + 1; }
      renderCalendar();
    });
  }

  // 달력 날짜 생성
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarDates = document.getElementById('calendar-dates');
  if (!calendarDates) {
    debugLog('CALENDAR', 'calendar-dates 요소를 찾을 수 없습니다');
    return;
  }

  calendarDates.innerHTML = '';

  // 예약 스케줄 데이터 로드
  let allSchedules = [];
  try {
    const spRaw = localStorage.getItem('scheduledPosts');
    if (spRaw) allSchedules = JSON.parse(spRaw);
  } catch (e) {
    console.warn('[CALENDAR] scheduledPosts 파싱 실패:', e);
  }

  // 작업 기록 데이터 로드 (localStorage에서 직접)
  let workDiaryLocal = {};
  try {
    const wdRaw = localStorage.getItem('workDiary');
    if (wdRaw) workDiaryLocal = JSON.parse(wdRaw);
  } catch (e) {
    console.warn('[CALENDAR] workDiary 파싱 실패:', e);
  }

  // v3.7.5: 발행한 포스팅 데이터 로드 (일기장 모드)
  let publishedLocal = {};
  try {
    const ppRaw = localStorage.getItem('publishedPosts');
    if (ppRaw) publishedLocal = JSON.parse(ppRaw);
  } catch (e) {
    console.warn('[CALENDAR] publishedPosts 파싱 실패:', e);
  }
  // 메모 데이터 로드
  let memoLocal = {};
  try {
    const mRaw = localStorage.getItem('dailyMemo');
    if (mRaw) memoLocal = JSON.parse(mRaw);
  } catch (e) {
    console.warn('[CALENDAR] dailyMemo 파싱 실패:', e);
  }

  // 이전 달의 빈 칸
  for (let i = 0; i < firstDayOfWeek; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.style.cssText = 'min-height: 56px;';
    calendarDates.appendChild(emptyDay);
  }

  // 현재 달의 날짜들
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = document.createElement('div');
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();
    const dateKey = formatDateKey(currentDate);
    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    // 작업 기록 & 예약 스케줄 확인
    const records = workDiaryLocal[dateKey] || [];
    const daySchedules = allSchedules.filter(s => s.date === dateKey && s.status !== 'completed');
    const dayPublished = Array.isArray(publishedLocal[dateKey]) ? publishedLocal[dateKey] : [];
    const dayMemo = (memoLocal[dateKey] || '').trim();
    const hasWork = records.length > 0;
    const hasSchedule = daySchedules.length > 0;
    const hasPublished = dayPublished.length > 0;
    const hasMemo = dayMemo.length > 0;

    // 셀 스타일
    dayElement.style.cssText = `
      min-height: 56px; padding: 4px 3px; cursor: pointer; border-radius: 6px;
      display: flex; flex-direction: column; align-items: center; transition: all 0.2s ease;
      ${isToday ? 'background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.3);' : ''}
    `;

    // 날짜 숫자 색상
    let numColor = '#e2e8f0';
    if (isToday) numColor = '#0ea5e9';
    else if (dayOfWeek === 0) numColor = '#f87171';
    else if (dayOfWeek === 6) numColor = '#38bdf8';

    // HTML 구성
    let cellHtml = `<div style="font-weight: ${isToday ? '800' : '700'}; font-size: 13px; color: ${numColor}; margin-bottom: 1px;">${day}</div>`;

    // 🟢 작업 기록 (최대 2건, 5자)
    if (hasWork) {
      records.slice(0, 2).forEach(r => {
        const txt = (r.content || '').substring(0, 5);
        cellHtml += `<div style="font-size: 8px; color: #34d399; line-height: 1.15; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${txt}</div>`;
      });
      if (records.length > 2) cellHtml += `<div style="font-size: 7px; color: #34d399; opacity: 0.6;">+${records.length - 2}</div>`;
    }

    // 🟠 예약 스케줄 (최대 1건, 5자)
    if (hasSchedule) {
      const s = daySchedules[0];
      const txt = (s.topic || '').substring(0, 5);
      cellHtml += `<div style="font-size: 8px; color: #fbbf24; line-height: 1.15; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${txt}</div>`;
      if (daySchedules.length > 1) cellHtml += `<div style="font-size: 7px; color: #fbbf24; opacity: 0.6;">+${daySchedules.length - 1}</div>`;
    }

    // v3.7.5: 🔵 발행한 포스팅 (최대 1건 + 카운트)
    if (hasPublished) {
      const p = dayPublished[0];
      const txt = (p.title || '').substring(0, 5);
      cellHtml += `<div style="font-size: 8px; color: #60a5fa; line-height: 1.15; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">📤${txt}</div>`;
      if (dayPublished.length > 1) cellHtml += `<div style="font-size: 7px; color: #60a5fa; opacity: 0.7;">+${dayPublished.length - 1}건</div>`;
    }

    // v3.7.5: 💭 메모 표식 (한 줄, 4자)
    if (hasMemo) {
      const txt = dayMemo.substring(0, 4);
      cellHtml += `<div style="font-size: 8px; color: #a78bfa; line-height: 1.15; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">💭${txt}</div>`;
    }

    dayElement.innerHTML = cellHtml;

    // Tooltip
    let tip = [];
    if (hasWork) { tip.push('📝 작업기록:'); records.forEach(r => tip.push(`  · ${r.content || ''}`)); }
    if (hasSchedule) { tip.push('📌 예약:'); daySchedules.forEach(s => tip.push(`  · ${s.topic || ''} (${s.time || ''})`)); }
    if (hasPublished) { tip.push('📤 발행한 글:'); dayPublished.forEach(p => tip.push(`  · ${p.title || ''} (${p.platform || ''}, ${p.time || ''})`)); }
    if (hasMemo) { tip.push('💭 메모: ' + dayMemo.slice(0, 80)); }
    if (tip.length) dayElement.title = tip.join('\n');

    // 클릭 이벤트
    dayElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showWorkDiary(currentDate);
    });

    // 호버 효과
    dayElement.addEventListener('mouseenter', function () { if (!isToday) this.style.background = 'rgba(148, 163, 184, 0.1)'; });
    dayElement.addEventListener('mouseleave', function () { if (!isToday) this.style.background = 'transparent'; });

    calendarDates.appendChild(dayElement);
  }
}

// 작업 일기 모달 표시
export function showWorkDiary(date) {
  debugLog('WORK_DIARY', 'showWorkDiary 호출됨', { date });

  const dateString = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const dateKey = formatDateKey(date);

  // v3.7.5: 발행한 포스팅 + 메모 로드 (일기장)
  let dayPublished = [];
  let dailyMemoValue = '';
  try {
    const ppRaw = localStorage.getItem('publishedPosts');
    if (ppRaw) {
      const all = JSON.parse(ppRaw);
      if (Array.isArray(all[dateKey])) dayPublished = all[dateKey];
    }
  } catch (e) { console.warn('[CALENDAR] publishedPosts 파싱 실패:', e); }
  try {
    const mRaw = localStorage.getItem('dailyMemo');
    if (mRaw) {
      const all = JSON.parse(mRaw);
      if (typeof all[dateKey] === 'string') dailyMemoValue = all[dateKey];
    }
  } catch (e) { console.warn('[CALENDAR] dailyMemo 파싱 실패:', e); }

  // 요일/날짜 분리
  const dayOfWeek = date.toLocaleDateString('ko-KR', { weekday: 'long' });
  const monthDay = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  const yearStr = date.getFullYear();

  // 오늘 여부
  const today = new Date();
  const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

  const modal = document.createElement('div');
  modal.className = 'work-diary-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0, 0, 0, 0.6);
    display: flex; justify-content: center; align-items: center; z-index: 10000; 
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    opacity: 0; transition: opacity 0.25s ease;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f172a 100%);
    border-radius: 20px; 
    border: 1px solid rgba(148, 163, 184, 0.12);
    max-width: 540px; width: 92%; max-height: 82vh; overflow-y: auto;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(148, 163, 184, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transform: translateY(20px) scale(0.97); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // v3.7.5: 발행한 포스팅 HTML — 클릭 시 외부 브라우저로 이동
  //   각 항목: 제목 + 플랫폼 + 시간 + "열기" 버튼 (open-external IPC)
  const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const publishedHtml = dayPublished.length > 0
    ? dayPublished.map((p, idx) => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px;
             background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.18);
             border-radius: 10px; margin-bottom: 6px;">
          <span style="font-size: 16px;">📤</span>
          <div style="flex: 1; min-width: 0;">
            <div style="color: #dbeafe; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(p.title || '')}">
              ${escapeHtml(p.title || '제목없음')}
            </div>
            <div style="color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 2px;">
              ${escapeHtml(p.platform || '')} · ${escapeHtml(p.time || '')}
            </div>
          </div>
          <button onclick="window.openPublishedLink && window.openPublishedLink('${encodeURIComponent(p.url || '')}')"
                  style="padding: 6px 12px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white;
                         border: none; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap;">
            🔗 열기
          </button>
          <button onclick="window.removePublishedRecord && window.removePublishedRecord('${dateKey}', ${idx})"
                  style="padding: 6px 8px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 10px; cursor: pointer;" title="기록에서 삭제">
            ✕
          </button>
        </div>
      `).join('')
    : '<div style="padding: 14px; text-align: center; color: rgba(255,255,255,0.35); font-size: 12px;">이 날 발행한 글이 없습니다</div>';

  modalContent.innerHTML = `
    <!-- 헤더 -->
    <div style="padding: 24px 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            ${isToday ? '<span style="padding: 2px 8px; background: rgba(14, 165, 233, 0.15); color: #38bdf8; border-radius: 6px; font-size: 11px; font-weight: 600;">오늘</span>' : ''}
            <span style="color: #64748b; font-size: 12px; font-weight: 500;">${yearStr}</span>
          </div>
          <h2 style="color: #f1f5f9; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.3px;">
            ${monthDay}
          </h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0; font-weight: 500;">${dayOfWeek}</p>
        </div>
        <button onclick="this.closest('.work-diary-modal').remove()" 
                style="background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.1); 
                       color: #94a3b8; width: 32px; height: 32px; border-radius: 10px; cursor: pointer; 
                       display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;"
                onmouseover="this.style.background='rgba(148, 163, 184, 0.15)';this.style.color='#e2e8f0'"
                onmouseout="this.style.background='rgba(148, 163, 184, 0.08)';this.style.color='#94a3b8'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- 구분선 -->
    <div style="height: 1px; background: rgba(148, 163, 184, 0.08); margin: 16px 0;"></div>

    <!-- v3.7.5: 발행한 포스팅 (일기장) -->
    <div style="padding: 0 24px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-size: 14px;">📤</span>
          <span style="color: #94a3b8; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">발행한 글 (${dayPublished.length}건)</span>
        </div>
        ${publishedHtml}
      </div>

      <!-- v3.7.5: 일일 메모 -->
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(148,163,184,0.1);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">💭</span>
            <span style="color: #94a3b8; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">오늘의 메모</span>
          </div>
          <button onclick="window.saveDailyMemo && window.saveDailyMemo('${dateKey}')"
                  style="padding: 5px 11px; background: linear-gradient(135deg, #a78bfa, #8b5cf6); color: white; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
            💾 저장
          </button>
        </div>
        <textarea id="dailyMemoTextarea-${dateKey}" placeholder="이 날의 메모를 자유롭게 적어보세요...&#10;예: 오늘 잘된 키워드, 시도해볼 아이디어, 발행 후 반응 등"
                  style="width: 100%; min-height: 90px; padding: 12px; background: rgba(167,139,250,0.06); border: 1px solid rgba(167,139,250,0.2); color: #e2e8f0; font-size: 13px; border-radius: 10px; resize: vertical; font-family: inherit; line-height: 1.5;">${escapeHtml(dailyMemoValue)}</textarea>
      </div>
    </div>

    <div style="height: 20px;"></div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 등장 애니메이션
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
    modalContent.style.transform = 'translateY(0) scale(1)';
  });

  // 배경 클릭시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // ESC 키로 닫기
  const escHandler = (e) => {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  // Cleanup 함수
  const cleanupEventListeners = () => {
    document.removeEventListener('keydown', escHandler);
    console.log('🧹 [WORK_DIARY] 이벤트 리스너 정리 완료');
  };

  modal._cleanupEventListeners = cleanupEventListeners;
}

// 작업 기록 완료 토글
export function toggleWorkRecordCompletion(recordId, dateKey, isCompleted) {
  if (workDiary[dateKey]) {
    const record = workDiary[dateKey].find(r => r.id == recordId);
    if (record) {
      record.completed = isCompleted;
      const storage = getStorageManager();
      storage.setSync('workDiary', workDiary, true);

      const currentModal = document.querySelector('.work-diary-modal');
      if (currentModal) {
        const date = new Date(dateKey);
        try {
          document.body.removeChild(currentModal);
          showWorkDiary(date);
        } catch (error) {
          console.log('Modal refresh error:', error);
        }
      }
    }
  }
}

// 작업 기록 삭제
export function deleteWorkRecord(recordId, dateKey) {
  if (workDiary[dateKey]) {
    workDiary[dateKey] = workDiary[dateKey].filter(record => record.id != recordId);
    if (workDiary[dateKey].length === 0) {
      delete workDiary[dateKey];
    }
    const storage = getStorageManager();
    storage.setSync('workDiary', workDiary, true);

    renderCalendar();

    const modals = document.querySelectorAll('[style*="position: fixed"]');
    if (modals.length > 0) {
      const date = new Date(dateKey);
      modals[0].remove();
      showWorkDiary(date);
    }
  }
}

// 오늘 작업 기록 자동 추가
export function addTodayWorkRecord(workType, details = '') {
  const today = new Date();
  const record = `${workType}${details ? ': ' + details : ''}`;
  console.log('Adding work record:', record);
  saveWorkRecord(today, record);
  renderCalendar();
}

// 빠른 작업 기록 추가
export function addQuickWorkRecord(taskType) {
  const textarea = document.getElementById('workRecordInput');
  if (textarea) {
    textarea.value = taskType;
    textarea.focus();
  }
}

// 작업 기록 템플릿 추가
export function addWorkRecordTemplate(template) {
  const textarea = document.getElementById('workRecordInput');
  if (textarea) {
    textarea.value = template;
    textarea.focus();
  }
}

// 모달에서 작업 기록 저장
export function saveWorkRecordFromModal(date) {
  const input = document.getElementById('workRecordInput');
  if (input && input.value.trim()) {
    saveWorkRecord(date, input.value.trim());
    input.value = '';
    const dateKey = formatDateKey(date);
    const dateObj = new Date(dateKey);
    // 모달 제거 후 재표시
    const modal = document.querySelector('.work-diary-modal');
    if (modal) modal.remove();
    showWorkDiary(dateObj);
    renderCalendar();
  }
}

// 모달에서 예약 발행 추가
export function addScheduleFromModal(dateStr) {
  const topicInput = document.getElementById('scheduleTopicInput');
  const timeInput = document.getElementById('scheduleTimeInput');
  const keywordsInput = document.getElementById('scheduleKeywordsInput');

  const topic = topicInput?.value?.trim();
  const time = timeInput?.value || '09:00';
  const keywords = keywordsInput?.value?.trim() || '';

  if (!topic) {
    alert('주제를 입력해주세요.');
    if (topicInput) topicInput.focus();
    return;
  }

  const scheduleData = {
    id: Date.now(),
    topic,
    keywords,
    date: dateStr,
    time,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  try {
    const existing = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
    const schedules = Array.isArray(existing) ? existing : [];
    schedules.push(scheduleData);
    localStorage.setItem('scheduledPosts', JSON.stringify(schedules));

    console.log('✅ [CALENDAR] 예약 추가:', scheduleData);

    // 모달 재표시
    const modal = document.querySelector('.work-diary-modal');
    if (modal) modal.remove();
    const [year, month, day] = dateStr.split('-').map(Number);
    showWorkDiary(new Date(year, month - 1, day));
    renderCalendar();
  } catch (e) {
    console.error('[CALENDAR] 예약 추가 실패:', e);
    alert('예약 추가에 실패했습니다.');
  }
}

// 예약 수정 모드 토글
export function editScheduleFromModal(scheduleId) {
  const viewEl = document.getElementById(`schedule-view-${scheduleId}`);
  const editEl = document.getElementById(`schedule-edit-${scheduleId}`);
  if (viewEl && editEl) {
    viewEl.style.display = 'none';
    editEl.style.display = 'block';
    // 주제 input에 포커스
    const topicInput = document.getElementById(`edit-topic-${scheduleId}`);
    if (topicInput) topicInput.focus();
  }
}

// 예약 수정 취소
export function cancelScheduleEdit(scheduleId) {
  const viewEl = document.getElementById(`schedule-view-${scheduleId}`);
  const editEl = document.getElementById(`schedule-edit-${scheduleId}`);
  if (viewEl && editEl) {
    editEl.style.display = 'none';
    viewEl.style.display = 'flex';
  }
}

// 예약 수정 저장
export function saveScheduleEdit(scheduleId) {
  const topic = document.getElementById(`edit-topic-${scheduleId}`)?.value?.trim();
  const date = document.getElementById(`edit-date-${scheduleId}`)?.value;
  const time = document.getElementById(`edit-time-${scheduleId}`)?.value || '09:00';
  const keywords = document.getElementById(`edit-keywords-${scheduleId}`)?.value?.trim() || '';

  if (!topic) {
    alert('주제를 입력해주세요.');
    return;
  }
  if (!date) {
    alert('날짜를 선택해주세요.');
    return;
  }

  try {
    const existing = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
    const schedules = Array.isArray(existing) ? existing : [];
    const idx = schedules.findIndex(s => s.id === scheduleId);
    if (idx === -1) {
      alert('해당 예약을 찾을 수 없습니다.');
      return;
    }

    schedules[idx] = { ...schedules[idx], topic, date, time, keywords };
    localStorage.setItem('scheduledPosts', JSON.stringify(schedules));

    console.log('✅ [CALENDAR] 예약 수정:', schedules[idx]);

    // 모달 재표시 (변경된 날짜 기준)
    const modal = document.querySelector('.work-diary-modal');
    if (modal) modal.remove();
    const [y, m, d] = date.split('-').map(Number);
    showWorkDiary(new Date(y, m - 1, d));
    renderCalendar();
  } catch (e) {
    console.error('[CALENDAR] 예약 수정 실패:', e);
    alert('예약 수정에 실패했습니다.');
  }
}

// v3.7.5: 일기장 헬퍼 — 발행 글 외부 브라우저로 열기 / 메모 저장 / 발행 기록 삭제
//   window 전역에 노출 (모달의 onclick에서 호출)
if (typeof window !== 'undefined') {
  window.openPublishedLink = async function (encodedUrl) {
    try {
      const url = decodeURIComponent(encodedUrl || '');
      if (!url || !/^https?:\/\//i.test(url)) {
        alert('잘못된 URL입니다.');
        return;
      }
      if (window.electronAPI?.invoke) {
        await window.electronAPI.invoke('open-external', url);
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      console.warn('[CALENDAR] open-external 실패:', e);
      try { window.open(decodeURIComponent(encodedUrl || ''), '_blank'); } catch {}
    }
  };

  window.saveDailyMemo = function (dateKey) {
    try {
      const ta = document.getElementById(`dailyMemoTextarea-${dateKey}`);
      if (!ta) return;
      const value = String(ta.value || '');
      const all = JSON.parse(localStorage.getItem('dailyMemo') || '{}');
      if (value.trim().length > 0) {
        all[dateKey] = value;
      } else {
        delete all[dateKey];
      }
      localStorage.setItem('dailyMemo', JSON.stringify(all));
      // 모달 닫고 달력 갱신
      const modal = document.querySelector('.work-diary-modal');
      if (modal) modal.remove();
      try { renderCalendar(); } catch {}
      // 저장 확인 미세 알림
      try {
        const tip = document.createElement('div');
        tip.textContent = '💾 메모 저장됨';
        tip.style.cssText = 'position: fixed; bottom: 24px; right: 24px; padding: 10px 16px; background: linear-gradient(135deg,#a78bfa,#8b5cf6); color: white; font-size: 13px; font-weight: 700; border-radius: 10px; z-index: 99999; box-shadow: 0 8px 24px rgba(139,92,246,0.5);';
        document.body.appendChild(tip);
        setTimeout(() => tip.remove(), 2000);
      } catch {}
    } catch (e) {
      console.warn('[CALENDAR] 메모 저장 실패:', e);
      alert('메모 저장 실패: ' + (e?.message || e));
    }
  };

  window.removePublishedRecord = function (dateKey, idx) {
    if (!confirm('이 발행 기록을 일기장에서 삭제할까요? (실제 발행한 글은 그대로 유지됩니다)')) return;
    try {
      const all = JSON.parse(localStorage.getItem('publishedPosts') || '{}');
      if (Array.isArray(all[dateKey])) {
        all[dateKey].splice(idx, 1);
        if (all[dateKey].length === 0) delete all[dateKey];
        localStorage.setItem('publishedPosts', JSON.stringify(all));
      }
      // 모달 새로고침
      const modal = document.querySelector('.work-diary-modal');
      if (modal) modal.remove();
      const [y, m, d] = dateKey.split('-').map(Number);
      showWorkDiary(new Date(y, m - 1, d));
      renderCalendar();
    } catch (e) {
      console.warn('[CALENDAR] 발행 기록 삭제 실패:', e);
    }
  };
}

