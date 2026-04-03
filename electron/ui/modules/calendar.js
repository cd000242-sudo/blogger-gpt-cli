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
    const hasWork = records.length > 0;
    const hasSchedule = daySchedules.length > 0;

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

    dayElement.innerHTML = cellHtml;

    // Tooltip
    let tip = [];
    if (hasWork) { tip.push('📝 작업기록:'); records.forEach(r => tip.push(`  · ${r.content || ''}`)); }
    if (hasSchedule) { tip.push('📌 예약:'); daySchedules.forEach(s => tip.push(`  · ${s.topic || ''} (${s.time || ''})`)); }
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
  const workRecords = getWorkRecords(date);
  const dateKey = formatDateKey(date);

  // 예약 발행 데이터 (배열 형태)
  let daySchedules = [];
  try {
    const allSchedules = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
    if (Array.isArray(allSchedules)) {
      daySchedules = allSchedules.filter(s => s.date === dateKey);
    }
  } catch (e) {
    console.warn('[CALENDAR] scheduledPosts 파싱 실패:', e);
  }

  // 요일/날짜 분리
  const dayOfWeek = date.toLocaleDateString('ko-KR', { weekday: 'long' });
  const monthDay = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  const yearStr = date.getFullYear();

  // 오늘 여부
  const today = new Date();
  const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  // 과거 날짜 여부 (오늘 이전)
  const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

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

  // 완료된/미완료 작업 수
  const completedCount = workRecords.filter(r => r.completed).length;
  const totalCount = workRecords.length;

  // 키워드 기록 HTML (기존 작업 기록)
  const recordsHtml = workRecords.length > 0 ? workRecords.map(record => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; 
         background: rgba(148, 163, 184, 0.05); border: 1px solid rgba(148, 163, 184, 0.08); 
         border-radius: 12px; margin-bottom: 8px; transition: all 0.2s ease;"
         onmouseover="this.style.background='rgba(148, 163, 184, 0.1)';this.style.borderColor='rgba(148, 163, 184, 0.15)'"
         onmouseout="this.style.background='rgba(148, 163, 184, 0.05)';this.style.borderColor='rgba(148, 163, 184, 0.08)'">
      <label style="display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; 
             border-radius: 6px; border: 2px solid ${record.completed ? '#10b981' : 'rgba(148, 163, 184, 0.3)'}; 
             background: ${record.completed ? 'rgba(16, 185, 129, 0.15)' : 'transparent'}; 
             cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;">
        <input type="checkbox" ${record.completed ? 'checked' : ''} 
               onchange="toggleWorkRecordCompletion(${record.id}, '${dateKey}', this.checked)"
               style="display: none;">
        ${record.completed ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
      </label>
      <div style="flex: 1; min-width: 0;">
        <div style="color: ${record.completed ? '#64748b' : '#e2e8f0'}; font-size: 13px; font-weight: 500; 
             ${record.completed ? 'text-decoration: line-through;' : ''} line-height: 1.4;">
          ${record.content}
        </div>
        <div style="color: #475569; font-size: 11px; margin-top: 2px;">${record.time}</div>
      </div>
      <button onclick="deleteWorkRecord(${record.id}, '${dateKey}')" 
              style="background: transparent; color: #64748b; border: none; padding: 6px; border-radius: 8px; 
                     cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; flex-shrink: 0;"
              onmouseover="this.style.background='rgba(239, 68, 68, 0.1)';this.style.color='#f87171'"
              onmouseout="this.style.background='transparent';this.style.color='#64748b'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `).join('') : `
    <div style="text-align: center; padding: 16px 0; color: #475569; font-size: 12px;">
      등록된 키워드가 없습니다
    </div>
  `;

  // 예약 발행 HTML (수정/실행/삭제 기능 포함)
  const schedulesHtml = daySchedules.length > 0 ? daySchedules.map(s => {
    const sColor = s.status === 'completed' ? '#10b981' : s.status === 'failed' ? '#ef4444' : s.status === 'running' ? '#3b82f6' : '#f59e0b';
    const sText = s.status === 'completed' ? '완료' : s.status === 'failed' ? '실패' : s.status === 'running' ? '실행중' : '대기중';
    const isRunnable = s.status !== 'completed' && s.status !== 'running';
    const isEditable = s.status !== 'completed' && s.status !== 'running';
    return `
    <div id="schedule-item-${s.id}" style="margin-bottom: 6px;">
      <!-- 보기 모드 -->
      <div id="schedule-view-${s.id}" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; 
           background: rgba(148, 163, 184, 0.04); border: 1px solid rgba(148, 163, 184, 0.08); 
           border-radius: 10px;">
        <span style="width: 7px; height: 7px; background: ${sColor}; border-radius: 50%; flex-shrink: 0;"></span>
        <div style="flex: 1; min-width: 0;">
          <div style="color: #e2e8f0; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.topic || '미정'}</div>
          <div style="color: #475569; font-size: 11px; margin-top: 1px;">${s.time || ''} · ${s.keywords || ''}</div>
        </div>
        <span style="padding: 2px 8px; background: ${sColor}20; color: ${sColor}; border-radius: 6px; font-size: 10px; font-weight: 600; flex-shrink: 0;">${sText}</span>
        ${isEditable ? `
        <button onclick="editScheduleFromModal(${s.id})" title="수정"
                style="background: transparent; color: #94a3b8; border: none; padding: 4px; border-radius: 6px; cursor: pointer; display: flex; flex-shrink: 0;"
                onmouseover="this.style.background='rgba(148, 163, 184, 0.1)';this.style.color='#e2e8f0'"
                onmouseout="this.style.background='transparent';this.style.color='#94a3b8'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>` : ''}
        ${isRunnable ? `
        <button onclick="executeSchedule(${s.id})" title="실행"
                style="background: transparent; color: #3b82f6; border: none; padding: 4px; border-radius: 6px; cursor: pointer; display: flex; flex-shrink: 0;"
                onmouseover="this.style.background='rgba(59, 130, 246, 0.1)'"
                onmouseout="this.style.background='transparent'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#3b82f6"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>` : ''}
        <button onclick="deleteSchedule(${s.id})" title="삭제"
                style="background: transparent; color: #64748b; border: none; padding: 4px; border-radius: 6px; cursor: pointer; display: flex; flex-shrink: 0;"
                onmouseover="this.style.background='rgba(239, 68, 68, 0.1)';this.style.color='#f87171'"
                onmouseout="this.style.background='transparent';this.style.color='#64748b'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <!-- 수정 모드 (기본 숨김) -->
      <div id="schedule-edit-${s.id}" style="display: none; padding: 12px; background: rgba(148, 163, 184, 0.06); 
           border: 1px solid rgba(14, 165, 233, 0.2); border-radius: 10px;">
        <!-- 날짜/시간 헤더 -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(148, 163, 184, 0.08);">
          <span style="color: #64748b; font-size: 11px; font-weight: 500;">📅</span>
          <input id="edit-date-${s.id}" type="date" value="${s.date || ''}"
                 style="padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.12); 
                        background: rgba(0, 0, 0, 0.2); color: #94a3b8; font-size: 11px; font-family: inherit; outline: none;">
          <span style="color: #64748b; font-size: 11px; font-weight: 500;">⏰</span>
          <input id="edit-time-${s.id}" type="time" value="${s.time || '09:00'}"
                 style="padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.12); 
                        background: rgba(0, 0, 0, 0.2); color: #94a3b8; font-size: 11px; font-family: inherit; outline: none;">
        </div>
        <!-- 주제 -->
        <input id="edit-topic-${s.id}" type="text" value="${(s.topic || '').replace(/"/g, '&quot;')}" placeholder="주제"
               style="width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.15); 
                      background: rgba(0, 0, 0, 0.25); color: #e2e8f0; font-size: 13px; font-family: inherit; outline: none;
                      margin-bottom: 8px; box-sizing: border-box;"
               onfocus="this.style.borderColor='rgba(14, 165, 233, 0.3)'"
               onblur="this.style.borderColor='rgba(148, 163, 184, 0.15)'">
        <!-- 키워드 + 저장/취소 -->
        <div style="display: flex; gap: 8px;">
          <input id="edit-keywords-${s.id}" type="text" value="${(s.keywords || '').replace(/"/g, '&quot;')}" placeholder="키워드 (쉼표로 구분)"
                 style="flex: 1; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.15); 
                        background: rgba(0, 0, 0, 0.25); color: #e2e8f0; font-size: 13px; font-family: inherit; outline: none;"
                 onfocus="this.style.borderColor='rgba(14, 165, 233, 0.3)'"
                 onblur="this.style.borderColor='rgba(148, 163, 184, 0.15)'">
          <button onclick="saveScheduleEdit(${s.id})" title="저장"
                  style="padding: 8px 14px; background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.2); 
                         border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; font-family: inherit; white-space: nowrap;
                         transition: all 0.2s ease;"
                  onmouseover="this.style.background='rgba(14, 165, 233, 0.25)'"
                  onmouseout="this.style.background='rgba(14, 165, 233, 0.15)'">저장</button>
          <button onclick="cancelScheduleEdit(${s.id})" title="취소"
                  style="padding: 8px 10px; background: transparent; color: #64748b; border: 1px solid rgba(148, 163, 184, 0.1); 
                         border-radius: 8px; cursor: pointer; font-size: 12px; font-family: inherit; white-space: nowrap;
                         transition: all 0.2s ease;"
                  onmouseover="this.style.background='rgba(148, 163, 184, 0.06)'"
                  onmouseout="this.style.background='transparent'">취소</button>
        </div>
      </div>
    </div>`;
  }).join('') : '';

  // 날짜 포맷 (input용)
  const dateInputValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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

    <!-- 키워드 기록 섹션 -->
    <div style="padding: 0 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; 
                 background: rgba(16, 185, 129, 0.12); border-radius: 6px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </span>
          <span style="color: #94a3b8; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">키워드 기록</span>
        </div>
        ${totalCount > 0 ? `<span style="color: #475569; font-size: 11px; font-weight: 500;">${completedCount}/${totalCount} 완료</span>` : ''}
      </div>
      <div id="workRecordsList">
        ${recordsHtml}
      </div>
      <!-- 키워드 추가 -->
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <input id="workRecordInput" type="text" placeholder="키워드를 입력하세요..." 
               style="flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.1); 
                      background: rgba(148, 163, 184, 0.04); color: #e2e8f0; font-size: 13px; font-family: inherit;
                      outline: none; transition: all 0.2s ease;"
               onfocus="this.style.borderColor='rgba(14, 165, 233, 0.3)';this.style.boxShadow='0 0 0 3px rgba(14, 165, 233, 0.06)'"
               onblur="this.style.borderColor='rgba(148, 163, 184, 0.1)';this.style.boxShadow='none'">
        <button onclick="saveWorkRecordFromModal(new Date(${date.getFullYear()}, ${date.getMonth()}, ${date.getDate()}))" 
                style="padding: 10px 16px; background: linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%); 
                       color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.2); border-radius: 10px; 
                       cursor: pointer; font-weight: 600; font-size: 12px; font-family: inherit; white-space: nowrap;
                       transition: all 0.2s ease; display: flex; align-items: center; gap: 4px;"
                onmouseover="this.style.background='linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%)'"
                onmouseout="this.style.background='linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          추가
        </button>
      </div>
    </div>

    <!-- 구분선 -->
    <div style="height: 1px; background: rgba(148, 163, 184, 0.08); margin: 16px 0;"></div>

    <!-- 예약 발행 섹션 -->
    <div style="padding: 0 24px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; 
               background: rgba(245, 158, 11, 0.12); border-radius: 6px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </span>
        <span style="color: #94a3b8; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">예약 발행</span>
        ${daySchedules.length > 0 ? `<span style="color: #475569; font-size: 11px; font-weight: 500;">${daySchedules.length}건</span>` : ''}
      </div>
      
      ${schedulesHtml || `<div style="text-align: center; padding: 12px 0; color: #475569; font-size: 12px;">예약된 발행이 없습니다</div>`}

      ${!isPast ? `
      <!-- 예약 추가 폼 -->
      <div style="margin-top: 10px; padding: 14px; background: rgba(245, 158, 11, 0.04); border: 1px solid rgba(245, 158, 11, 0.1); border-radius: 12px;">
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input id="scheduleTopicInput" type="text" placeholder="주제 (예: 다이어트 식단)" 
                 style="flex: 1; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.1); 
                        background: rgba(0, 0, 0, 0.2); color: #e2e8f0; font-size: 12px; font-family: inherit; outline: none;"
                 onfocus="this.style.borderColor='rgba(245, 158, 11, 0.3)'"
                 onblur="this.style.borderColor='rgba(148, 163, 184, 0.1)'">
          <input id="scheduleTimeInput" type="time" value="09:00"
                 style="width: 90px; padding: 9px 8px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.1); 
                        background: rgba(0, 0, 0, 0.2); color: #e2e8f0; font-size: 12px; font-family: inherit; outline: none;">
        </div>
        <div style="display: flex; gap: 8px;">
          <input id="scheduleKeywordsInput" type="text" placeholder="키워드 (쉼표로 구분)" 
                 style="flex: 1; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.1); 
                        background: rgba(0, 0, 0, 0.2); color: #e2e8f0; font-size: 12px; font-family: inherit; outline: none;"
                 onfocus="this.style.borderColor='rgba(245, 158, 11, 0.3)'"
                 onblur="this.style.borderColor='rgba(148, 163, 184, 0.1)'">
          <button onclick="addScheduleFromModal('${dateInputValue}')"
                  style="padding: 9px 14px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.15) 100%); 
                         color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; 
                         cursor: pointer; font-weight: 600; font-size: 12px; font-family: inherit; white-space: nowrap;
                         transition: all 0.2s ease; display: flex; align-items: center; gap: 4px;"
                  onmouseover="this.style.background='linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(234, 88, 12, 0.25) 100%)'"
                  onmouseout="this.style.background='linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.15) 100%)'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            예약
          </button>
        </div>
      </div>
      ` : ''}
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

  // Enter 키로 키워드 추가
  requestAnimationFrame(() => {
    const input = modal.querySelector('#workRecordInput');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const btn = modal.querySelector('#workRecordInput').parentElement.querySelector('button');
          if (btn) btn.click();
        }
      });
      input.focus();
    }
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

