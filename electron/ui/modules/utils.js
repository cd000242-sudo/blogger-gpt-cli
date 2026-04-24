// 🔧 유틸리티 함수들
import { debounce } from './core.js';

// 키워드 카운트 업데이트 (debounced)
export const updateKeywordCount = debounce(function () {
  const keywordList = document.getElementById('keywordList');
  if (!keywordList) return;

  const keywordItems = keywordList.querySelectorAll('.keyword-item');
  const count = keywordItems.length;

  const countElement = document.getElementById('keywordCount');
  if (countElement) {
    countElement.textContent = `${count}개`;
  }
}, 300);

// 키워드 추가
export function addKeyword() {
  const keywordList = document.getElementById('keywordList');
  if (!keywordList) return;

  const keywordItem = document.createElement('div');
  keywordItem.className = 'keyword-item';
  keywordItem.innerHTML = `
    <input type="text" class="keyword-input" placeholder="키워드 입력">
    <select class="keyword-title-select">
      <option value="auto">AI 생성</option>
      <option value="custom">직접 입력</option>
    </select>
    <input type="text" class="custom-title-input" placeholder="제목 직접 입력" style="display: none;">
    <button class="remove-keyword-btn" onclick="removeKeyword(this)">삭제</button>
  `;

  keywordList.appendChild(keywordItem);
  updateKeywordCount();
}

// 키워드 삭제
export function removeKeyword(button) {
  const keywordItem = button.closest('.keyword-item');
  if (keywordItem) {
    keywordItem.remove();
    updateKeywordCount();
  }
}

// 모든 키워드 가져오기
export function getAllKeywords() {
  const keywordList = document.getElementById('keywordList');
  if (!keywordList) return [];

  const keywords = [];
  const keywordItems = keywordList.querySelectorAll('.keyword-item');
  keywordItems.forEach(item => {
    const keywordInput = item.querySelector('.keyword-input');
    const titleSelect = item.querySelector('.keyword-title-select');
    if (keywordInput && keywordInput.value.trim()) {
      keywords.push({
        keyword: keywordInput.value.trim(),
        title: titleSelect?.value === 'custom' ? item.querySelector('.custom-title-input')?.value.trim() : null
      });
    }
  });

  return keywords;
}

// H2 이미지 섹션 및 소스 정보 가져오기
export function getH2ImageSections() {
  const selectedSections = Array.from(document.querySelectorAll('input[name="h2Sections"]:checked'))
    .map(input => parseInt(input.value));

  // 🔥 소스 우선순위: 환경설정의 #h2ImageSource select → h2ImageSource 라디오 → semiAutoImageSource 라디오 → 기본값
  //    사용자가 상세설정에서 고른 값(select)이 반자동 모드 라디오보다 우선해야 함.
  const selectEl = document.getElementById('h2ImageSource');
  const h2Radio = document.querySelector('input[name="h2ImageSource"]:checked');
  const semiAutoRadio = document.querySelector('input[name="semiAutoImageSource"]:checked');
  const source = selectEl?.value
    || h2Radio?.value
    || semiAutoRadio?.value
    || 'imagefx';

  return {
    source: source,
    sections: selectedSections
  };
}

// 날짜 포맷팅
export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 시간 포맷팅
export function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 실시간 시계 업데이트
export function updateRealtimeClock() {
  const clockElement = document.getElementById('realtime-clock');
  if (!clockElement) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  clockElement.textContent = `${hours}:${minutes}:${seconds}`;
}

// 실시간 날짜 업데이트
export function updateRealtimeDate() {
  const dateElement = document.getElementById('realtime-date');
  const calendarMonthElement = document.getElementById('calendar-month');

  const now = new Date();

  // 날짜 업데이트
  if (dateElement) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateElement.textContent = now.toLocaleDateString('ko-KR', options);
  }

  // 달력 월 업데이트
  if (calendarMonthElement) {
    calendarMonthElement.textContent = `${now.getMonth() + 1}월`;
  }

  // 달력 날짜 업데이트
  updateCalendarDates();
}

// 달력 메모 저장소
let calendarMemos = {};

// 달력 메모 로드
function loadCalendarMemos() {
  try {
    const saved = localStorage.getItem('calendarMemos');
    if (saved) {
      calendarMemos = JSON.parse(saved);
    }
  } catch (error) {
    console.error('[CALENDAR] 메모 로드 실패:', error);
    calendarMemos = {};
  }
}

// 달력 메모 저장
function saveCalendarMemos() {
  try {
    localStorage.setItem('calendarMemos', JSON.stringify(calendarMemos));
  } catch (error) {
    console.error('[CALENDAR] 메모 저장 실패:', error);
  }
}

// 달력 날짜 클릭 핸들러
export function onCalendarDateClick(year, month, day) {
  const dateKey = `${year}-${month + 1}-${day}`;
  const memo = calendarMemos[dateKey] || { text: '', completed: false };

  // 커스텀 모달 생성
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(10px);
  `;

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 24px; padding: 3px; max-width: 600px; width: 90%; box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4);">
      <div style="background: white; border-radius: 22px; padding: 36px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 12px 24px; border-radius: 16px; margin-bottom: 12px;">
            <h3 style="color: white; font-size: 24px; font-weight: 800; margin: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">
              📅 ${year}년 ${month + 1}월 ${day}일
            </h3>
          </div>
          <p style="color: #666; font-size: 14px; margin: 0;">할 일을 입력하고 체크박스로 완료 표시하세요</p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 700; color: #333; font-size: 15px;">📝 할 일 목록</label>
          <textarea id="calendarMemoInput" 
                    style="width: 100%; min-height: 150px; padding: 16px; border: 2px solid #e1e5e9; border-radius: 12px; font-size: 15px; font-family: inherit; resize: vertical; transition: all 0.3s ease; line-height: 1.6;"
                    placeholder="예시:&#10;- 블로그 글 3개 작성하기&#10;- 키워드 조사&#10;- 이미지 준비"
                    onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)';"
                    onblur="this.style.borderColor='#e1e5e9'; this.style.boxShadow='none';">${memo.text || ''}</textarea>
        </div>
        
        <div style="background: ${memo.completed ? '#d1fae5' : '#fef3c7'}; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid ${memo.completed ? '#10b981' : '#f59e0b'};">
          <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
            <input type="checkbox" id="completedCheckbox" ${memo.completed ? 'checked' : ''} 
                   style="width: 24px; height: 24px; cursor: pointer; margin-right: 12px; accent-color: #10b981;">
            <span style="font-size: 16px; font-weight: 700; color: ${memo.completed ? '#059669' : '#d97706'};">
              ${memo.completed ? '✅ 완료됨' : '⏳ 진행 중'}
            </span>
          </label>
        </div>
        
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px;">
          <button id="saveMemoBtn" 
                  style="padding: 16px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 16px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;"
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)';"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(16, 185, 129, 0.3)';">
            💾 저장
          </button>
          <button id="deleteMemoBtn" 
                  style="padding: 16px 24px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 16px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); transition: all 0.3s ease;"
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.4)';"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(239, 68, 68, 0.3)';">
            🗑️
          </button>
          <button id="cancelMemoBtn" 
                  style="padding: 16px 24px; background: #f8f9fa; color: #666; border: 2px solid #e1e5e9; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 16px; transition: all 0.3s ease;"
                  onmouseover="this.style.background='#e9ecef'; this.style.borderColor='#cbd5e1';"
                  onmouseout="this.style.background='#f8f9fa'; this.style.borderColor='#e1e5e9';">
            ✕
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = document.getElementById('calendarMemoInput');
  const completedCheckbox = document.getElementById('completedCheckbox');
  const saveBtn = document.getElementById('saveMemoBtn');
  const deleteBtn = document.getElementById('deleteMemoBtn');
  const cancelBtn = document.getElementById('cancelMemoBtn');

  // 포커스
  setTimeout(() => input.focus(), 100);

  // 저장
  saveBtn.onclick = () => {
    const newText = input.value.trim();
    const isCompleted = completedCheckbox.checked;

    if (newText === '') {
      delete calendarMemos[dateKey];
    } else {
      calendarMemos[dateKey] = {
        text: newText,
        completed: isCompleted
      };
    }
    saveCalendarMemos();
    updateCalendarDates();
    modal.remove();
  };

  // 삭제
  deleteBtn.onclick = () => {
    delete calendarMemos[dateKey];
    saveCalendarMemos();
    updateCalendarDates();
    modal.remove();
  };

  // 취소
  cancelBtn.onclick = () => {
    modal.remove();
  };

  // 배경 클릭 시 닫기
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
}

// 달력 메모 완료 토글
export function toggleCalendarMemoComplete(year, month, day) {
  const dateKey = `${year}-${month + 1}-${day}`;
  const memo = calendarMemos[dateKey];

  if (memo) {
    memo.completed = !memo.completed;
    saveCalendarMemos();
    updateCalendarDates();
  }
}

// 달력 날짜 업데이트
function updateCalendarDates() {
  const calendarDatesElement = document.getElementById('calendar-dates');
  if (!calendarDatesElement) return;

  // 메모 로드
  loadCalendarMemos();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  // 이번 달의 첫 날과 마지막 날
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)

  let datesHTML = '';

  // 빈 칸 추가 (이전 달)
  for (let i = 0; i < startingDayOfWeek; i++) {
    datesHTML += '<div style="padding: 8px; color: rgba(255, 255, 255, 0.3);"></div>';
  }

  // 날짜 추가
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === today;
    const dayOfWeek = (startingDayOfWeek + day - 1) % 7;
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    const dateKey = `${year}-${month + 1}-${day}`;
    const hasMemo = calendarMemos[dateKey] && calendarMemos[dateKey].text;
    const isCompleted = calendarMemos[dateKey] && calendarMemos[dateKey].completed;

    let style = 'padding: 8px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; position: relative;';

    if (isToday) {
      style += ' background: rgba(255, 215, 0, 0.5); color: #ffd700; box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);';
    } else if (hasMemo) {
      // 메모가 있는 날짜는 금색
      style += ' color: #ffd700; font-weight: 800;';
      if (isCompleted) {
        style += ' text-decoration: line-through; opacity: 0.7;';
      }
    } else if (isSunday) {
      style += ' color: #ef4444;';
    } else if (isSaturday) {
      style += ' color: #87ceeb;';
    } else {
      style += ' color: rgba(255, 255, 255, 0.9);';
    }

    const memoIndicator = hasMemo ? '<div style="position: absolute; top: 2px; right: 2px; width: 6px; height: 6px; background: #ffd700; border-radius: 50%;"></div>' : '';

    datesHTML += `
      <div style="${style}" 
           onclick="onCalendarDateClick(${year}, ${month}, ${day})"
           oncontextmenu="event.preventDefault(); toggleCalendarMemoComplete(${year}, ${month}, ${day}); return false;"
           onmouseover="this.style.background='rgba(255, 215, 0, 0.3)'"
           onmouseout="this.style.background='${isToday ? 'rgba(255, 215, 0, 0.5)' : 'transparent'}'">
        ${memoIndicator}
        ${day}
      </div>
    `;
  }

  calendarDatesElement.innerHTML = datesHTML;
}

// 전역 함수로 등록
window.onCalendarDateClick = onCalendarDateClick;
window.toggleCalendarMemoComplete = toggleCalendarMemoComplete;

// 진행 단계 초기화
export function initializeProgressSteps() {
  const stepsContainer = document.getElementById('progressSteps');
  if (!stepsContainer) return;

  const steps = [
    { id: 'step1', label: '콘텐츠 생성 준비', status: 'pending' },
    { id: 'step2', label: '제목 생성', status: 'pending' },
    { id: 'step3', label: '본문 생성', status: 'pending' },
    { id: 'step4', label: '이미지 생성', status: 'pending' },
    { id: 'step5', label: '발행 준비', status: 'pending' }
  ];

  stepsContainer.innerHTML = steps.map(step => `
    <div class="progress-step ${step.status}" id="${step.id}">
      <div class="step-icon">⏳</div>
      <div class="step-label">${step.label}</div>
    </div>
  `).join('');
}

// 진행 단계 리셋
export function resetProgressSteps() {
  const steps = document.querySelectorAll('.progress-step');
  steps.forEach(step => {
    step.classList.remove('completed', 'active', 'error');
    step.classList.add('pending');
    const icon = step.querySelector('.step-icon');
    if (icon) icon.textContent = '⏳';
  });
}

// 진행 단계 업데이트
export function updateProgressStep(stepId, status) {
  const step = document.getElementById(stepId);
  if (!step) return;

  step.classList.remove('pending', 'active', 'completed', 'error');
  step.classList.add(status);

  const icon = step.querySelector('.step-icon');
  if (icon) {
    switch (status) {
      case 'active':
        icon.textContent = '🔄';
        break;
      case 'completed':
        icon.textContent = '✅';
        break;
      case 'error':
        icon.textContent = '❌';
        break;
      default:
        icon.textContent = '⏳';
    }
  }
}
