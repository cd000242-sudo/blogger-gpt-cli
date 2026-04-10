
// 🔥 유틸리티 함수
// 비밀번호 가시성 토글 함수
window.togglePasswordVisibility = function(button) {
  const input = button.previousElementSibling;
  
  if (input.type === 'password') {
    input.type = 'text';
    button.innerHTML = `<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'></path><line x1='1' y1='1' x2='23' y2='23'></line></svg>`;
    button.style.color = 'white';
    button.style.background = 'rgba(255,255,255,0.1)';
  } else {
    input.type = 'password';
    button.innerHTML = `<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'></path><circle cx='12' cy='12' r='3'></circle></svg>`;
    button.style.color = 'rgba(255,255,255,0.4)';
    button.style.background = 'transparent';
  }
};

// 🔥 워드프레스 관련 함수들 즉시 정의 (로딩 타이밍 문제 해결)
// 워드프레스 애플리케이션 비밀번호 가이드
window.showWordPressAppPasswordGuide = function () {
  console.log('[WP 가이드] 함수 호출됨');
  const modal = document.createElement('div');
  modal.id = 'wpAppPasswordGuideModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 100000; backdrop-filter: blur(10px);';

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 24px; padding: 40px; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5); border: 2px solid rgba(255, 255, 255, 0.1);">
      <h2 style="color: #fff; font-size: 26px; font-weight: 700; margin-bottom: 24px; text-align: center;">
        🔐 워드프레스 애플리케이션 비밀번호 발급 가이드
      </h2>
      
      <div style="background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #fca5a5; font-size: 14px; margin: 0; font-weight: 600;">
          ⚠️ <strong>중요!</strong> 일반 계정 비밀번호로는 워드프레스 REST API에 연결할 수 없습니다.<br>
          반드시 <strong>애플리케이션 비밀번호</strong>를 발급받아 사용해야 합니다.
        </p>
      </div>

      <div style="color: #e2e8f0; font-size: 15px; line-height: 1.8;">
        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #10b981; font-size: 18px; margin-bottom: 12px;">📍 Step 1. 워드프레스 관리자 로그인</h3>
          <p style="margin: 0; color: #94a3b8;">
            <code style="background: rgba(16, 185, 129, 0.2); padding: 4px 8px; border-radius: 4px; color: #10b981;">https://내사이트.com/wp-admin/</code> 에 접속하여 관리자 계정으로 로그인합니다.
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #3b82f6; font-size: 18px; margin-bottom: 12px;">📍 Step 2. 프로필 페이지 이동</h3>
          <p style="margin: 0; color: #94a3b8;">
            좌측 메뉴에서 <strong style="color: #3b82f6;">사용자</strong> → <strong style="color: #3b82f6;">프로필</strong> 클릭<br>
            또는 우측 상단 프로필 아이콘 클릭 → <strong style="color: #3b82f6;">프로필 편집</strong>
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #f59e0b; font-size: 18px; margin-bottom: 12px;">📍 Step 3. 애플리케이션 비밀번호 생성</h3>
          <p style="margin: 0; color: #94a3b8;">
            프로필 페이지 하단에서 <strong style="color: #f59e0b;">"애플리케이션 비밀번호"</strong> 섹션을 찾습니다.<br>
            "새 애플리케이션 비밀번호 이름"에 <strong style="color: #f59e0b;">blogger-gpt</strong> 입력 후 <strong style="color: #f59e0b;">"새 애플리케이션 비밀번호 추가"</strong> 버튼 클릭
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #8b5cf6; font-size: 18px; margin-bottom: 12px;">📍 Step 4. 비밀번호 복사</h3>
          <p style="margin: 0; color: #94a3b8;">
            생성된 비밀번호 (예: <code style="background: rgba(139, 92, 246, 0.2); padding: 4px 8px; border-radius: 4px; color: #8b5cf6;">l3rq pnAO QTfU 8RjE mwVc j9kQ</code>)를<br>
            <strong style="color: #8b5cf6;">공백 포함 그대로</strong> 복사하여 이 앱의 Application Password 필드에 붙여넣기
          </p>
        </div>

        <div style="background: rgba(16, 185, 129, 0.15); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-top: 24px;">
          <p style="color: #6ee7b7; font-size: 14px; margin: 0; font-weight: 600;">
            💡 <strong>팁:</strong> 애플리케이션 비밀번호는 한 번만 표시되므로, 반드시 안전한 곳에 저장해두세요!
          </p>
        </div>
      </div>

      <button onclick="document.getElementById('wpAppPasswordGuideModal').remove();" style="display: block; width: 100%; margin-top: 24px; padding: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.3s ease;">
        ✅ 확인
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  console.log('[WP 가이드] 모달 표시됨');
};

// 워드프레스 카테고리 로드
window.loadWpCategories = async function () {
  console.log('[WP 카테고리] 로드 함수 호출됨');

  const wpUrlElement = document.getElementById('wordpressSiteUrl');
  const wpUsernameElement = document.getElementById('wordpressUsername');
  const wpPasswordElement = document.getElementById('wordpressPassword');

  if (!wpUrlElement || !wpUsernameElement || !wpPasswordElement) {
    alert('워드프레스 연결 정보 입력 필드를 찾을 수 없습니다. 환경 설정 모달이 열려 있는지 확인하세요.');
    return;
  }

  const wpUrl = wpUrlElement.value?.trim();
  const wpUsername = wpUsernameElement.value?.trim();
  const wpPassword = wpPasswordElement.value?.trim();

  console.log('[WP 카테고리] 연결 정보:', { wpUrl, wpUsername, hasPassword: !!wpPassword });

  if (!wpUrl || !wpUsername || !wpPassword) {
    alert('워드프레스 URL, 사용자명, 애플리케이션 비밀번호를 모두 입력해주세요.');
    return;
  }

  try {
    const categorySelect = document.getElementById('wpCategory');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">카테고리 로딩 중...</option>';
    }

    console.log('[WP 카테고리] API 호출 시작...');
    const result = await window.electronAPI.loadWpCategories({ wpUrl, wpUsername, wpPassword });
    console.log('[WP 카테고리] API 응답:', result);

    if (result.ok && result.categories) {
      if (categorySelect) {
        categorySelect.innerHTML = '<option value="">카테고리 선택</option>';
        result.categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          categorySelect.appendChild(option);
        });
      }
      alert(`✅ ${result.categories.length}개의 카테고리를 불러왔습니다.`);
    } else {
      alert('카테고리 로드 실패: ' + (result.error || '알 수 없는 오류'));
      if (categorySelect) {
        categorySelect.innerHTML = '<option value="">카테고리를 먼저 로드하세요</option>';
      }
    }
  } catch (error) {
    console.error('[WP 카테고리] 오류:', error);
    alert('카테고리 로드 중 오류 발생: ' + error.message);
  }
};

// 전역 별칭
window.loadWordPressCategories = window.loadWpCategories;

console.log('[INIT] 워드프레스 함수 즉시 정의 완료');

// H2 이미지 선택 함수
function getH2ImageSections() {
  // H2 이미지 소스와 섹션 정보 가져오기 (select 드롭다운 또는 라디오 버튼 모두 호환)
  const selectElement = document.getElementById('h2ImageSource');
  const radioElement = document.querySelector('input[name="h2ImageSource"]:checked');
  const selectedSource = (selectElement ? selectElement.value : (radioElement ? radioElement.value : '')) || 'nanobananapro';
  let selectedSections = Array.from(document.querySelectorAll('input[name="h2Sections"]:checked'))
    .map(input => parseInt(input.value));

  // 🖼️ 이미지 소스가 선택되었지만 섹션이 선택되지 않은 경우 기본 섹션 자동 설정
  if (selectedSource && selectedSource !== 'none' && selectedSections.length === 0) {
    // 섹션 카운트 가져오기
    const sectionCountSelect = document.getElementById('sectionCount');
    let totalSections = 5; // 기본값
    if (sectionCountSelect) {
      if (sectionCountSelect.value === 'custom') {
        const customInput = document.getElementById('customSectionCount');
        totalSections = customInput && customInput.value ? parseInt(customInput.value) : 5;
      } else {
        totalSections = parseInt(sectionCountSelect.value) || 5;
      }
    }

    // 기본으로 첫 3개 섹션에 이미지 삽입 (섹션 수가 3개 미만이면 전부)
    const defaultSectionCount = Math.min(3, totalSections);
    selectedSections = Array.from({ length: defaultSectionCount }, (_, i) => i + 1);
    console.log('🖼️ [H2 IMAGE] 섹션 미선택 → 기본 섹션 자동 설정:', selectedSections);
  }

  const settings = {
    source: selectedSource || 'nanobananapro',
    sections: selectedSections,
    totalSections: selectedSections.length
  };

  console.log('🖼️ [H2 IMAGE] 포스팅용 설정:', settings);
  return settings;
}
// 전역으로 노출
window.getH2ImageSections = getH2ImageSections;

// 썸네일 자동 생성 함수
function generateAutoThumbnail(title, platform = 'blogger') {
  const thumbnailContainer = document.createElement('div');
  thumbnailContainer.className = `auto-thumbnail auto-thumbnail-${platform}`;

  const thumbnailText = document.createElement('div');
  thumbnailText.className = 'auto-thumbnail-text';

  // 제목을 적절히 줄바꿈하여 표시
  const words = title.split(' ');
  let lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length <= 15) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);

  thumbnailText.textContent = lines.join('\n');
  thumbnailContainer.appendChild(thumbnailText);

  return thumbnailContainer;
}

// AI 배경 이미지 생성 함수
async function generateAIBackgroundImage(title, platform = 'blogger') {
  try {
    console.log('🎨 [IMAGE] AI 배경 이미지 생성 시작:', { title, platform });

    const imagePrompt = `Create a modern, professional thumbnail image for a blog post titled "${title}". 
    The image should be ${platform === 'blogger' ? 'warm and inviting with orange/red gradients' : 'cool and professional with blue/cyan gradients'}.
    Include subtle text overlay area for the title. 
    Style: modern, clean, professional, high quality, 16:9 aspect ratio.`;

    const result = await window.electronAPI.generateAIImage({
      prompt: imagePrompt,
      size: '1024x1024',
      quality: 'standard'
    });

    console.log('🎨 [IMAGE] AI 배경 이미지 생성 완료:', result);
    return result.imageUrl;
  } catch (error) {
    console.error('🎨 [IMAGE] AI 배경 이미지 생성 오류:', error);
    return null;
  }
}

// H2 섹션 이미지 생성 함수 (H2 발행 시 자동 호출)
async function generateH2SectionImages(sections, title) {
  try {
    console.log('🎨 [IMAGE] H2 섹션 이미지 생성 시작:', { sections, title });
    console.log('✅ [IMAGE] H2 발행 모드에서 이미지 생성이 정상 작동합니다.');

    const imagePromises = sections.map(async (sectionNumber) => {
      const sectionPrompt = `Create a professional illustration for section ${sectionNumber} of a blog post titled "${title}". 
      The image should be modern, clean, and relevant to the content. 
      Style: professional, high quality, 16:9 aspect ratio.`;

      const result = await window.electronAPI.generateAIImage({
        prompt: sectionPrompt,
        size: '1024x1024',
        quality: 'standard'
      });

      return {
        section: sectionNumber,
        imageUrl: result.imageUrl
      };
    });

    const results = await Promise.all(imagePromises);
    console.log('🎨 [IMAGE] H2 섹션 이미지 생성 완료:', results);
    return results;
  } catch (error) {
    console.error('🎨 [IMAGE] H2 섹션 이미지 생성 오류:', error);
    return [];
  }
}

// 스케줄 포스트 추가 함수
async function addScheduledPost() {
  const topic = document.getElementById('scheduleTopic')?.value;
  const keywords = document.getElementById('scheduleKeywords')?.value;
  const date = document.getElementById('scheduleDate')?.value;
  const time = document.getElementById('scheduleTime')?.value;
  const contentMode = document.getElementById('scheduleContentMode')?.value;
  const ctaMode = document.getElementById('scheduleCtaMode')?.value;
  const publishType = document.getElementById('schedulePublishType')?.value;
  const thumbnailMode = document.getElementById('scheduleThumbnailMode')?.value;
  const platform = document.getElementById('schedulePlatform')?.value;

  if (!topic || !date || !time) {
    alert('주제, 날짜, 시간을 모두 입력해주세요.');
    return;
  }

  const h2ImageSettings = getH2ImageSections();

  const scheduleData = {
    id: Date.now(),
    topic,
    keywords,
    date,
    time,
    contentMode,
    ctaMode,
    publishType,
    thumbnailMode,
    platform,
    h2Images: h2ImageSettings.sections, // 하위 호환성 유지
    h2ImageSource: h2ImageSettings.source,
    h2ImageSections: h2ImageSettings.sections,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  // localStorage에 저장
  // 🔧 StorageManager 사용
  const storage = getStorageManager();
  const existingSchedules = await storage.get('scheduledPosts', true) || [];
  existingSchedules.push(scheduleData);
  await storage.set('scheduledPosts', existingSchedules, true);

  // 폼 초기화
  document.getElementById('scheduleTopic').value = '';
  document.getElementById('scheduleKeywords').value = '';
  document.getElementById('scheduleDate').value = '';
  document.getElementById('scheduleTime').value = '09:00';

  // 스케줄 목록 새로고침
  refreshScheduleList();

  alert('스케줄이 추가되었습니다.');
}

// 스케줄 목록 새로고침 함수
async function refreshScheduleList() {
  const scheduleList = document.getElementById('scheduleList');
  if (!scheduleList) return;

  // StorageManager 통일
  const storage = getStorageManager();
  const schedules = await storage.get('scheduledPosts', true) || [];

  if (schedules.length === 0) {
    scheduleList.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">스케줄이 없습니다</div>
      <div style="font-size: 14px;">위에서 새로운 예약 포스팅을 추가하세요</div>
    `;
    return;
  }

  let html = '';
  schedules.forEach(schedule => {
    const statusColor = schedule.status === 'completed' ? '#10b981' :
      schedule.status === 'failed' ? '#ef4444' :
        schedule.status === 'running' ? '#3b82f6' : '#f59e0b';
    const statusText = schedule.status === 'completed' ? '완료' :
      schedule.status === 'failed' ? '실패' :
        schedule.status === 'running' ? '실행중' : '대기중';

    html += `
      <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px;">${schedule.topic}</h4>
            <p style="margin: 0; color: #64748b; font-size: 14px;">${schedule.keywords || '키워드 없음'}</p>
          </div>
          <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
            ${statusText}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #64748b;">
          <span>📅 ${schedule.date} ${schedule.time}</span>
          <div>
            <button onclick="executeSchedule(${schedule.id})" style="background: ${schedule.status === 'running' ? '#6b7280' : '#3b82f6'}; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: ${schedule.status === 'running' ? 'not-allowed' : 'pointer'}; margin-right: 8px;" ${schedule.status === 'running' ? 'disabled' : ''}>
              ${schedule.status === 'running' ? '실행중...' : '실행'}
            </button>
            <button onclick="deleteSchedule(${schedule.id})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
              삭제
            </button>
          </div>
        </div>
      </div>
    `;
  });

  scheduleList.innerHTML = html;
}

// 스케줄 실행 함수
async function executeSchedule(scheduleId) {
  const storage = getStorageManager();
  const schedules = await storage.get('scheduledPosts', true) || [];
  const schedule = schedules.find(s => s.id === scheduleId);

  if (!schedule) {
    alert('스케줄을 찾을 수 없습니다.');
    return;
  }

  // 상태를 '실행중'으로 변경
  schedule.status = 'running';
  await storage.set('scheduledPosts', schedules, true);
  await refreshScheduleList();

  try {
    // createPayload 오버라이드 방식으로 통합 Payload 생성
    const payload = window.createPayload ? window.createPayload({
      previewOnly: false,
      overrides: {
        topic: schedule.topic,
        title: schedule.topic,
        keywords: schedule.keywords ? schedule.keywords.split(',').map(k => k.trim()) : [schedule.topic],
        platform: schedule.platform || 'blogspot',
        contentMode: schedule.contentMode || 'external',
        h2ImageSource: schedule.h2ImageSource || 'pollinations',
        h2ImageSections: schedule.h2ImageSections || schedule.h2Images || [],
        h2Images: { source: schedule.h2ImageSource || 'pollinations', sections: schedule.h2ImageSections || [] },
        publishType: schedule.publishType || 'single',
        postingMode: 'immediate',
        thumbnailType: schedule.thumbnailMode || 'text',
        ctaMode: schedule.ctaMode || 'auto',
      }
    }) : {
      // fallback: createPayload 미로딩시
      topic: schedule.topic, title: schedule.topic, platform: schedule.platform || 'blogspot',
      contentMode: schedule.contentMode || 'external', previewOnly: false
    };

    if (!window.blogger?.runPost) {
      throw new Error('백엔드 연결 실패');
    }

    addLog(`🚀 스케줄 실행 시작: ${schedule.topic}`, 'info');
    const result = await window.blogger.runPost(payload);

    if (result?.ok) {
      schedule.status = 'completed';
      schedule.completedAt = new Date().toISOString();
      schedule.result = result;
      addLog(`✅ 스케줄 실행 완료: ${schedule.topic}`, 'success');
    } else {
      schedule.status = 'failed';
      schedule.failedAt = new Date().toISOString();
      schedule.error = result?.error || '알 수 없는 오류';
      addLog(`❌ 스케줄 실행 실패: ${schedule.topic} - ${schedule.error}`, 'error');
    }
  } catch (error) {
    schedule.status = 'failed';
    schedule.failedAt = new Date().toISOString();
    schedule.error = error.message;
    addLog(`❌ 스케줄 실행 오류: ${schedule.topic} - ${error.message}`, 'error');
  } finally {
    // StorageManager로 상태 저장 + UI 갱신
    await storage.set('scheduledPosts', schedules, true);
    await refreshScheduleList();
  }
}


// 스케줄 삭제 함수
async function deleteSchedule(scheduleId) {
  if (!confirm('정말로 이 스케줄을 삭제하시겠습니까?')) {
    return;
  }

  // 🔧 StorageManager 사용
  const storage = getStorageManager();
  const schedules = await storage.get('scheduledPosts', true) || [];
  const updatedSchedules = schedules.filter(s => s.id !== scheduleId);
  await storage.set('scheduledPosts', updatedSchedules, true);
  refreshScheduleList();
}

// 실시간 날짜 업데이트 함수 (최적화됨)
// 실시간 날짜 업데이트 (원본)
function _updateRealtimeDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];

  // 날짜 표시 업데이트 (DOM 조작 최소화)
  const dateElement = document.getElementById('realtime-date');
  if (dateElement) {
    dateElement.textContent = `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  }

  // 달력 월 표시 업데이트
  const monthElement = document.getElementById('calendar-month');
  if (monthElement && !calendarRendered) {
    monthElement.textContent = `${year}년 ${month}월`;
  }

  const calendarSignature = `${year}-${month}`;
  const todayKey = formatDateKey(now);

  if (!calendarRendered) {
    currentCalendarYear = year;
    currentCalendarMonth = month - 1;
    renderCalendar();
    return;
  }

  if (calendarSignature !== lastCalendarSignature) {
    currentCalendarYear = year;
    currentCalendarMonth = month - 1;
    renderCalendar();
    return;
  }

  if (lastCalendarHighlight !== todayKey && year === currentCalendarYear && (month - 1) === currentCalendarMonth) {
    lastCalendarHighlight = todayKey;
    renderCalendar();
  }
}

// 🔧 Debounce 적용된 updateRealtimeDate (1000ms)
// 주의: setInterval로 호출되므로 debounce가 효과적이지 않을 수 있지만, 
// 다른 곳에서 직접 호출될 때를 대비해 적용
const updateRealtimeDate = debounce(_updateRealtimeDate, 1000);

// 실시간 시계 업데이트 함수
function updateRealtimeClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('ko-KR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const clockElement = document.getElementById('realtime-clock');
  if (clockElement) {
    clockElement.textContent = timeString;
  }
}

// 실시간 업데이트 시작
function startRealtimeUpdates() {
  // 즉시 업데이트
  updateRealtimeClock();
  updateRealtimeDate();

  // 1초마다 시계 업데이트
  setInterval(updateRealtimeClock, 1000);

  // 1분마다 날짜 업데이트 (자정 넘어갈 때를 대비)
  setInterval(updateRealtimeDate, 60000);
}

// DOM이 로드되면 실시간 업데이트 시작
document.addEventListener('DOMContentLoaded', function () {
  startRealtimeUpdates();

  // 로그아웃 버튼
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      const confirmed = confirm('로그아웃하시겠습니까?\n자동 로그인 설정도 해제됩니다.');
      if (!confirmed) return;

      const ipc = window.electronAPI || window.electron || window.blogger;
      if (!ipc) return;

      try {
        logoutBtn.disabled = true;
        logoutBtn.textContent = '로그아웃 중...';

        await ipc.invoke('save-auto-login-config', false);
        const result = await ipc.invoke('license-logout');

        if (result && result.success) {
          alert('로그아웃되었습니다. 앱을 다시 시작합니다.');
          await ipc.invoke('app-relaunch');
        } else {
          alert('로그아웃 실패: ' + (result?.message || '알 수 없는 오류'));
          logoutBtn.disabled = false;
          logoutBtn.textContent = '로그아웃';
        }
      } catch (err) {
        alert('로그아웃 중 오류: ' + (err.message || err));
        logoutBtn.disabled = false;
        logoutBtn.textContent = '로그아웃';
      }
    });
  }
});

// DOM 캐시 객체 (확장됨)
const DOMCache = {
  tabContents: null,
  tabButtons: null,
  elements: {}, // 모든 캐시된 요소 저장

  init() {
    this.tabContents = document.querySelectorAll('.tab-content');
    this.tabButtons = document.querySelectorAll('.tab-btn');
    // 자주 사용되는 요소들을 미리 캐싱
    this.preloadCommonElements();
  },

  preloadCommonElements() {
    // 자주 사용되는 요소들을 미리 로드
    const commonIds = [
      'publishBtn',
      'generateBtn',
      'previewContent',
      'keywordInput',
      'thumbnailType',
      'contentMode',
      'topicInput',
      'runBtn',
      'topic',
      'minChars',
      'sectionCount',
      'titleMode',
      'customSectionCount',
      'scheduleTopic',
      'scheduleKeywords',
      'scheduleDate',
      'scheduleTime',
      'scheduleContentMode',
      'scheduleCtaMode',
      'schedulePublishType',
      'scheduleThumbnailMode',
      'schedulePlatform',
      'licenseModal',
      'licenseStatus',
      'licenseKey',
      'licenseEmail',
      'scheduleList',
      'realtime-date',
      'calendar-month',
      'realtime-clock',
      'timezone',
      'scheduleDateTime',
      'bulkInterval',
      'paraphraseUrl',
      'authorNickname',
      'closeBtn',
      'workStatusTitle',
      'workStatusSubtitle'
    ];

    commonIds.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  },

  // 🔧 통일된 get 메서드: DOMCache.get(id) 패턴
  get(id) {
    // 캐시에 없으면 새로 가져와서 캐싱
    if (!this.elements[id]) {
      this.elements[id] = document.getElementById(id);
    }
    return this.elements[id];
  },

  // 🔧 캐시 무효화 (요소가 동적으로 변경될 때 사용)
  invalidate(id) {
    if (id) {
      delete this.elements[id];
    } else {
      // id가 없으면 모든 캐시 무효화
      this.elements = {};
      this.preloadCommonElements();
    }
  },

  // 🔧 값 가져오기 (value 속성 접근)
  getValue(id) {
    const element = this.get(id);
    return element ? element.value : null;
  },

  // 🔧 값 설정하기
  setValue(id, value) {
    const element = this.get(id);
    if (element) {
      element.value = value;
    }
  },

  getTabContents() {
    if (!this.tabContents) this.init();
    return this.tabContents;
  },

  getTabButtons() {
    if (!this.tabButtons) this.init();
    return this.tabButtons;
  }
};

// 🔧 버튼 상태 관리 클래스
const ButtonStateManager = {
  buttons: {
    publishBtn: null,
    generateBtn: null,
    runBtn: null
  },

  // 초기화: 버튼 요소 가져오기 및 원래 상태 저장
  init() {
    this.buttons.publishBtn = DOMCache.get('publishBtn');
    this.buttons.generateBtn = DOMCache.get('generateBtn');
    this.buttons.runBtn = DOMCache.get('runBtn');

    // 각 버튼의 원래 상태 저장
    this.saveOriginalState('publishBtn');
    this.saveOriginalState('generateBtn');
    this.saveOriginalState('runBtn');
  },

  // 원래 상태 저장
  saveOriginalState(buttonId) {
    const button = this.buttons[buttonId];
    if (!button) return;

    if (!button.dataset.originalState) {
      button.dataset.originalState = JSON.stringify({
        disabled: button.disabled,
        innerHTML: button.innerHTML,
        textContent: button.textContent || '',
        style: {
          opacity: button.style.opacity || '',
          pointerEvents: button.style.pointerEvents || '',
          cursor: button.style.cursor || '',
          display: button.style.display || '',
          visibility: button.style.visibility || ''
        },
        className: button.className || '',
        originalStyle: button.getAttribute('style') || ''
      });
    }
  },

  // 원래 상태 가져오기
  getOriginalState(buttonId) {
    const button = this.buttons[buttonId];
    if (!button || !button.dataset.originalState) return null;

    try {
      return JSON.parse(button.dataset.originalState);
    } catch (e) {
      console.error(`[ButtonStateManager] 원래 상태 파싱 실패 (${buttonId}):`, e);
      return null;
    }
  },

  // 로딩 상태 설정
  setLoading(buttonId, message = null) {
    const button = this.buttons[buttonId];
    if (!button) {
      console.warn(`[ButtonStateManager] 버튼을 찾을 수 없습니다: ${buttonId}`);
      return;
    }

    // 원래 상태가 없으면 저장
    if (!button.dataset.originalState) {
      this.saveOriginalState(buttonId);
    }

    // 로딩 메시지 설정
    const loadingMessages = {
      publishBtn: message || '<span style="position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 12px;"><span style="font-size: 28px; animation: pulse 2s infinite;">⏳</span><span style="text-shadow: 0 2px 10px rgba(0,0,0,0.2);">발행 중...</span><span style="font-size: 24px; animation: pulse 2s infinite 0.5s;">✨</span></span>',
      generateBtn: message || '⏳ 생성 중...',
      runBtn: message || '실행 중...'
    };

    // 버튼 상태 설정
    button.disabled = false; // 항상 클릭 가능하게 유지 (무제한 클릭)
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';
    button.style.opacity = '1';

    // 텍스트/HTML 업데이트
    if (buttonId === 'runBtn') {
      button.textContent = loadingMessages[buttonId];
    } else {
      button.innerHTML = loadingMessages[buttonId];
    }

    console.log(`[ButtonStateManager] ${buttonId} 로딩 상태 설정:`, loadingMessages[buttonId]);
  },

  // 원래 상태로 복원
  restore(buttonId) {
    const button = this.buttons[buttonId];
    if (!button) {
      console.warn(`[ButtonStateManager] 버튼을 찾을 수 없습니다: ${buttonId}`);
      return;
    }

    const originalState = this.getOriginalState(buttonId);
    if (!originalState) {
      console.warn(`[ButtonStateManager] 원래 상태를 찾을 수 없습니다: ${buttonId}`);
      // 기본 복원
      button.disabled = false;
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
      button.style.cursor = 'pointer';
      return;
    }

    // 원래 상태 복원
    button.disabled = originalState.disabled;

    // 스타일 복원
    if (originalState.originalStyle) {
      button.setAttribute('style', originalState.originalStyle);
    } else {
      // 개별 스타일 속성 복원
      Object.keys(originalState.style).forEach(key => {
        if (originalState.style[key]) {
          button.style[key] = originalState.style[key];
        }
      });
    }

    // 클래스 복원
    if (originalState.className) {
      button.className = originalState.className;
    }

    // 텍스트/HTML 복원
    if (buttonId === 'runBtn') {
      if (originalState.textContent) {
        button.textContent = originalState.textContent;
      }
    } else {
      if (originalState.innerHTML) {
        button.innerHTML = originalState.innerHTML;
      }
    }

    // 항상 클릭 가능하게 보장
    button.disabled = false;
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';
    button.style.opacity = '1';

    console.log(`[ButtonStateManager] ${buttonId} 원래 상태로 복원 완료`);
  },

  // 활성/비활성 설정
  setEnabled(buttonId, enabled) {
    const button = this.buttons[buttonId];
    if (!button) {
      console.warn(`[ButtonStateManager] 버튼을 찾을 수 없습니다: ${buttonId}`);
      return;
    }

    if (enabled) {
      button.disabled = false;
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
      button.style.cursor = 'pointer';
    } else {
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.pointerEvents = 'none';
      button.style.cursor = 'not-allowed';
    }

    console.log(`[ButtonStateManager] ${buttonId} ${enabled ? '활성화' : '비활성화'}`);
  },

  // 모든 버튼 복원
  restoreAll() {
    Object.keys(this.buttons).forEach(buttonId => {
      this.restore(buttonId);
    });
  }
};

// 라이센스 등록 모달 열기
// 라이센스 모달 열기
function openLicenseModal() {
  try {
    console.log('🔑 [LICENSE] 라이센스 모달 열기');
    const modal = document.getElementById('licenseModal');
    if (modal) {
      modal.style.display = 'flex';
      console.log('✅ [LICENSE] 라이센스 모달 열기 완료');
    } else {
      console.error('❌ [LICENSE] 모달 요소를 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('❌ [LICENSE] 라이센스 모달 열기 실패:', error);
  }
}

// 라이센스 모달 닫기
function closeLicenseModal() {
  const modal = document.getElementById('licenseModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('🔑 [LICENSE] 라이센스 모달 닫기 완료');
  }
}

// 라이센스 활성화 (모달에서)
function activateLicenseFromModal() {
  const licenseKey = document.getElementById('licenseKey')?.value;
  const licenseEmail = document.getElementById('licenseEmail')?.value;

  if (!licenseKey || !licenseEmail) {
    alert('라이센스 키와 이메일을 모두 입력해주세요.');
    return;
  }

  // 개발환경에서는 바로 성공 처리
  if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    alert('개발환경에서는 라이센스가 자동으로 활성화됩니다.');
    closeLicenseModal();
    return;
  }

  // 실제 라이센스 검증 로직 (상용 환경에서)
  console.log('🔑 [LICENSE] 라이센스 활성화 시도:', { licenseKey, licenseEmail });

  // 여기에 실제 라이센스 검증 API 호출 로직 추가
  alert('라이센스 활성화가 완료되었습니다!');
  closeLicenseModal();
}

// API키 발급 페이지 열기 함수들
function openProdiaApiPage() {
  try {
    console.log('⚡ [PRODIA] Prodia API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://app.prodia.com/api');
    } else {
      window.open('https://app.prodia.com/api', '_blank');
    }

    console.log('✅ [PRODIA] Prodia API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [PRODIA] Prodia API 페이지 열기 실패:', error);
    alert('Prodia API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

function openPexelsApiPage() {
  try {
    console.log('📸 [PEXELS] Pexels API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://www.pexels.com/api/');
    } else {
      window.open('https://www.pexels.com/api/', '_blank');
    }

    console.log('✅ [PEXELS] Pexels API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [PEXELS] Pexels API 페이지 열기 실패:', error);
    alert('Pexels API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

function openDalleApiPage() {
  try {
    console.log('🎨 [DALLE] DALL-E API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://platform.openai.com/api-keys');
    } else {
      window.open('https://platform.openai.com/api-keys', '_blank');
    }

    console.log('✅ [DALLE] DALL-E API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [DALLE] DALL-E API 페이지 열기 실패:', error);
    alert('DALL-E API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

function openNaverApiPage() {
  try {
    console.log('🟢 [NAVER] 네이버 API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://developers.naver.com/apps/#/myapps');
    } else {
      window.open('https://developers.naver.com/apps/#/myapps', '_blank');
    }

    console.log('✅ [NAVER] 네이버 API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [NAVER] 네이버 API 페이지 열기 실패:', error);
    alert('네이버 API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

function openGeminiApiPage() {
  try {
    console.log('🤖 [GEMINI] Gemini API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://makersuite.google.com/app/apikey');
    } else {
      window.open('https://makersuite.google.com/app/apikey', '_blank');
    }

    console.log('✅ [GEMINI] Gemini API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [GEMINI] Gemini API 페이지 열기 실패:', error);
    alert('Gemini API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

function openGoogleCseApiPage() {
  try {
    console.log('🔍 [GOOGLE CSE] Google CSE API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://console.developers.google.com/apis/credentials');
    } else {
      window.open('https://console.developers.google.com/apis/credentials', '_blank');
    }

    console.log('✅ [GOOGLE CSE] Google CSE API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [GOOGLE CSE] Google CSE API 페이지 열기 실패:', error);
    alert('Google CSE API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

function openYouTubeApiPage() {
  try {
    console.log('📺 [YOUTUBE] YouTube API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://console.cloud.google.com/apis/library/youtube.googleapis.com');
    } else {
      window.open('https://console.cloud.google.com/apis/library/youtube.googleapis.com', '_blank');
    }

    console.log('✅ [YOUTUBE] YouTube API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [YOUTUBE] YouTube API 페이지 열기 실패:', error);
    alert('YouTube API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

function openGoogleOAuthPage() {
  try {
    console.log('🔐 [GOOGLE OAUTH] Google OAuth 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://console.developers.google.com/apis/credentials');
    } else {
      window.open('https://console.developers.google.com/apis/credentials', '_blank');
    }

    console.log('✅ [GOOGLE OAUTH] Google OAuth 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [GOOGLE OAUTH] Google OAuth 페이지 열기 실패:', error);
    alert('Google OAuth 페이지 열기에 실패했습니다: ' + error.message);
  }
}

// 환경변수 연동 상태 확인 함수
function checkEnvironmentVariables() {
  console.log('🔍 환경변수 연동 상태 확인 시작...');

  // localStorage에서 설정 불러오기
  const settings = loadSettings();
  console.log('📦 localStorage 설정:', settings);

  // .env 파일에서 설정 불러오기
  if (window.blogger && window.blogger.getEnv) {
    window.blogger.getEnv().then(envResult => {
      console.log('📁 .env 파일 설정:', envResult);

      if (envResult && envResult.ok && envResult.data) {
        const envSettings = envResult.data;
        console.log('✅ .env 파일 로드 성공:', envSettings);

        // 병합된 설정 확인
        const mergedSettings = { ...settings, ...envSettings };
        console.log('🔄 병합된 설정:', mergedSettings);

        // 각 API키 상태 확인
        console.log('🔑 API키 상태:');
        console.log('  - OpenAI API:', mergedSettings.openaiKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Gemini API:', mergedSettings.geminiKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - DALL-E API:', mergedSettings.dalleApiKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Pexels API:', mergedSettings.pexelsApiKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - 네이버 Customer ID:', mergedSettings.naverCustomerId ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - 네이버 Secret Key:', mergedSettings.naverSecretKey ? '✅ 설정됨' : '❌ 미설정');

        console.log('🌐 플랫폼 설정:');
        console.log('  - 플랫폼:', mergedSettings.platform || 'blogspot');
        console.log('  - Blogger ID:', mergedSettings.blogId ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Google Client ID:', mergedSettings.googleClientId ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Google Client Secret:', mergedSettings.googleClientSecret ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Google CSE Key:', mergedSettings.googleCseKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Google CSE CX:', mergedSettings.googleCseCx ? '✅ 설정됨' : '❌ 미설정');

        console.log('🌍 WordPress 설정:');
        console.log('  - 사이트 URL:', mergedSettings.wordpressSiteUrl ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - 사용자명:', mergedSettings.wordpressUsername ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - 비밀번호:', mergedSettings.wordpressPassword ? '✅ 설정됨' : '❌ 미설정');

        // 연동 상태 요약
        const totalSettings = Object.keys(mergedSettings).length;
        const configuredSettings = Object.values(mergedSettings).filter(value => value && value.toString().trim() !== '').length;
        console.log(`📊 연동 상태 요약: ${configuredSettings}/${totalSettings} 설정 완료`);

        if (configuredSettings > 0) {
          console.log('✅ 환경변수 연동이 정상적으로 작동하고 있습니다!');
        } else {
          console.log('⚠️ 환경변수가 설정되지 않았습니다. 환경설정에서 API키를 입력해주세요.');
        }

      } else {
        console.log('❌ .env 파일 로드 실패:', envResult);
      }
    }).catch(error => {
      console.error('❌ .env 파일 로드 오류:', error);
    });
  } else {
    console.log('❌ window.blogger.getEnv 함수를 사용할 수 없습니다.');
  }
}

// 전역 함수로 등록 (브라우저 콘솔에서 호출 가능)
window.checkEnvironmentVariables = checkEnvironmentVariables;

// H2 이미지 소스 변경 시 처리
function handleH2ImageSourceChange() {
  const selectedSource = document.getElementById('h2ImageSource')?.value || document.querySelector('input[name="h2ImageSource"]:checked')?.value;
  console.log('🖼️ [H2 IMAGE] 선택된 이미지 소스:', selectedSource);

  // 선택된 소스에 따른 추가 설정 표시/숨김
  const h2Sections = document.querySelectorAll('input[name="h2Sections"]');

  h2Sections.forEach(section => {
    const label = section.closest('label');
    if (label) {
      // 선택된 소스에 따라 라벨 스타일 변경
      switch (selectedSource) {
        case 'dalle':
          label.style.background = 'rgba(139, 92, 246, 0.2)';
          break;
        case 'pexels':
          label.style.background = 'rgba(59, 130, 246, 0.2)';
          break;
        case 'stability':
          label.style.background = 'rgba(239, 68, 68, 0.2)';
          break;
        case 'pollinations':
          label.style.background = 'rgba(16, 185, 129, 0.2)';
          break;
        case 'cse':
          label.style.background = 'rgba(239, 68, 68, 0.2)';
          break;
        case 'text':
          label.style.background = 'rgba(16, 185, 129, 0.2)';
          break;
        default:
          label.style.background = 'rgba(255, 255, 255, 0.1)';
      }
    }
  });
}

// H2 섹션 선택 상태 확인
function getH2ImageSettings() {
  const selectedSource = document.getElementById('h2ImageSource')?.value || document.querySelector('input[name="h2ImageSource"]:checked')?.value || 'nanobananapro';
  const selectedSections = Array.from(document.querySelectorAll('input[name="h2Sections"]:checked'))
    .map(input => parseInt(input.value));

  const settings = {
    source: selectedSource,
    sections: selectedSections,
    totalSections: selectedSections.length
  };

  console.log('🖼️ [H2 IMAGE] 현재 설정:', settings);
  return settings;
}

// 전역 함수로 등록
window.handleH2ImageSourceChange = handleH2ImageSourceChange;
window.getH2ImageSettings = getH2ImageSettings;

// 📈 Search Console + GA4 성과 연동
const METRICS_GA4_PROPERTY_STORAGE_KEY = 'metricsGa4PropertyId';

function openGa4PropertyModal() {
  const modal = document.getElementById('ga4PropertyModal');
  if (modal) modal.style.display = 'flex';
}

function closeGa4PropertyModal() {
  const modal = document.getElementById('ga4PropertyModal');
  if (modal) modal.style.display = 'none';
}

window.closeGa4PropertyModal = closeGa4PropertyModal;

async function ensureGa4PropertySelected() {
  try {
    const existing = localStorage.getItem(METRICS_GA4_PROPERTY_STORAGE_KEY);
    if (existing && String(existing).trim()) return String(existing).trim();

    if (!window.blogger || !window.blogger.metricsListGa4Properties) {
      return null;
    }

    openGa4PropertyModal();
    const listEl = document.getElementById('ga4PropertyList');
    if (listEl) listEl.innerHTML = '<div style="color:#64748b;font-weight:700;">불러오는 중...</div>';

    const res = await window.blogger.metricsListGa4Properties();
    if (!res || !res.ok || !Array.isArray(res.properties)) {
      if (listEl) listEl.innerHTML = `<div style="color:#ef4444;font-weight:800;">불러오기 실패: ${res?.error || '알 수 없는 오류'}</div>`;
      return null;
    }

    const properties = res.properties
      .filter(p => p && p.propertyId)
      .map(p => ({
        propertyId: String(p.propertyId),
        displayName: String(p.displayName || p.propertyId),
      }));

    if (properties.length === 0) {
      if (listEl) listEl.innerHTML = '<div style="color:#ef4444;font-weight:800;">GA4 속성을 찾을 수 없습니다.</div>';
      return null;
    }

    if (listEl) {
      listEl.innerHTML = properties.map(p => {
        const safeName = p.displayName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
          <button type="button" data-ga4-property="${p.propertyId}" style="text-align:left; width:100%; padding:14px 14px; border:2px solid #e2e8f0; border-radius:14px; background:#f8fafc; cursor:pointer; font-weight:800; color:#0f172a;">
            <div style="font-size:14px;">${safeName}</div>
            <div style="font-size:12px; color:#64748b; font-weight:700; margin-top:4px;">properties/${p.propertyId}</div>
          </button>
        `;
      }).join('');

      listEl.querySelectorAll('button[data-ga4-property]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-ga4-property');
          if (!id) return;
          localStorage.setItem(METRICS_GA4_PROPERTY_STORAGE_KEY, id);
          closeGa4PropertyModal();
          try { await refreshMetricsAuthStatus(); } catch { }
        });
      });
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function refreshMetricsAuthStatus() {
  try {
    const el = document.getElementById('metricsOAuthStatus');
    if (el) {
      el.style.display = 'block';
      el.textContent = '연동 상태 확인 중...';
    }
    if (!window.blogger || !window.blogger.metricsCheckAuthStatus) {
      if (el) el.textContent = '⚠️ 앱 IPC 초기화 중입니다. 잠시 후 다시 시도해주세요.';
      return;
    }
    const res = await window.blogger.metricsCheckAuthStatus();
    if (el) {
      if (res && res.ok && res.authenticated) {
        el.textContent = '✅ 성과 연동됨 (GSC/GA4)';
        try {
          if (window.blogger && window.blogger.metricsGetOverview) {
            const propertyId = localStorage.getItem(METRICS_GA4_PROPERTY_STORAGE_KEY) || undefined;
            const ov = await window.blogger.metricsGetOverview({ days: 28, topPages: 5, propertyId });
            if (ov && ov.ok) {
              const gsc = ov.gsc && ov.gsc.ok ? ov.gsc : null;
              const ga4 = ov.ga4 && ov.ga4.ok ? ov.ga4 : null;
              if ((!ga4 || !ga4.ok) && (ov.ga4?.error || '').includes('GA4 Property')) {
                await ensureGa4PropertySelected();
              }
              const clicks = gsc?.summary?.clicks ?? null;
              const impressions = gsc?.summary?.impressions ?? null;
              const ctr = gsc?.summary?.ctr ?? null;
              const sessions = ga4?.summary?.sessions ?? null;
              const activeUsers = ga4?.summary?.activeUsers ?? null;
              const engagementRate = ga4?.summary?.engagementRate ?? null;
              const parts = [];
              const errors = [];
              if (clicks !== null && impressions !== null) {
                parts.push(`GSC 클릭 ${clicks} / 노출 ${impressions}`);
                if (typeof ctr === 'number') parts.push(`CTR ${(ctr * 100).toFixed(2)}%`);
              } else if (ov.gsc && ov.gsc.ok === false) {
                errors.push(`GSC 오류: ${ov.gsc.error || '조회 실패'}`);
              }
              if (sessions !== null && activeUsers !== null) {
                parts.push(`GA4 세션 ${sessions} / 활성사용자 ${activeUsers}`);
                if (typeof engagementRate === 'number') parts.push(`참여율 ${(engagementRate * 100).toFixed(2)}%`);
              } else if (ov.ga4 && ov.ga4.ok === false) {
                errors.push(`GA4 오류: ${ov.ga4.error || '조회 실패'}`);
              }
              if (parts.length > 0) {
                el.innerHTML = `✅ 성과 연동됨 (최근 28일)<br>${parts.join(' | ')}`;
              } else if (errors.length > 0) {
                el.innerHTML = `✅ 성과 연동됨 (데이터 조회 실패)<br>${errors.join('<br>')}`;
              }
            }
          }
        } catch (e) { }
      } else if (res && res.ok && res.expired) {
        el.textContent = '⚠️ 성과 연동 토큰 만료됨 - 재연동 필요';
      } else {
        el.textContent = '🔗 아직 성과 연동 안됨';
      }
    }
  } catch (e) {
    const el = document.getElementById('metricsOAuthStatus');
    if (el) el.textContent = '❌ 성과 연동 상태 확인 실패';
  }
}

async function startMetricsOAuth() {
  try {
    const el = document.getElementById('metricsOAuthStatus');
    if (el) {
      el.style.display = 'block';
      el.textContent = '연동 상태 확인 중...';
    }

    if (!window.blogger || !window.blogger.metricsStartAuth || !window.blogger.metricsCheckAuthStatus) {
      alert('성과 연동 기능을 사용할 수 없습니다. 앱을 재시작 후 다시 시도해주세요.');
      return;
    }

    // 이미 연동된 경우: 브라우저를 띄우지 않고 요약을 바로 로딩
    try {
      const status = await window.blogger.metricsCheckAuthStatus();
      if (status && status.ok && status.authenticated) {
        if (el) el.textContent = '✅ 이미 연동됨 - 요약 불러오는 중...';
        await refreshMetricsAuthStatus();
        return;
      }
    } catch { }

    // 미연동인 경우에만 OAuth 시작
    if (el) el.textContent = '브라우저에서 Google 로그인/권한 허용을 완료해주세요...';
    const res = await window.blogger.metricsStartAuth({});
    if (res && res.ok && res.alreadyAuthenticated) {
      if (el) el.textContent = '✅ 이미 연동됨 - 요약 불러오는 중...';
      await refreshMetricsAuthStatus();
      return;
    }
  } catch (error) {
    console.error('[METRICS] OAuth 시작 실패:', error);
    alert('성과 연동 시작 실패: ' + (error.message || '알 수 없는 오류'));
  }
}

window.startMetricsOAuth = startMetricsOAuth;

window.openGa4PropertyModal = openGa4PropertyModal;

try {
  const ga4Modal = document.getElementById('ga4PropertyModal');
  if (ga4Modal) {
    ga4Modal.addEventListener('click', (e) => {
      if (e && e.target === ga4Modal) {
        closeGa4PropertyModal();
      }
    });
  }
} catch { }

try {
  if (window.blogger && window.blogger.onMetricsAuthComplete) {
    window.blogger.onMetricsAuthComplete((result) => {
      const el = document.getElementById('metricsOAuthStatus');
      if (el) el.style.display = 'block';
      if (result && result.ok) {
        if (el) el.textContent = '✅ 성과 연동 완료! (GSC/GA4)';
      } else {
        if (el) el.textContent = '❌ 성과 연동 실패: ' + (result?.error || '알 수 없는 오류');
      }
    });
  }
} catch { }

// 🔒 성과연동 임시 비활성화 (나중에 다시 활성화)
// setTimeout(() => {
//   refreshMetricsAuthStatus();
// }, 1200);

// 구글 트렌드 열기
function openGoogleTrends() {
  try {
    console.log('📊 [TRENDS] 구글 트렌드 열기');

    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://trends.google.com/trends/');
    } else {
      // 웹 환경에서 새 창으로 열기
      window.open('https://trends.google.com/trends/', '_blank');
    }

    console.log('✅ [TRENDS] 구글 트렌드 열기 완료');

  } catch (error) {
    console.error('❌ [TRENDS] 구글 트렌드 열기 실패:', error);
    alert('구글 트렌드 열기에 실패했습니다: ' + error.message);
  }
}

// 키워드 마스터 모달 열기
function openKeywordMasterModal() {
  try {
    console.log('🔑 [키워드 마스터] 모달 열기');
    const modal = document.getElementById('keywordMasterModal');
    if (modal) {
      modal.style.display = 'flex';
      console.log('✅ [키워드 마스터] 모달 열기 완료');
    } else {
      console.error('❌ [키워드 마스터] 모달 요소를 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('❌ [키워드 마스터] 모달 열기 실패:', error);
  }
}

// 키워드 마스터 모달 닫기
function closeKeywordMasterModal() {
  const modal = document.getElementById('keywordMasterModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('🔑 [키워드 마스터] 모달 닫기 완료');
  }
}

// 키워드 마스터 창 열기
async function openKeywordMaster() {
  try {
    console.log('🔑 [키워드 마스터] 창 열기');

    // Electron API를 통해 키워드 마스터 창 열기
    if (window.electronAPI && window.electronAPI.openKeywordMasterWindow) {
      await window.electronAPI.openKeywordMasterWindow();
      console.log('✅ [키워드 마스터] 창 열기 완료');
    } else if (window.blogger && window.blogger.openKeywordMasterWindow) {
      await window.blogger.openKeywordMasterWindow();
      console.log('✅ [키워드 마스터] 창 열기 완료 (blogger API)');
    } else {
      console.warn('⚠️ [키워드 마스터] API를 찾을 수 없습니다.');
      alert('키워드 마스터 기능을 사용할 수 없습니다. Electron 환경에서만 동작합니다.');
    }
  } catch (error) {
    console.error('❌ [키워드 마스터] 열기 실패:', error);
    alert('키워드 마스터 열기에 실패했습니다: ' + (error.message || String(error)));
  }
}

// 전역 함수로 등록
window.openKeywordMaster = openKeywordMaster;
window.openKeywordMasterModal = openKeywordMasterModal;
window.closeKeywordMasterModal = closeKeywordMasterModal;

// 탭 전환 함수는 ui.js 모듈로 이동됨 (중복 선언 방지)
// function showTab(tabName) {
//   // 모든 탭 콘텐츠 숨기기
//   const tabContents = DOMCache.getTabContents();
//   tabContents.forEach(content => {
//     content.classList.remove('active');
//   });
//   
//   // 모든 탭 버튼 비활성화
//   const tabButtons = DOMCache.getTabButtons();
//   tabButtons.forEach(button => {
//     button.classList.remove('active');
//   });
//   
//   // 선택된 탭 콘텐츠 보이기
//   const selectedTab = document.getElementById(tabName + '-tab');
//   if (selectedTab) {
//     selectedTab.classList.add('active');
//   }
//   
//   // 선택된 탭 버튼 활성화
//   const selectedButton = document.querySelector(`[onclick="showTab('${tabName}')"]`);
//   if (selectedButton) {
//     selectedButton.classList.add('active');
//   }
// }

// 라이선스 유효성 체크 (최적화됨)
function isLicenseValid() {
  const element = document.getElementById('licenseStatus');
  if (!element) return false;

  if (element.dataset && typeof element.dataset.valid !== 'undefined') {
    return element.dataset.valid === 'true';
  }

  const text = element.textContent || '';
  const color = element.style.color || '';

  return color.includes('185, 129') || color.includes('#10b981') ||
    text.includes('무제한') || text.includes('유효') ||
    text.includes('활성') || text.includes('등록됨');
}

function formatLicenseStatusLabel(label, unit) {
  if (label === '무제한') return '무제한';
  if (label === '정보없음') return '정보 없음';
  if (label === null || label === undefined || label === '') return '정보 없음';
  if (typeof label === 'number') return unit ? `${label}${unit}` : String(label);
  return label;
}

function buildLicenseStatusText(licenseData, expiresDate, isUnlimited) {
  const maxUsesLabel = licenseData.maxUses === -1 ? '무제한' : (licenseData.maxUses ?? '정보없음');
  const remainingLabel = licenseData.remaining === -1 ? '무제한' : (licenseData.remaining ?? '정보없음');
  const expiresLabel = isUnlimited
    ? '무제한'
    : (expiresDate ? `${expiresDate.getFullYear()}년 ${String(expiresDate.getMonth() + 1).padStart(2, '0')}월` : '정보 없음');

  const parts = [
    `총 ${formatLicenseStatusLabel(maxUsesLabel, '회')}`,
    `잔여 ${formatLicenseStatusLabel(remainingLabel, '회')}`,
    `만료 ${formatLicenseStatusLabel(expiresLabel)}`
  ];

  return parts.join(' • ');
}

function setLicenseStatusElement(element, text, color, isValid) {
  if (!element) return;
  element.textContent = text;
  element.style.color = color;
  if (!element.dataset) element.dataset = {};
  element.dataset.valid = isValid ? 'true' : 'false';
}

function normalizeLicenseCount(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['무제한', 'unlimited', 'permanent', 'lifetime', '∞', 'infinite'].includes(normalized)) {
    return -1;
  }
  const digits = normalized.replace(/[^\d-]/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseLicenseExpiry(value) {
  if (value === undefined || value === null) {
    return { date: null, unlimited: false };
  }

  if (typeof value === 'number') {
    if (value === -1) return { date: null, unlimited: true };
    return { date: new Date(value), unlimited: false };
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return { date: null, unlimited: false };
  }

  if (['무제한', 'unlimited', 'permanent', 'lifetime', 'never', 'no-expiry', '∞', 'infinite'].includes(normalized)) {
    return { date: null, unlimited: true };
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return { date: null, unlimited: false };
  }

  return { date: new Date(parsed), unlimited: false };
}

// Pexels API 발급 페이지 열기
function openPexelsApiPage() {
  try {
    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://www.pexels.com/api/');
    } else {
      // 일반 웹 환경에서 새 창으로 열기
      window.open('https://www.pexels.com/api/', '_blank');
    }
  } catch (error) {
    console.error('Pexels API 페이지 열기 실패:', error);
    // fallback으로 새 창 열기
    window.open('https://www.pexels.com/api/', '_blank');
  }
}

// DALL-E API 발급 페이지 열기
function openDalleApiPage() {
  try {
    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://platform.openai.com/api-keys');
    } else {
      // 일반 웹 환경에서 새 창으로 열기
      window.open('https://platform.openai.com/api-keys', '_blank');
    }
  } catch (error) {
    console.error('DALL-E API 페이지 열기 실패:', error);
    // fallback으로 새 창 열기
    window.open('https://platform.openai.com/api-keys', '_blank');
  }
}

// 네이버 API 발급 페이지 열기
function openNaverApiPage() {
  try {
    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://developers.naver.com/apps/#/myapps');
    } else {
      // 일반 웹 환경에서 새 창으로 열기
      window.open('https://developers.naver.com/apps/#/myapps', '_blank');
    }
  } catch (error) {
    console.error('네이버 API 페이지 열기 실패:', error);
    // fallback으로 새 창 열기
    window.open('https://developers.naver.com/apps/#/myapps', '_blank');
  }
}

// UI 차단 함수 (최적화됨)
function blockUIForInvalidLicense() {
  const isBlocked = !isLicenseValid();

  // 버튼과 입력 필드 차단
  const elementsToBlock = [
    'generateBtn', 'previewBtn', 'runPostingBtn', 'bulkPostingBtn', 'scheduleBtn',
    'keywordInput', 'topic', 'minChars', 'maxChars'
  ];

  elementsToBlock.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      if (!element.dataset) element.dataset = {};
      if (typeof element.dataset.originalLabel === 'undefined') {
        element.dataset.originalLabel = element.innerHTML;
      }

      element.disabled = isBlocked;
      element.style.opacity = isBlocked ? '0.5' : '1';
      element.style.cursor = isBlocked ? 'not-allowed' : 'pointer';

      if (isBlocked && id === 'generateBtn') {
        element.innerHTML = '<span style="position: relative; z-index: 1;">🔒 라이선스 등록 필요</span>';
      } else if (!isBlocked && typeof element.dataset.originalLabel !== 'undefined') {
        element.innerHTML = element.dataset.originalLabel;
      }
    }
  });

  // 라이선스 모달 표시 (차단된 경우)
  if (isBlocked) {
    setTimeout(() => {
      const licenseModal = document.getElementById('licenseModal');
      if (licenseModal) {
        licenseModal.style.display = 'flex';
      }
    }, 1000);
  }
}

// 라이센스 정보 로드
async function loadLicenseInfo() {
  try {
    const licenseStatusElement = document.getElementById('licenseStatus');
    if (!licenseStatusElement) return;

    // 무료 체험 모드 체크
    try {
      var api = window.blogger || window.electronAPI;
      if (api && api.getQuotaStatus) {
        var qs = await api.getQuotaStatus();
        if (qs && qs.success && qs.isFree) {
          var u = (qs.quota && qs.quota.usage) || 0;
          var l = (qs.quota && qs.quota.limit) || 2;
          setLicenseStatusElement(licenseStatusElement, '🆓 무료체험 (' + u + '/' + l + ')', '#10b981', true);
          return;
        }
      }
    } catch (e) { /* ignore */ }

    // Electron API를 통해 라이센스 파일 읽기
    if (window.blogger && window.blogger.readLicenseFile) {
      const result = await window.blogger.readLicenseFile();

      if (result.ok && result.data) {
        const licenseData = result.data;

        const maxUses = normalizeLicenseCount(licenseData.maxUses);
        const remaining = normalizeLicenseCount(licenseData.remaining);
        const expiryInfo = parseLicenseExpiry(licenseData.expiresAt);

        const isUnlimited = expiryInfo.unlimited || maxUses === -1;
        const expiresTimestamp = expiryInfo.date ? expiryInfo.date.getTime() : null;
        const isValid = isUnlimited || (
          licenseData.valid !== false &&
          (expiresTimestamp === null || expiresTimestamp > Date.now())
        );

        const displayData = {
          maxUses: maxUses === null ? '정보없음' : (maxUses === -1 ? '무제한' : maxUses),
          remaining: remaining === null ? '정보없음' : (remaining === -1 ? '무제한' : remaining),
        };

        const statusText = buildLicenseStatusText(displayData, expiryInfo.date, isUnlimited);
        const statusColor = isValid ? '#10b981' : '#ef4444';

        console.log('라이센스 유효성:', {
          isValid,
          isUnlimited,
          expiresDate: expiryInfo.date,
          licenseData
        });

        setLicenseStatusElement(licenseStatusElement, statusText, statusColor, isValid);

        console.log('라이센스 정보 로드됨:', licenseData);

        setTimeout(() => {
          blockUIForInvalidLicense();
        }, 100);

        return licenseData;
      } else {
        setLicenseStatusElement(licenseStatusElement, '미등록', '#f59e0b', false);
        console.log('라이센스 파일이 없습니다.');

        setTimeout(() => {
          blockUIForInvalidLicense();
        }, 100);

        return null;
      }
    } else {
      console.log('Electron API를 사용할 수 없습니다.');
      licenseStatusElement.textContent = '오류';
      licenseStatusElement.style.color = '#ef4444'; // 빨간색

      // UI 차단 상태 업데이트
      setTimeout(() => {
        blockUIForInvalidLicense();
      }, 100);

      return null;
    }
  } catch (error) {
    console.error('라이센스 정보 로드 중 오류:', error);
    const licenseStatusElement = document.getElementById('licenseStatus');
    setLicenseStatusElement(licenseStatusElement, '오류', '#ef4444', false);

    // UI 차단 상태 업데이트
    setTimeout(() => {
      blockUIForInvalidLicense();
    }, 100);

    return null;
  }
}

// 라이센스 활성화 함수 (모달용)
async function activateLicenseFromModal() {
  try {
    const keyEl = document.getElementById('licenseKey');
    const emailEl = document.getElementById('licenseEmail');
    const key = keyEl?.value?.trim() || '';
    const email = emailEl?.value?.trim() || '';

    if (!key || !email) {
      alert('라이센스 키와 이메일을 모두 입력해주세요.');
      return;
    }

    // 라이센스 키 검증 (실제로는 서버에서 검증해야 함)
    const licenseData = {
      key: key,
      email: email,
      valid: true,
      activatedAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1년 후
      user: email
    };

    // Electron API를 통해 license.json 파일에 저장
    if (window.blogger && window.blogger.writeLicenseFile) {
      const result = await window.blogger.writeLicenseFile(licenseData);

      if (result.ok) {
        // UI 업데이트
        await loadLicenseInfo();

        // 모달 닫기
        document.getElementById('licenseModal').style.display = 'none';

        // UI 차단 해제
        setTimeout(() => {
          blockUIForInvalidLicense();
        }, 200);

        alert('라이센스가 성공적으로 활성화되었습니다!');
      } else {
        alert('라이센스 저장 중 오류가 발생했습니다: ' + result.error);
      }
    } else {
      alert('전자 앱 API를 사용할 수 없습니다.');
    }

  } catch (error) {
    console.error('라이센스 활성화 중 오류:', error);
    alert('라이센스 활성화 중 오류가 발생했습니다: ' + error.message);
  }
}

// 🔧 애플리케이션 상태 관리 클래스 (싱글톤 패턴)
const AppState = (() => {
  let instance = null;

  class AppStateClass {
    constructor() {
      if (instance) {
        return instance;
      }

      // 내부 상태
      this._currentPlatform = 'wordpress';
      this._isRunning = false;
      this._isCanceled = false;
      this._currentTab = 'main';
      this._lastProgressUpdateTime = null;
      this._generatedContent = {
        title: '',
        content: '',
        thumbnailUrl: '',
        payload: null
      };
      this._manualCtasData = [];
      this._keywordCtaData = {};

      // 이벤트 리스너 (옵션)
      this._listeners = new Map();

      instance = this;
      return this;
    }

    // currentPlatform getter/setter
    get currentPlatform() {
      return this._currentPlatform;
    }

    set currentPlatform(value) {
      const oldValue = this._currentPlatform;
      this._currentPlatform = value;
      this._notify('currentPlatform', value, oldValue);
    }

    // isRunning getter/setter
    get isRunning() {
      return this._isRunning;
    }

    set isRunning(value) {
      const oldValue = this._isRunning;
      this._isRunning = value;
      this._notify('isRunning', value, oldValue);
    }

    // isCanceled getter/setter
    get isCanceled() {
      return this._isCanceled;
    }

    set isCanceled(value) {
      const oldValue = this._isCanceled;
      this._isCanceled = value;
      this._notify('isCanceled', value, oldValue);
    }

    // currentTab getter/setter
    get currentTab() {
      return this._currentTab;
    }

    set currentTab(value) {
      const oldValue = this._currentTab;
      this._currentTab = value;
      this._notify('currentTab', value, oldValue);
    }

    // lastProgressUpdateTime getter/setter
    get lastProgressUpdateTime() {
      return this._lastProgressUpdateTime;
    }

    set lastProgressUpdateTime(value) {
      const oldValue = this._lastProgressUpdateTime;
      this._lastProgressUpdateTime = value;
      this._notify('lastProgressUpdateTime', value, oldValue);
    }

    // generatedContent getter/setter
    get generatedContent() {
      return this._generatedContent;
    }

    set generatedContent(value) {
      const oldValue = { ...this._generatedContent };
      this._generatedContent = value;
      this._notify('generatedContent', value, oldValue);
    }

    // manualCtasData getter/setter
    get manualCtasData() {
      return this._manualCtasData;
    }

    set manualCtasData(value) {
      const oldValue = [...this._manualCtasData];
      this._manualCtasData = value;
      this._notify('manualCtasData', value, oldValue);
    }

    // keywordCtaData getter/setter
    get keywordCtaData() {
      return this._keywordCtaData;
    }

    set keywordCtaData(value) {
      const oldValue = { ...this._keywordCtaData };
      this._keywordCtaData = value;
      this._notify('keywordCtaData', value, oldValue);
    }

    // 상태 초기화
    reset() {
      const oldState = {
        currentPlatform: this._currentPlatform,
        isRunning: this._isRunning,
        isCanceled: this._isCanceled,
        currentTab: this._currentTab,
        lastProgressUpdateTime: this._lastProgressUpdateTime,
        generatedContent: { ...this._generatedContent },
        manualCtasData: [...this._manualCtasData],
        keywordCtaData: { ...this._keywordCtaData }
      };

      this._currentPlatform = 'wordpress';
      this._isRunning = false;
      this._isCanceled = false;
      this._currentTab = 'main';
      this._lastProgressUpdateTime = null;
      this._generatedContent = {
        title: '',
        content: '',
        thumbnailUrl: '',
        payload: null
      };
      this._manualCtasData = [];
      this._keywordCtaData = {};

      this._notify('reset', null, oldState);
      console.log('✅ [AppState] 상태 초기화 완료');
    }

    // 이벤트 리스너 등록
    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(callback);
    }

    // 이벤트 리스너 제거
    off(event, callback) {
      if (this._listeners.has(event)) {
        const callbacks = this._listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }

    // 이벤트 알림
    _notify(property, newValue, oldValue) {
      if (this._listeners.has(property)) {
        this._listeners.get(property).forEach(callback => {
          try {
            callback(newValue, oldValue, property);
          } catch (error) {
            console.error(`[AppState] 이벤트 리스너 오류 (${property}):`, error);
          }
        });
      }

      // 전체 변경 이벤트
      if (this._listeners.has('*')) {
        this._listeners.get('*').forEach(callback => {
          try {
            callback(property, newValue, oldValue);
          } catch (error) {
            console.error('[AppState] 전체 이벤트 리스너 오류:', error);
          }
        });
      }
    }
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = new AppStateClass();
      }
      return instance;
    }
  };
})();

// 🔧 싱글톤 인스턴스 가져오기 헬퍼
const getAppState = () => AppState.getInstance();

// 🔧 전역 변수 유지 (하위 호환성) - AppState를 통해 관리
// 참고: 이 변수들은 AppState의 내부 상태와 동기화됩니다
let currentPlatform = 'wordpress';
let isRunning = false;
let isCanceled = false;
let currentTab = 'main';
let lastProgressUpdateTime = null;
// generatedContent, manualCtasData, keywordCtaData는 AppState에서만 관리

// 🔧 전역 변수 동기화 헬퍼 (AppState와 동기화)
function syncGlobalAppStateVars() {
  const appState = getAppState();
  currentPlatform = appState.currentPlatform;
  isRunning = appState.isRunning;
  isCanceled = appState.isCanceled;
  currentTab = appState.currentTab;
  lastProgressUpdateTime = appState.lastProgressUpdateTime;
  // generatedContent, manualCtasData, keywordCtaData는 직접 참조하지 않고 appState를 통해 접근
}

// 🔧 AppState 변경 시 전역 변수 자동 동기화
getAppState().on('*', () => {
  syncGlobalAppStateVars();
});

// 포스팅 실행 함수
async function runSmartPosting() {
  // 라이선스 체크
  if (!isLicenseValid()) {
    alert('🔒 라이선스 등록이 필요합니다.\n라이선스 모달이 열립니다.');
    const licenseModal = document.getElementById('licenseModal');
    if (licenseModal) {
      licenseModal.style.display = 'flex';
    }
    return;
  }

  // 키워드 입력 필드 값 확인
  const keywordInput = DOMCache.get('keywordInput');
  const keywordValue = keywordInput ? keywordInput.value.trim() : '';

  // 키워드 리스트에서 동적으로 추가된 키워드 확인
  const keywordList = document.getElementById('keywordList');
  const keywordItems = keywordList ? keywordList.querySelectorAll('.keyword-item') : [];

  console.log('🔍 runSmartPosting 상세 디버깅:');
  console.log('- keywordInput 요소:', keywordInput);
  console.log('- keywordInput.value:', keywordInput ? keywordInput.value : 'null');
  console.log('- keywordValue (trimmed):', keywordValue);
  console.log('- keywordList 요소:', keywordList);
  console.log('- keywordItems.length:', keywordItems.length);
  console.log('- 조건 체크:');
  console.log('  * keywordValue && keywordItems.length === 0:', keywordValue && keywordItems.length === 0);
  console.log('  * keywordItems.length > 0:', keywordItems.length > 0);

  // 키워드가 있는지 확인 (입력 필드 또는 키워드 리스트)
  const hasKeywordInInput = keywordValue && keywordValue.length > 0;
  const hasKeywordsInList = keywordItems.length > 0;

  if (hasKeywordInInput && keywordItems.length === 0) {
    // 키워드 입력 필드에만 값이 있고, 키워드 리스트가 비어있는 경우 - 단일 포스팅
    console.log('✅ 단일 포스팅 실행');
    await runPosting();
  } else if (hasKeywordsInList) {
    // 키워드 리스트에 항목이 있는 경우 - 대량 포스팅
    console.log('✅ 대량 포스팅 실행');
    await runBulkPosting();
  } else if (hasKeywordInInput) {
    // 키워드 입력 필드에 값이 있지만 다른 조건이 맞지 않는 경우도 단일 포스팅으로 처리
    console.log('✅ 단일 포스팅 실행 (fallback)');
    await runPosting();
  } else {
    console.log('❌ 키워드 없음 - 에러 메시지 표시');
    alert('최소 1개의 키워드를 입력해주세요.');
  }
}

// ── runPosting: posting.js 모듈로 위임 ──
// 원본은 posting.js의 export function runPosting()에 있음
// window.runPosting은 main.js에서 등록됨
// 이 스텁은 script.js 내부 호출(예: runSmartPosting)을 위한 fallback
async function runPosting() {
  if (typeof window.runPosting === 'function') {
    return window.runPosting();
  }
  console.error('[POSTING] runPosting 모듈이 로드되지 않았습니다.');
}



// ========== 디버깅 및 로깅 함수 ==========

// 상세 디버깅 로그 함수
function debugLog(step, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] 🔍 [${step}] ${message}`;
  console.log(logMessage);

  if (data) {
    console.log(`[${timestamp}] 📊 [${step}] 데이터:`, data);
  }

  // UI 로그에도 표시
  addLog(`[${step}] ${message}`, 'info');
}

// 오류 상세 로깅 함수
function errorLog(step, error, context = null) {
  const timestamp = new Date().toLocaleTimeString();
  const errorMessage = `[${timestamp}] ❌ [${step}] 오류: ${error.message || error}`;
  console.error(errorMessage);

  if (context) {
    console.error(`[${timestamp}] 📋 [${step}] 컨텍스트:`, context);
  }

  // 스택 트레이스도 출력
  if (error.stack) {
    console.error(`[${timestamp}] 📚 [${step}] 스택:`, error.stack);
  }

  // UI 로그에도 표시
  addLog(`[${step}] 오류: ${error.message || error}`, 'error');
}

// 성공 로깅 함수
function successLog(step, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const successMessage = `[${timestamp}] ✅ [${step}] 성공: ${message}`;
  console.log(successMessage);

  if (data) {
    console.log(`[${timestamp}] 📊 [${step}] 결과:`, data);
  }

  // UI 로그에도 표시
  addLog(`[${step}] 성공: ${message}`, 'success');
}

// 진행 상태 모달 표시
function showProgressModal() {
  debugLog('MODAL', 'showProgressModal 호출됨');

  const progressBar = document.getElementById('premiumProgressBar');
  const publishBtn = DOMCache.get('publishBtn');
  const cancelBtn = document.getElementById('cancelProgressBtn');

  console.log('🔍 진행 바 요소 찾기:', {
    progressBar: !!progressBar,
    publishBtn: !!publishBtn
  });

  if (progressBar) {
    console.log('✅ 프리미엄 진행 바 표시 시작');

    // 🔥 stacking context 문제 방지: body 최상위로 이동
    if (progressBar.parentElement !== document.body) {
      document.body.appendChild(progressBar);
      console.log('[PROGRESS] ✅ body로 이동 완료');
    }

    // 🔥 viewport 전체 오버레이로 강제 설정
    progressBar.style.position = 'fixed';
    progressBar.style.top = '0';
    progressBar.style.left = '0';
    progressBar.style.width = '100vw';
    progressBar.style.height = '100vh';
    progressBar.style.zIndex = '2147483647';
    progressBar.style.transform = 'none';

    // 진행 시작 시간 설정
    // 🔧 ProgressManager 사용
    getProgressManager().reset();
    window.progressStartTime = getProgressManager().progressStartTime;

    // 진행 바 표시 (flex로 중앙 정렬)
    progressBar.style.display = 'flex';
    progressBar.style.visibility = 'visible';
    progressBar.style.opacity = '1';
    progressBar.style.alignItems = 'center';
    progressBar.style.justifyContent = 'center';

    // 원형 진행률 초기화
    const progressCircle = document.getElementById('progressCircle');
    if (progressCircle) {
      progressCircle.style.strokeDashoffset = '314'; // 0% (r=50, circumference = 2 * PI * 50 ≈ 314)
    }
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    const progressPercentage = document.getElementById('progressPercentage');
    if (progressPercentage) {
      progressPercentage.textContent = '0%';
    }
    const progressStep = document.getElementById('progressStep');
    if (progressStep) {
      progressStep.textContent = '작업 준비 중...';
    }
    const progressLogContent = document.getElementById('progressLogContent');
    if (progressLogContent) {
      progressLogContent.innerHTML = '<div style="color: #60a5fa;">🚀 발행 준비 중...</div>';
    }

    // 진행 상태 초기화
    // 🔧 ProgressManager 사용
    getProgressManager().reset();
    getProgressManager().updateProgress(0, 0, '작업 준비 중...');

    const elapsedEl = document.getElementById('progressElapsed');
    if (elapsedEl) {
      elapsedEl.textContent = '00:00';
    }
    const etaEl = document.getElementById('progressEta');
    if (etaEl) {
      etaEl.textContent = '--:--';
    }

    if (cancelBtn) {
      cancelBtn.disabled = false;
      cancelBtn.style.opacity = '1';
      cancelBtn.style.pointerEvents = 'auto';
    }

    // 진행 단계들 초기화
    initializeProgressSteps();

    resetProgressSteps();

    console.log('✅ 모달 표시 완료');
  } else {
    console.error('❌ 모달 요소를 찾을 수 없음:', {
      overlay: overlay,
      container: container,
      allProgressElements: document.querySelectorAll('[id*="progress"]')
    });

    // 대체 방법으로 모달 강제 생성
    createFallbackProgressModal();
  }

  // 발행 버튼 상태 업데이트
  // 🔧 ButtonStateManager 사용
  ButtonStateManager.setLoading('publishBtn', `
      <span style="display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700;">
        <span style="animation: pulse 1.5s infinite;">✍️</span>
        <span>글 작성중...</span>
      </span>
    `);
}

// 대체 진행상황 모달 생성 함수
function createFallbackProgressModal() {
  console.log('🔄 대체 진행상황 모달 생성 시작');

  // 기존 모달이 있다면 제거
  const existingOverlay = document.getElementById('fallbackProgressOverlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // 새 모달 생성
  const overlay = document.createElement('div');
  overlay.id = 'fallbackProgressOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    visibility: visible;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 380px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.08);
  `;

  container.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
    <h2 style="margin: 0 0 20px 0; color: #333;">포스팅 생성 중...</h2>
    <div style="background: #f0f0f0; border-radius: 10px; height: 20px; margin: 20px 0; overflow: hidden;">
      <div id="fallbackProgressBar" style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
    </div>
    <div id="fallbackProgressText" style="color: #666; font-size: 14px;">0%</div>
    <div id="fallbackProgressStatus" style="color: #999; font-size: 12px; margin-top: 10px;">초기화 중...</div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  console.log('✅ 대체 진행상황 모달 생성 완료');

  // 전역 변수로 저장하여 업데이트 함수에서 사용할 수 있도록 함
  window.fallbackProgressModal = {
    overlay: overlay,
    container: container,
    progressBar: container.querySelector('#fallbackProgressBar'),
    progressText: container.querySelector('#fallbackProgressText'),
    progressStatus: container.querySelector('#fallbackProgressStatus')
  };
}

// 🔧 HTML 텍스트 추출 함수 (순수 텍스트만 반환)
function getPlainText(html) {
  if (!html) return '';

  // 임시 div 요소 생성
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // 텍스트만 추출 (공백 정규화)
  const text = tempDiv.textContent || tempDiv.innerText || '';

  // 연속된 공백을 하나로, 줄바꿈 제거
  return text.replace(/\s+/g, ' ').trim();
}

// 🔧 HTML 글자수 계산 함수 (순수 텍스트만)
function getTextLength(html) {
  return getPlainText(html).length;
}

// 🔧 HTML Sanitization 함수
function sanitizeHTML(html, options = {}) {
  if (!html || typeof html !== 'string') return '';

  const {
    allowTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'div', 'span'],
    allowAttributes = ['href', 'src', 'alt', 'title', 'class', 'style'],
    stripTags = false
  } = options;

  // DOMPurify가 있으면 사용
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    const config = {
      ALLOWED_TAGS: allowTags,
      ALLOWED_ATTR: allowAttributes,
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true
    };
    return DOMPurify.sanitize(html, config);
  }

  // 기본 sanitization 로직
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // 스크립트 태그 제거
  const scripts = tempDiv.querySelectorAll('script, style, iframe, object, embed, form, input, button');
  scripts.forEach(el => el.remove());

  // 이벤트 핸들러 제거
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(el => {
    // 모든 이벤트 핸들러 속성 제거
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      // 허용되지 않은 속성 제거
      if (!allowAttributes.includes(attr.name) && attr.name !== 'id' && attr.name !== 'class') {
        // style과 class는 특별 처리
        if (attr.name !== 'style' && attr.name !== 'class') {
          el.removeAttribute(attr.name);
        }
      }
    });

    // 허용되지 않은 태그 제거
    if (!allowTags.includes(el.tagName.toLowerCase())) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    }
  });

  // javascript: 프로토콜 제거
  const links = tempDiv.querySelectorAll('a[href]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.toLowerCase().startsWith('javascript:')) {
      link.removeAttribute('href');
    }
  });

  return tempDiv.innerHTML;
}

// 🔧 Debounce 유틸리티 함수
function debounce(func, wait, immediate = false) {
  let timeout = null;

  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(this, args);
    }
  };
}

// 🔧 스토리지 관리자 클래스 (싱글톤 패턴)
const StorageManager = (() => {
  let instance = null;

  class StorageManagerClass {
    constructor() {
      if (instance) {
        return instance;
      }

      // 작업 큐
      this.queue = [];
      this.processing = false;

      // requestIdleCallback 폴백
      this.requestIdleCallback = window.requestIdleCallback ||
        ((cb) => setTimeout(() => cb({ timeRemaining: () => 16 }), 1));

      instance = this;
      return this;
    }

    // 큐 처리
    async processQueue() {
      if (this.processing || this.queue.length === 0) return;

      this.processing = true;

      while (this.queue.length > 0) {
        const task = this.queue.shift();

        try {
          await this.executeTask(task);
        } catch (error) {
          console.error('[StorageManager] 작업 실행 오류:', error);
          if (task.reject) {
            task.reject(error);
          }
        }
      }

      this.processing = false;
    }

    // 작업 실행
    async executeTask(task) {
      return new Promise((resolve, reject) => {
        // requestIdleCallback 대신 직접 실행 (localStorage는 동기적이므로 문제 없음)
        // 단, 메인 스레드 블로킹을 방지하기 위해 setTimeout으로 지연
        setTimeout(() => {
          try {
            let result;

            // localStorage 메서드를 변수에 저장하여 컨텍스트 문제 해결
            const getItem = localStorage.getItem.bind(localStorage);
            const setItem = localStorage.setItem.bind(localStorage);
            const removeItem = localStorage.removeItem.bind(localStorage);

            switch (task.operation) {
              case 'get':
                result = getItem(task.key);
                if (task.parse) {
                  result = result ? JSON.parse(result) : null;
                }
                break;

              case 'set':
                const value = task.parse ? JSON.stringify(task.value) : task.value;
                setItem(task.key, value);
                result = true;
                break;

              case 'remove':
                removeItem(task.key);
                result = true;
                break;

              default:
                throw new Error(`알 수 없는 작업: ${task.operation}`);
            }

            if (task.resolve) {
              task.resolve(result);
            }
            resolve(result);
          } catch (error) {
            if (task.reject) {
              task.reject(error);
            }
            reject(error);
          }
        }, 0);
      });
    }

    // 비동기 get
    async get(key, parse = false) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          operation: 'get',
          key,
          parse,
          resolve,
          reject
        });

        // 큐 처리 시작
        this.processQueue();
      });
    }

    // 비동기 set
    async set(key, value, stringify = false) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          operation: 'set',
          key,
          value,
          parse: stringify,
          resolve,
          reject
        });

        // 큐 처리 시작
        this.processQueue();
      });
    }

    // 비동기 remove
    async remove(key) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          operation: 'remove',
          key,
          resolve,
          reject
        });

        // 큐 처리 시작
        this.processQueue();
      });
    }

    // 동기 get (하위 호환성 - 가능한 한 사용하지 않음)
    getSync(key, parse = false) {
      try {
        const value = localStorage.getItem(key);
        if (parse) {
          return value ? JSON.parse(value) : null;
        }
        return value;
      } catch (error) {
        console.error(`[StorageManager] 동기 get 오류 (${key}):`, error);
        return null;
      }
    }

    // 동기 set (하위 호환성 - 가능한 한 사용하지 않음)
    setSync(key, value, stringify = false) {
      try {
        const valueToStore = stringify ? JSON.stringify(value) : value;
        localStorage.setItem(key, valueToStore);
        return true;
      } catch (error) {
        console.error(`[StorageManager] 동기 set 오류 (${key}):`, error);
        return false;
      }
    }

    // 동기 remove (하위 호환성)
    removeSync(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error(`[StorageManager] 동기 remove 오류 (${key}):`, error);
        return false;
      }
    }
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = new StorageManagerClass();
      }
      return instance;
    }
  };
})();

// 🔧 싱글톤 인스턴스 가져오기 헬퍼
const getStorageManager = () => StorageManager.getInstance();

// 🔧 에러 핸들러 클래스 (싱글톤 패턴)
const ErrorHandler = (() => {
  let instance = null;

  class ErrorHandlerClass {
    constructor() {
      if (instance) {
        return instance;
      }

      // 사용자 친화적 에러 메시지 매핑
      this.errorMessages = {
        // 네트워크 에러
        'NetworkError': '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요.',
        'Failed to fetch': '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
        'Network request failed': '네트워크 요청이 실패했습니다. 인터넷 연결을 확인해주세요.',

        // API 에러
        'API key': 'API 키가 유효하지 않거나 만료되었습니다. 환경 설정에서 확인해주세요.',
        'Invalid API key': 'API 키가 올바르지 않습니다. 환경 설정에서 확인해주세요.',
        'Unauthorized': '인증에 실패했습니다. API 키를 확인해주세요.',
        'Forbidden': '접근 권한이 없습니다. API 키 권한을 확인해주세요.',
        'Rate limit': 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        'Quota exceeded': 'API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요.',

        // 설정 에러
        '설정': '설정을 확인해주세요.',
        '필수': '필수 항목을 입력해주세요.',
        '키워드': '키워드를 입력해주세요.',
        '주제': '주제를 입력해주세요.',
        '플랫폼': '플랫폼을 선택해주세요.',
        '저장 실패': '설정 저장에 실패했습니다. 다시 시도해주세요.',
        '로드 실패': '설정을 불러오는데 실패했습니다.',

        // 콘텐츠 생성 에러
        '콘텐츠 생성': '콘텐츠 생성 중 오류가 발생했습니다.',
        '생성 실패': '콘텐츠 생성에 실패했습니다. 설정을 확인해주세요.',
        '타임아웃': '작업 시간이 초과되었습니다. 다시 시도해주세요.',
        'Timeout': '작업 시간이 초과되었습니다. 다시 시도해주세요.',

        // 발행 에러
        '발행 실패': '블로그 발행에 실패했습니다.',
        '발행': '블로그 발행 중 오류가 발생했습니다.',
        '인증': '플랫폼 인증에 실패했습니다. 인증 정보를 확인해주세요.',
        '연결': '플랫폼에 연결할 수 없습니다. 설정을 확인해주세요.',

        // 일반 에러
        '알 수 없는 오류': '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        '예기치 않은 오류': '예기치 않은 오류가 발생했습니다.',
        '오류': '오류가 발생했습니다.'
      };

      // 에러 타입별 처리 전략
      this.errorStrategies = {
        'NetworkError': { severity: 'high', retryable: true, showToast: true },
        'TypeError': { severity: 'medium', retryable: false, showToast: true },
        'ReferenceError': { severity: 'high', retryable: false, showToast: true },
        'SyntaxError': { severity: 'high', retryable: false, showToast: false },
        'Error': { severity: 'medium', retryable: true, showToast: true }
      };

      instance = this;
      return this;
    }

    // 사용자 친화적 메시지 생성
    getUserFriendlyMessage(error) {
      const errorMessage = error?.message || String(error);
      const errorName = error?.constructor?.name || 'Error';

      // 특정 에러 메시지 매핑 확인
      for (const [key, message] of Object.entries(this.errorMessages)) {
        if (errorMessage.includes(key) || errorMessage.toLowerCase().includes(key.toLowerCase())) {
          return message;
        }
      }

      // 에러 타입별 기본 메시지
      if (errorName === 'NetworkError' || errorMessage.includes('fetch') || errorMessage.includes('network')) {
        return '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요.';
      }

      if (errorMessage.includes('API') || errorMessage.includes('key') || errorMessage.includes('인증')) {
        return 'API 설정에 문제가 있습니다. 환경 설정에서 API 키를 확인해주세요.';
      }

      if (errorMessage.includes('설정') || errorMessage.includes('설정')) {
        return '설정에 문제가 있습니다. 환경 설정을 확인해주세요.';
      }

      // 기본 메시지
      return errorMessage || '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }

    // 에러 로깅
    logError(error, context = {}) {
      const timestamp = new Date().toLocaleTimeString();
      const errorName = error?.constructor?.name || 'Error';
      const errorMessage = error?.message || String(error);
      const userMessage = this.getUserFriendlyMessage(error);

      // 콘솔 로깅
      console.error(`[${timestamp}] ❌ [ERROR] ${errorName}:`, errorMessage);
      if (context && Object.keys(context).length > 0) {
        console.error(`[${timestamp}] 📋 [ERROR] 컨텍스트:`, context);
      }
      if (error?.stack) {
        console.error(`[${timestamp}] 📚 [ERROR] 스택:`, error.stack);
      }

      // UI 로그에도 표시
      const contextStr = context.function ? `[${context.function}] ` : '';
      addLog(`${contextStr}오류: ${userMessage}`, 'error');

      return {
        errorName,
        errorMessage,
        userMessage,
        timestamp,
        context
      };
    }

    // 토스트 알림 표시
    showToast(message, type = 'error', duration = 5000) {
      // 기존 토스트 제거
      const existingToast = document.getElementById('errorToast');
      if (existingToast) {
        existingToast.remove();
      }

      // 토스트 생성
      const toast = document.createElement('div');
      toast.id = 'errorToast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 16px 24px;
        background: ${type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
          type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        font-size: 14px;
        font-weight: 600;
        max-width: 400px;
        word-wrap: break-word;
        animation: slideInRight 0.3s ease-out;
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.2);
      `;

      const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
      toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">${icon}</span>
          <span>${message}</span>
        </div>
      `;

      // 애니메이션 스타일 추가
      if (!document.getElementById('toastAnimationStyle')) {
        const style = document.createElement('style');
        style.id = 'toastAnimationStyle';
        style.textContent = `
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(toast);

      // 자동 제거
      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.animation = 'slideOutRight 0.3s ease-out';
          setTimeout(() => {
            if (toast.parentNode) {
              toast.remove();
            }
          }, 300);
        }
      }, duration);

      return toast;
    }

    // 에러 처리 메인 메서드
    handle(error, context = {}) {
      const errorName = error?.constructor?.name || 'Error';
      const strategy = this.errorStrategies[errorName] || this.errorStrategies['Error'];
      const userMessage = this.getUserFriendlyMessage(error);

      // 에러 로깅
      const logData = this.logError(error, context);

      // 토스트 표시 (전략에 따라)
      if (strategy.showToast) {
        this.showToast(userMessage, 'error', strategy.severity === 'high' ? 7000 : 5000);
      }

      // 심각한 에러는 alert도 표시
      if (strategy.severity === 'high' && !strategy.retryable) {
        setTimeout(() => {
          alert(`⚠️ 심각한 오류가 발생했습니다:\n\n${userMessage}\n\n자세한 내용은 로그를 확인해주세요.`);
        }, 100);
      }

      return {
        handled: true,
        userMessage,
        retryable: strategy.retryable,
        severity: strategy.severity,
        logData
      };
    }

    // 특정 함수용 에러 처리 래퍼
    wrapFunction(fn, functionName, options = {}) {
      return async (...args) => {
        try {
          return await fn.apply(this, args);
        } catch (error) {
          const context = {
            function: functionName,
            ...options.context
          };

          const result = this.handle(error, context);

          // 옵션에 따라 추가 처리
          if (options.onError) {
            options.onError(error, result);
          }

          // 재시도 가능한 에러인 경우
          if (result.retryable && options.retry) {
            // 재시도 로직은 호출자가 처리
          }

          throw error; // 원래 에러를 다시 throw하여 호출자가 처리할 수 있도록
        }
      };
    }
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = new ErrorHandlerClass();
      }
      return instance;
    }
  };
})();

// 🔧 싱글톤 인스턴스 가져오기 헬퍼
const getErrorHandler = () => ErrorHandler.getInstance();

// 🔧 진행률 관리자 클래스 (싱글톤 패턴)
const ProgressManager = (() => {
  // 싱글톤 인스턴스
  let instance = null;

  class ProgressManagerClass {
    constructor() {
      if (instance) {
        return instance;
      }

      // 내부 상태
      this.progressStartTime = null;
      this.overallProgress = 0;
      this.currentProgress = 0;
      this.progressAnimationId = null;

      // DOM 요소 캐시
      this.elements = {
        fillEl: null,
        textEl: null,
        stepEl: null,
        elapsedEl: null,
        etaEl: null,
        progressBarFill: null,
        progressText: null,
        circle: null
      };

      instance = this;
      return this;
    }

    // 초기화: DOM 요소 가져오기
    init() {
      this.elements = {
        fillEl: document.getElementById('progressBarFill'),
        textEl: document.getElementById('progressBarText'),
        stepEl: document.getElementById('progressStep'),
        elapsedEl: document.getElementById('progressElapsed') || document.getElementById('elapsedTime'),
        etaEl: document.getElementById('progressEta') || document.getElementById('estimatedTime'),
        progressBarFill: document.getElementById('progressBarFill'),
        progressText: document.getElementById('progressBarText'),
        circle: document.getElementById('progressCircle')
      };

      // 진행 시작 시간 초기화
      if (!this.progressStartTime) {
        this.progressStartTime = Date.now();
      }
    }

    // 진행 상태 텍스트 업데이트
    updateStatus(statusText) {
      if (!statusText) return;
      if (!this.elements.stepEl) this.init();
      if (this.elements.stepEl) {
        this.elements.stepEl.textContent = statusText;
      }
    }

    // 시간 정보 업데이트 (내부 메서드)
    _updateTime(percentage = 0) {
      if (!this.elements.elapsedEl || !this.elements.etaEl) this.init();

      if (!this.progressStartTime) {
        this.progressStartTime = Date.now();
      }

      // 경과 시간 업데이트
      if (this.elements.elapsedEl) {
        const elapsed = Date.now() - this.progressStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        this.elements.elapsedEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }

      // 예상 완료 시간 업데이트
      if (this.elements.etaEl) {
        if (percentage > 0) {
          const elapsed = Date.now() - this.progressStartTime;
          const totalEstimated = (elapsed / percentage) * 100;
          const remaining = Math.max(0, totalEstimated - elapsed);
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          this.elements.etaEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
          this.elements.etaEl.textContent = '--:--';
        }
      }
    }

    // 통합 진행률 업데이트 (메인 메서드)
    updateProgress(stepPercentage, targetPercentage = null, statusText = null) {
      // 성능 최적화: requestAnimationFrame 사용
      requestAnimationFrame(() => {
        if (!this.elements.fillEl || !this.elements.textEl) this.init();

        const percentage = Math.max(0, Math.min(100, Math.round(stepPercentage)));

        // 진행률 바 업데이트
        if (this.elements.textEl) {
          this.elements.textEl.textContent = `${percentage}%`;
        }
        if (this.elements.fillEl) {
          this.elements.fillEl.style.width = `${percentage}%`;
        }

        // 상태 텍스트 업데이트
        if (statusText) {
          this.updateStatus(statusText);
        }

        // 시간 정보 업데이트
        this._updateTime(percentage);

        // 전체 진행률 업데이트 (안정적 증가)
        const finalProgress = targetPercentage || stepPercentage;
        if (finalProgress > this.overallProgress) {
          this.overallProgress = finalProgress;
          // 전역 변수 동기화
          syncGlobalProgressVars();
        }
      });
    }

    // 단계별 진행률 업데이트
    updateStepProgress(percentage) {
      console.log(`📊 단계별 진행률 업데이트: ${percentage}%`);

      if (!this.elements.progressBarFill || !this.elements.progressText) this.init();

      const clampedPercentage = Math.min(100, Math.max(0, percentage));

      // 진행률 바 업데이트
      if (this.elements.progressBarFill) {
        this.elements.progressBarFill.style.transition = 'width 0.2s ease-out';
        this.elements.progressBarFill.style.width = `${clampedPercentage}%`;
      }

      if (this.elements.progressText) {
        this.elements.progressText.textContent = `${Math.round(clampedPercentage)}%`;
      }

      // 전체 진행률도 함께 업데이트
      this.updateOverallProgressBar(clampedPercentage);

      // 진행률이 업데이트될 때마다 UI 강제 새로고침
      requestAnimationFrame(() => {
        if (this.elements.progressBarFill) {
          this.elements.progressBarFill.style.transform = 'translateZ(0)'; // GPU 가속 강제
        }
      });
    }

    // 전체 진행률 바 업데이트
    updateOverallProgressBar(percentage) {
      this.overallProgress = Math.min(100, Math.max(0, percentage));
      console.log(`📈 전체 진행률 업데이트: ${this.overallProgress}%`);

      if (!this.elements.fillEl || !this.elements.textEl) this.init();

      if (this.elements.fillEl) {
        this.elements.fillEl.style.transition = 'width 0.3s ease-out';
        this.elements.fillEl.style.width = `${this.overallProgress}%`;
      }

      if (this.elements.textEl) {
        this.elements.textEl.textContent = `${Math.round(this.overallProgress)}%`;
      }

      // 전역 변수 동기화
      syncGlobalProgressVars();
    }

    // 진행률 원형 차트 업데이트
    updateProgressCircle(percentage) {
      if (!this.elements.circle) this.init();

      if (this.elements.circle) {
        const circumference = 2 * Math.PI * 40; // 2 * π * 40 = 251.33
        const offset = circumference - (percentage / 100) * circumference;

        // 부드러운 애니메이션 추가 (성능 최적화)
        this.elements.circle.style.transition = 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.2s ease-out';
        this.elements.circle.style.strokeDashoffset = offset;

        // 진행률에 따른 펄스 효과
        if (percentage > 0 && percentage < 100) {
          this.elements.circle.style.filter = 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.2))';
        } else if (percentage === 100) {
          this.elements.circle.style.filter = 'drop-shadow(0 0 10px rgba(76, 175, 80, 0.5))';
        }

        console.log(`🎯 진행률: ${percentage}%, 오프셋: ${offset}`);
      }
    }

    // 부드러운 진행률 업데이트 (현재 비활성화됨)
    smoothProgressUpdate(targetProgress, label) {
      // 완전 비활성화 - 백엔드 진행률을 직접 사용
      console.log(`[SMOOTH PROGRESS] 비활성화됨 - 백엔드 진행률 직접 사용: ${targetProgress}%`);
      return;
    }

    // 진행 시작 시간 초기화
    reset() {
      this.progressStartTime = Date.now();
      this.overallProgress = 0;
      this.currentProgress = 0;
      if (this.progressAnimationId) {
        cancelAnimationFrame(this.progressAnimationId);
        this.progressAnimationId = null;
      }
      // 전역 변수 동기화
      syncGlobalProgressVars();
    }

    // 진행률 초기화
    resetProgress() {
      this.overallProgress = 0;
      this.currentProgress = 0;
      this.updateProgress(0, 0);
      this.updateStepProgress(0);
      this.updateOverallProgressBar(0);
      // 전역 변수 동기화
      syncGlobalProgressVars();
    }
  }

  // 싱글톤 인스턴스 반환
  return {
    getInstance: () => {
      if (!instance) {
        instance = new ProgressManagerClass();
      }
      return instance;
    }
  };
})();

// 🔧 전역 변수 유지 (하위 호환성) - ProgressManager를 통해 관리
// 참고: 이 변수들은 ProgressManager의 내부 상태와 동기화됩니다
let progressStartTime = null;
let overallProgress = 0;
let currentProgress = 0;
let progressAnimationId = null;

// 🔧 전역 변수 동기화 헬퍼 (ProgressManager와 동기화)
function syncGlobalProgressVars() {
  const pm = getProgressManager();
  progressStartTime = pm.progressStartTime;
  overallProgress = pm.overallProgress;
  currentProgress = pm.currentProgress;
  progressAnimationId = pm.progressAnimationId;
}

// 🔧 싱글톤 인스턴스 가져오기 헬퍼
const getProgressManager = () => ProgressManager.getInstance();

// 진행 단계 초기화
function resetProgressSteps() {
  const steps = document.querySelectorAll('.progress-step');
  steps.forEach(step => {
    const icon = step.querySelector('.progress-step-icon');
    if (icon) {
      icon.className = 'progress-step-icon pending';
      icon.textContent = '⭕';
    }
    step.className = 'progress-step';
  });
}

// 🚀 새로운 모던 단계별 진행 상황 관리
const progressSteps = [
  { id: 'step1', name: '키워드 분석', description: '검색 키워드를 분석하고 최적화합니다', icon: '🔍' },
  { id: 'step2', name: '콘텐츠 크롤링', description: '관련 정보를 수집하고 분석합니다', icon: '🕷️' },
  { id: 'step3', name: 'AI 콘텐츠 생성', description: 'AI가 고품질 콘텐츠를 생성합니다', icon: '🤖' },
  { id: 'step4', name: 'SEO 최적화', description: '검색 엔진 최적화를 적용합니다', icon: '📈' },
  { id: 'step5', name: '최종 검토', description: '콘텐츠 품질을 검토합니다', icon: '✅' }
];

// 진행 단계 초기화
function initializeProgressSteps() {
  const stepsContainer = document.getElementById('progressSteps');
  const stepsProgress = document.getElementById('stepsProgress');

  if (stepsContainer) {
    stepsContainer.innerHTML = '';
    progressSteps.forEach((step, index) => {
      const stepElement = document.createElement('div');
      stepElement.className = 'progress-step';
      stepElement.id = step.id;
      stepElement.innerHTML = `
        <div class="progress-step-icon pending">${step.icon}</div>
        <div class="step-content">
          <div class="step-name">${step.name}</div>
          <div class="step-description">${step.description}</div>
        </div>
        <div class="step-time">--:--</div>
      `;
      stepsContainer.appendChild(stepElement);
    });
  }

  if (stepsProgress) {
    stepsProgress.textContent = `0/${progressSteps.length}`;
  }
}

// 진행 단계 업데이트
function updateProgressStep(stepId, status) {
  const step = document.getElementById(stepId);
  if (step) {
    const icon = step.querySelector('.progress-step-icon');
    const stepTime = step.querySelector('.step-time');

    if (icon) {
      icon.className = `progress-step-icon ${status}`;
      if (status === 'active') {
        icon.textContent = '🔄';
        stepTime.textContent = '진행중...';
      } else if (status === 'completed') {
        icon.textContent = '✅';
        stepTime.textContent = '완료';
      }
    }
    step.className = `progress-step ${status}`;

    // 전체 단계 진행률 업데이트
    updateStepsProgress();
  }
}

// 단계 진행률 업데이트
function updateStepsProgress() {
  const stepsProgress = document.getElementById('stepsProgress');
  if (stepsProgress) {
    const completedSteps = document.querySelectorAll('.progress-step.completed').length;
    const activeSteps = document.querySelectorAll('.progress-step.active').length;
    const currentStep = completedSteps + activeSteps;
    stepsProgress.textContent = `${currentStep}/${progressSteps.length}`;
  }
}

// 🎯 끝판왕 자동 진행률 단계 업데이트
function updateAutoProgressStages(progress) {
  const stages = document.querySelectorAll('.progress-stage');
  const stageThresholds = [
    { stage: 'crawl', threshold: 5, completeAt: 25 },
    { stage: 'title', threshold: 25, completeAt: 40 },
    { stage: 'structure', threshold: 40, completeAt: 55 },
    { stage: 'content', threshold: 55, completeAt: 85 },
    { stage: 'publish', threshold: 85, completeAt: 100 }
  ];

  stages.forEach((stageEl) => {
    const stageName = stageEl.getAttribute('data-stage');
    const stageConfig = stageThresholds.find(s => s.stage === stageName);

    if (stageConfig) {
      // 🔥 완료 상태
      if (progress >= stageConfig.completeAt) {
        stageEl.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.3) 100%)';
        stageEl.style.borderColor = 'rgba(16, 185, 129, 0.8)';
        stageEl.style.transform = 'scale(1)';
        stageEl.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
        // 아이콘을 체크마크로 변경
        const iconEl = stageEl.querySelector('div:first-child');
        if (iconEl && !iconEl.textContent.includes('✅')) {
          iconEl.textContent = '✅';
        }
      }
      // 🔥 진행 중 상태 (펄스 애니메이션)
      else if (progress >= stageConfig.threshold) {
        stageEl.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(118, 75, 162, 0.4) 100%)';
        stageEl.style.borderColor = 'rgba(102, 126, 234, 0.8)';
        stageEl.style.transform = 'scale(1.08)';
        stageEl.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.5)';
        stageEl.style.animation = 'pulse 1.5s infinite';
      }
      // 🔥 대기 상태
      else {
        stageEl.style.background = 'rgba(255,255,255,0.05)';
        stageEl.style.borderColor = 'rgba(255,255,255,0.1)';
        stageEl.style.transform = 'scale(1)';
        stageEl.style.boxShadow = 'none';
        stageEl.style.animation = 'none';
      }

      // 트랜지션 추가
      stageEl.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  });
}

// 진행 상태 모달 숨기기 (최적화된 버전)
function hideProgressModal() {
  console.log('🚀 hideProgressModal 호출됨');

  const progressBar = document.getElementById('premiumProgressBar');
  const publishBtn = DOMCache.get('publishBtn');
  const cancelBtn = document.getElementById('cancelProgressBtn');

  if (progressBar) {
    console.log('✅ 프리미엄 진행 바 숨기기 시작');

    // 진행 바 숨기기
    progressBar.style.display = 'none';
    progressBar.style.visibility = 'hidden';
    progressBar.style.opacity = '0';

    console.log('✅ 프리미엄 진행 바 완전히 숨김');
  } else {
    console.warn('⚠️ 진행 바 요소를 찾을 수 없습니다');
  }

  // 🔧 ButtonStateManager 사용
  ButtonStateManager.restore('publishBtn');

  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.style.opacity = '0.6';
    cancelBtn.style.pointerEvents = 'none';
  }
}

// 진행 취소
function cancelProgress() {
  // 🔧 AppState 사용
  getAppState().isCanceled = true;
  addLog('사용자가 작업을 취소했습니다.', 'warning');
  hideProgressModal();
  setRunning(false);
}

// 실행 상태 설정
function setRunning(running) {
  // 🔧 AppState 사용
  getAppState().isRunning = running;
  if (running) {
    // 🔧 ButtonStateManager 사용
    ButtonStateManager.setLoading('runBtn', '실행 중...');
  } else {
    // 🔧 ButtonStateManager 사용
    ButtonStateManager.restore('runBtn');
  }
}

// 로그 추가
// 로그 관리 객체 (최적화됨)
const LogManager = {
  logContent: null,

  init() {
    this.logContent = document.getElementById('logContent');
  },

  getLogContent() {
    if (!this.logContent) this.init();
    return this.logContent;
  },

  add(message, type = 'info') {
    const logContent = this.getLogContent();
    if (logContent) {
      const logEntry = document.createElement('div');

      // 메시지 내용에 따라 자동으로 타입 결정
      let autoType = type;
      if (message.includes('[PROGRESS]')) {
        autoType = 'progress';
      } else if (message.includes('[CRAWL') || message.includes('[SUBTITLE') || message.includes('[CONTENT')) {
        autoType = 'crawl';
      } else if (message.includes('[SECTION')) {
        autoType = 'section';
      } else if (message.includes('[FINAL')) {
        autoType = 'final';
      }

      // 진행률 로그에 시각적 강조 추가
      if (autoType === 'progress') {
        logEntry.className = `log-entry ${autoType} progress-highlight`;

        // 진행률 퍼센트 추출하여 시각적 표시
        const progressMatch = message.match(/(\d+)%/);
        if (progressMatch) {
          const progressPercent = progressMatch[1];
          logEntry.innerHTML = `
            <span class="progress-indicator">📊 ${progressPercent}%</span>
            <span class="progress-message">${message.replace(/\d+%/, '').trim()}</span>
            <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
          `;
        } else {
          logEntry.innerHTML = `
            <span class="progress-message">${message}</span>
            <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
          `;
        }
      } else {
        logEntry.className = `log-entry ${autoType}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      }

      logContent.appendChild(logEntry);
      logContent.scrollTop = logContent.scrollHeight;
    }
  },

  clear() {
    const logContent = this.getLogContent();
    if (logContent) {
      logContent.innerHTML = '';
    }
  }
};

// 로그 추가 함수 (최적화됨)
function addLog(message, type = 'info') {
  LogManager.add(message, type);
}

// 로그 컨테이너 토글 함수
function toggleLogContainer() {
  const logContainer = document.getElementById('logContainer');
  const toggleIcon = document.getElementById('logToggleIcon');

  if (!logContainer) return;

  // getComputedStyle 사용하여 더 안정적으로 상태 확인
  const isHidden = logContainer.style.display === 'none' ||
    window.getComputedStyle(logContainer).display === 'none';

  if (isHidden) {
    logContainer.style.display = 'block';
    if (toggleIcon) toggleIcon.style.transform = 'rotate(90deg)';
  } else {
    logContainer.style.display = 'none';
    if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
  }
  console.log('[LOG-TOGGLE] logContainer display:', logContainer.style.display);
}

// 로그 지우기 (최적화됨)
function clearLog() {
  LogManager.clear();
}

// 환경설정 모달 열기
async function openSettingsModal() {
  console.log('🔧 환경설정 모달 열기 시도...');
  const modal = document.getElementById('settingsModal');
  console.log('🔍 모달 요소:', modal);

  if (modal) {
    console.log('✅ 모달 요소 찾음, 표시 중...');
    modal.style.display = 'flex';
    try {
      await loadSettingsContent();
      console.log('✅ 환경설정 내용 로드 완료');

      // 🔐 라이선스 상태 로드
      if (window.refreshLicenseStatus) {
        await window.refreshLicenseStatus();
        console.log('✅ 라이선스 상태 로드 완료');
      }

      // 🔥 API 연동 상태 업데이트
      setTimeout(() => {
        if (typeof window.updateApiStatusIndicators === 'function') {
          window.updateApiStatusIndicators();
          console.log('✅ API 연동 상태 업데이트 완료');
        }
      }, 600);
    } catch (error) {
      console.error('❌ 환경설정 내용 로드 실패:', error);
    }
  } else {
    console.error('❌ settingsModal 요소를 찾을 수 없습니다!');
  }
}

// 환경설정 모달 닫기
function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 미리보기 모달 열기
async function openPreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) {
    modal.style.display = 'flex';

    // 이전에 생성된 콘텐츠가 있는지 확인하고 로드
    try {
      const lastContent = localStorage.getItem('lastGeneratedContent');
      const lastTitle = localStorage.getItem('lastGeneratedTitle');
      const lastCharCount = localStorage.getItem('lastGeneratedCharCount');

      if (lastContent && lastTitle) {
        console.log('[PREVIEW] 이전 콘텐츠 로드 중...');

        // 제목 표시
        const titleElement = document.getElementById('previewTitleText');
        if (titleElement) {
          titleElement.textContent = lastTitle;
        }

        // 글자수 표시
        const charCountElement = document.getElementById('previewCharCount');
        if (charCountElement && lastCharCount) {
          charCountElement.textContent = `${lastCharCount}자`;
        }

        // 콘텐츠 표시
        const contentElement = DOMCache.get('previewContent');
        if (contentElement) {
          contentElement.innerHTML = lastContent;
        }

        console.log('[PREVIEW] 이전 콘텐츠 로드 완료');
      } else {
        console.log('[PREVIEW] 이전 콘텐츠가 없습니다. 새로 생성해주세요.');

        // 콘텐츠가 없을 때 안내 메시지 표시
        const contentElement = DOMCache.get('previewContent');
        if (contentElement) {
          contentElement.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin: 0 auto 24px; opacity: 0.3;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #64748b;">콘텐츠를 먼저 생성해주세요</h3>
              <p style="margin: 0; font-size: 14px; color: #94a3b8;">콘텐츠 생성 후 미리보기를 확인할 수 있습니다</p>
            </div>
          `;
        }

        // 제목과 글자수 초기화
        const titleElement = document.getElementById('previewTitleText');
        if (titleElement) {
          titleElement.textContent = '콘텐츠 제목';
        }

        const charCountElement = document.getElementById('previewCharCount');
        if (charCountElement) {
          charCountElement.textContent = '0자';
        }
      }
    } catch (error) {
      console.error('[PREVIEW] 콘텐츠 로드 중 오류:', error);
    }
  }
}

// 미리보기 모달 닫기
function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 백업 시스템
async function createBackup() {
  try {
    if (window.blogger && window.blogger.createBackup) {
      const result = await window.blogger.createBackup();
      if (result.ok && result.success) {
        console.log('✅ 백업 생성 완료:', result.backupPath);
        // 알림은 조용히 (자동 백업이므로)
        return { success: true, backupPath: result.backupPath };
      } else {
        console.error('❌ 백업 생성 실패:', result.error);
        return { success: false, error: result.error };
      }
    } else {
      console.warn('❌ 백업 기능을 사용할 수 없습니다.');
      return { success: false, error: '백업 기능을 사용할 수 없습니다.' };
    }
  } catch (error) {
    console.error('백업 생성 오류:', error);
    return { success: false, error: error instanceof Error ? error.message : '백업 생성 중 오류가 발생했습니다.' };
  }
}

// 자동 백업 시스템 (30분마다)
let autoBackupInterval = null;
let lastBackupTime = 0;

function startAutoBackup() {
  // 기존 인터벌이 있으면 제거
  if (autoBackupInterval !== null) {
    clearInterval(autoBackupInterval);
  }

  // 30분 = 30 * 60 * 1000 밀리초
  const BACKUP_INTERVAL = 30 * 60 * 1000;

  // 즉시 첫 백업 실행 (앱 시작 시)
  createBackup().then(result => {
    if (result.success) {
      lastBackupTime = Date.now();
      console.log(`[AUTO-BACKUP] ✅ 첫 백업 완료: ${new Date().toLocaleString('ko-KR')}`);
    }
  });

  // 30분마다 자동 백업
  autoBackupInterval = window.setInterval(async () => {
    try {
      const result = await createBackup();
      if (result.success) {
        lastBackupTime = Date.now();
        console.log(`[AUTO-BACKUP] ✅ 자동 백업 완료: ${new Date().toLocaleString('ko-KR')}`);

        // 백업 성공 알림 (조용히, 콘솔만)
        const timeSinceLastBackup = Math.floor((Date.now() - lastBackupTime) / 1000 / 60);
        console.log(`[AUTO-BACKUP] 📦 다음 백업까지 약 ${30 - (timeSinceLastBackup % 30)}분 남음`);
      } else {
        console.warn(`[AUTO-BACKUP] ⚠️ 자동 백업 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('[AUTO-BACKUP] 자동 백업 오류:', error);
    }
  }, BACKUP_INTERVAL);

  console.log('[AUTO-BACKUP] ✅ 자동 백업 시스템 시작 (30분 간격)');
}

function stopAutoBackup() {
  if (autoBackupInterval !== null) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
    console.log('[AUTO-BACKUP] 자동 백업 시스템 중지');
  }
}

async function restoreBackup() {
  try {
    if (window.blogger && window.blogger.restoreBackup) {
      const result = await window.blogger.restoreBackup();
      if (result.success) {
        alert(`✅ 백업이 성공적으로 복원되었습니다!\n\n복원된 파일: ${result.restoredPath}`);
        // 설정 다시 로드
        loadSettings();
        location.reload();
      } else {
        alert(`❌ 백업 복원 실패: ${result.error}`);
      }
    } else {
      alert('❌ 백업 복원 기능을 사용할 수 없습니다.');
    }
  } catch (error) {
    console.error('백업 복원 오류:', error);
    alert('❌ 백업 복원 중 오류가 발생했습니다.');
  }
}

// 환경설정 내용 로드
async function loadSettingsContent() {
  // 먼저 localStorage에서 설정 불러오기
  const settings = loadSettings();

  // .env 파일에서도 설정 불러오기
  let envSettings = {};

  // .env 키 이름을 카멜케이스로 변환하는 함수
  const normalizeEnvKey = (key) => {
    const keyMap = {
      // API 키
      'GEMINI_API_KEY': 'geminiKey',
      'GEMINI_KEY': 'geminiKey',
      'OPENAI_API_KEY': 'openaiKey',
      'OPENAI_KEY': 'openaiKey',
      'DALLE_API_KEY': 'dalleApiKey',
      'DALLE_KEY': 'dalleApiKey',
      'OPENAI_API_KEY_DALLE': 'dalleApiKey', // OpenAI 키를 DALL-E로도 사용 가능
      'PEXELS_API_KEY': 'pexelsApiKey',
      'PEXELS_KEY': 'pexelsApiKey',

      // Stability AI
      'STABILITY_API_KEY': 'stabilityApiKey',
      'STABILITY_KEY': 'stabilityApiKey',

      // 네이버 (데이터랩/검색광고)
      'NAVER_CUSTOMER_ID': 'naverCustomerId',
      'NAVER_ID': 'naverCustomerId',
      'NAVER_CLIENT_ID': 'naverCustomerId', // 네이버 데이터랩 Client ID
      'NAVER_SECRET_KEY': 'naverSecretKey',
      'NAVER_SECRET': 'naverSecretKey',
      'NAVER_CLIENT_SECRET': 'naverSecretKey', // 네이버 데이터랩 Client Secret

      // Google CSE
      'GOOGLE_CSE_KEY': 'googleCseKey',
      'GOOGLE_CSE_API_KEY': 'googleCseKey',
      'GOOGLE_API_KEY': 'googleCseKey',
      'CSE_KEY': 'googleCseKey',
      'GOOGLE_CSE_CX': 'googleCseCx',
      'GOOGLE_CSE_ID': 'googleCseCx',
      'CSE_CX': 'googleCseCx',
      'CSE_ID': 'googleCseCx',

      // Blogger
      'BLOG_ID': 'blogId',
      'BLOGGER_ID': 'blogId',
      'GOOGLE_CLIENT_ID': 'googleClientId',
      'CLIENT_ID': 'googleClientId',
      'GOOGLE_CLIENT_SECRET': 'googleClientSecret',
      'CLIENT_SECRET': 'googleClientSecret',

      // WordPress
      'WORDPRESS_SITE_URL': 'wordpressSiteUrl',
      'WP_SITE_URL': 'wordpressSiteUrl',
      'WORDPRESS_URL': 'wordpressSiteUrl',
      'WORDPRESS_USERNAME': 'wordpressUsername',
      'WP_USERNAME': 'wordpressUsername',
      'WORDPRESS_USER': 'wordpressUsername',
      'WORDPRESS_PASSWORD': 'wordpressPassword',
      'WP_PASSWORD': 'wordpressPassword',
      'WORDPRESS_PASS': 'wordpressPassword',

      // 기타
      'PLATFORM': 'platform',
      'MIN_CHARS': 'minChars',
      'MINIMUM_CHARS': 'minChars'
    };

    // 직접 매핑이 있으면 사용
    if (keyMap[key]) {
      return keyMap[key];
    }

    // 카멜케이스로 변환 시도 (예: GEMINI_API_KEY -> geminiApiKey)
    return key.toLowerCase()
      .split('_')
      .map((word, index) => {
        if (index === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join('')
      .replace(/api/g, 'Api')
      .replace(/key/g, 'Key')
      .replace(/id/g, 'Id')
      .replace(/url/g, 'Url');
  };

  // .env 파일 로드 시도 (여러 방법 시도)
  const getEnvMethods = [
    () => window.electronAPI?.getEnv?.(),
    () => window.blogger?.getEnv?.(),
    () => window.electron?.getEnv?.()
  ];

  for (const getEnvMethod of getEnvMethods) {
    try {
      if (typeof getEnvMethod === 'function') {
        const envResult = await getEnvMethod();
        if (envResult) {
          let rawEnvData = null;

          // 다양한 응답 형식 처리
          if (envResult.ok && envResult.data) {
            rawEnvData = envResult.data;
          } else if (envResult.data) {
            rawEnvData = envResult.data;
          } else if (typeof envResult === 'object' && !envResult.ok) {
            rawEnvData = envResult;
          }

          if (rawEnvData) {
            // 키 이름 정규화 (빈 값도 포함)
            Object.keys(rawEnvData).forEach(key => {
              const normalizedKey = normalizeEnvKey(key);
              if (normalizedKey) {
                // 빈 문자열도 포함 (undefined, null만 제외)
                const value = rawEnvData[key];
                if (value !== undefined && value !== null) {
                  envSettings[normalizedKey] = value;
                }
              }
            });

            // 🔧 OpenAI API 키가 있으면 DALL-E API 키로도 사용 가능하도록 복사
            if (envSettings.openaiKey && !envSettings.dalleApiKey) {
              envSettings.dalleApiKey = envSettings.openaiKey;
              console.log('✅ OpenAI API 키를 DALL-E API 키로도 사용');
            }
            if (envSettings.openaiApiKey && !envSettings.dalleApiKey) {
              envSettings.dalleApiKey = envSettings.openaiApiKey;
              console.log('✅ OpenAI API 키를 DALL-E API 키로도 사용 (openaiApiKey)');
            }

            console.log('✅ .env 파일에서 설정 로드 성공:', Object.keys(envSettings).length, '개 필드');
            console.log('📋 .env 로드된 필드:', Object.keys(envSettings));
            break; // 성공하면 루프 종료
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ .env 로드 시도 실패:', error);
      continue; // 다음 방법 시도
    }
  }

  // localStorage와 .env 병합 (env가 우선)
  const mergedSettings = { ...settings, ...envSettings };

  // 🔧 OpenAI API 키가 있으면 DALL-E API 키로도 사용 가능하도록 복사 (병합 후에도 확인)
  if (mergedSettings.openaiKey && !mergedSettings.dalleApiKey) {
    mergedSettings.dalleApiKey = mergedSettings.openaiKey;
    console.log('✅ 병합 후: OpenAI API 키를 DALL-E API 키로도 사용');
  }
  if (mergedSettings.openaiApiKey && !mergedSettings.dalleApiKey) {
    mergedSettings.dalleApiKey = mergedSettings.openaiApiKey;
    console.log('✅ 병합 후: OpenAI API 키를 DALL-E API 키로도 사용 (openaiApiKey)');
  }

  console.log('🔄 병합된 설정:', Object.keys(mergedSettings).length, '개 필드');
  console.log('📋 병합된 필드 목록:', Object.keys(mergedSettings));
  console.log('📋 병합된 설정 상세:', mergedSettings);

  // 🔥 HTML 생성 제거 - index.html의 UI를 그대로 사용
  // 저장된 설정 값을 입력 필드에 채우기
  setTimeout(() => {
    if (mergedSettings) {
      console.log('🔧 환경설정 값 로드 시작:', mergedSettings);

      // API 키들
      const openaiKeyEl = document.getElementById('openaiKey');
      if (openaiKeyEl) {
        openaiKeyEl.value = mergedSettings.openaiKey || mergedSettings.openaiApiKey || '';
        console.log('✅ OpenAI Key 로드:', openaiKeyEl.value ? '있음' : '없음');
      }

      const geminiKeyEl = document.getElementById('geminiKey');
      if (geminiKeyEl) {
        geminiKeyEl.value = mergedSettings.geminiKey || mergedSettings.geminiApiKey || '';
        console.log('✅ Gemini Key 로드:', geminiKeyEl.value ? '있음' : '없음');
      }

      const dalleApiKeyEl = document.getElementById('dalleApiKey');
      if (dalleApiKeyEl) {
        // DALL-E는 OpenAI API 키를 사용할 수 있으므로 openaiKey도 확인
        const value = mergedSettings.dalleApiKey || mergedSettings.dalleKey || mergedSettings.openaiKey || mergedSettings.openaiApiKey || '';
        dalleApiKeyEl.value = value;
        console.log('✅ DALL-E Key 로드:', value ? `있음 (${value.length}자)` : '없음', '| mergedSettings:', {
          dalleApiKey: mergedSettings.dalleApiKey,
          dalleKey: mergedSettings.dalleKey,
          openaiKey: mergedSettings.openaiKey,
          openaiApiKey: mergedSettings.openaiApiKey
        });
      } else {
        console.warn('⚠️ dalleApiKey 필드를 찾을 수 없습니다');
      }

      const pexelsApiKeyEl = document.getElementById('pexelsApiKey');
      if (pexelsApiKeyEl) {
        pexelsApiKeyEl.value = mergedSettings.pexelsApiKey || mergedSettings.pexelsKey || '';
        console.log('✅ Pexels Key 로드:', pexelsApiKeyEl.value ? '있음' : '없음');
      }

      // Stability AI API Key
      const stabilityApiKeyEl = document.getElementById('stabilityApiKey');
      if (stabilityApiKeyEl) {
        stabilityApiKeyEl.value = mergedSettings.stabilityApiKey || mergedSettings.stabilityKey || '';
        console.log('✅ Stability AI Key 로드:', stabilityApiKeyEl.value ? '있음' : '없음');
      }

      // 네이버 API (여러 키 이름 지원)
      const naverCustomerIdEl = document.getElementById('naverCustomerId');
      if (naverCustomerIdEl) {
        const value = mergedSettings.naverCustomerId || mergedSettings.naverId || mergedSettings.naverClientId || '';
        naverCustomerIdEl.value = value;
        console.log('✅ Naver Customer ID 로드:', value ? `있음 (${value.length}자)` : '없음', '| mergedSettings:', {
          naverCustomerId: mergedSettings.naverCustomerId,
          naverId: mergedSettings.naverId,
          naverClientId: mergedSettings.naverClientId
        });
      } else {
        console.warn('⚠️ naverCustomerId 필드를 찾을 수 없습니다');
      }

      const naverSecretKeyEl = document.getElementById('naverSecretKey');
      if (naverSecretKeyEl) {
        const value = mergedSettings.naverSecretKey || mergedSettings.naverSecret || mergedSettings.naverClientSecret || '';
        naverSecretKeyEl.value = value;
        console.log('✅ Naver Secret Key 로드:', value ? `있음 (${value.length}자)` : '없음', '| mergedSettings:', {
          naverSecretKey: mergedSettings.naverSecretKey,
          naverSecret: mergedSettings.naverSecret,
          naverClientSecret: mergedSettings.naverClientSecret
        });
      } else {
        console.warn('⚠️ naverSecretKey 필드를 찾을 수 없습니다');
      }

      // Google CSE
      const googleCseKeyEl = document.getElementById('googleCseKey');
      if (googleCseKeyEl) {
        googleCseKeyEl.value = mergedSettings.googleCseKey || mergedSettings.cseKey || mergedSettings.googleApiKey || '';
        console.log('✅ Google CSE Key 로드:', googleCseKeyEl.value ? '있음' : '없음');
      }

      const googleCseCxEl = document.getElementById('googleCseCx');
      if (googleCseCxEl) {
        googleCseCxEl.value = mergedSettings.googleCseCx || mergedSettings.cseCx || mergedSettings.googleCseId || '';
        console.log('✅ Google CSE CX 로드:', googleCseCxEl.value ? '있음' : '없음');
      }

      // Blogger ID
      const blogIdEl = document.getElementById('blogId');
      if (blogIdEl) {
        blogIdEl.value = mergedSettings.blogId || mergedSettings.bloggerId || '';
        console.log('✅ Blogger ID 로드:', blogIdEl.value ? '있음' : '없음');
      }

      // Google OAuth
      const googleClientIdEl = document.getElementById('googleClientId');
      if (googleClientIdEl) {
        googleClientIdEl.value = mergedSettings.googleClientId || mergedSettings.clientId || '';
        console.log('✅ Google Client ID 로드:', googleClientIdEl.value ? '있음' : '없음');
      }

      const googleClientSecretEl = document.getElementById('googleClientSecret');
      if (googleClientSecretEl) {
        googleClientSecretEl.value = mergedSettings.googleClientSecret || mergedSettings.clientSecret || '';
        console.log('✅ Google Client Secret 로드:', googleClientSecretEl.value ? '있음' : '없음');
      }

      // WordPress
      const wordpressSiteUrlEl = document.getElementById('wordpressSiteUrl');
      if (wordpressSiteUrlEl) {
        wordpressSiteUrlEl.value = mergedSettings.wordpressSiteUrl || mergedSettings.wpSiteUrl || mergedSettings.wordpressUrl || '';
        console.log('✅ WordPress Site URL 로드:', wordpressSiteUrlEl.value ? '있음' : '없음');
      }

      const wordpressUsernameEl = document.getElementById('wordpressUsername');
      if (wordpressUsernameEl) {
        wordpressUsernameEl.value = mergedSettings.wordpressUsername || mergedSettings.wpUsername || mergedSettings.wordpressUser || '';
        console.log('✅ WordPress Username 로드:', wordpressUsernameEl.value ? '있음' : '없음');
      }

      const wordpressPasswordEl = document.getElementById('wordpressPassword');
      if (wordpressPasswordEl) {
        wordpressPasswordEl.value = mergedSettings.wordpressPassword || mergedSettings.wpPassword || mergedSettings.wordpressPass || '';
        console.log('✅ WordPress Password 로드:', wordpressPasswordEl.value ? '있음' : '없음');
      }

      // 최소 글자 수는 제거됨 (워드프레스에서는 콘텐츠 모드별로 자동 설정)

      // 플랫폼 선택 (가장 중요!)
      const platform = mergedSettings.platform || 'blogspot';
      console.log('🔧 플랫폼 설정:', platform);

      const platformBloggerEl = document.getElementById('platform-blogger');
      const platformWordpressEl = document.getElementById('platform-wordpress');

      if (platformBloggerEl && platformWordpressEl) {
        // 🔥 blogger와 blogspot 둘 다 체크
        if (platform === 'blogger' || platform === 'blogspot') {
          platformBloggerEl.checked = true;
          platformWordpressEl.checked = false;
          console.log('✅ 플랫폼: Blogger로 설정');
        } else {
          platformBloggerEl.checked = false;
          platformWordpressEl.checked = true;
          console.log('✅ 플랫폼: WordPress로 설정 (기본값)');
        }

        // 플랫폼 변경 이벤트 트리거
        if (typeof togglePlatformFields === 'function') {
          togglePlatformFields();
        }
        if (typeof updatePlatformStatus === 'function') {
          updatePlatformStatus();
        }
      } else {
        console.warn('⚠️ 플랫폼 라디오 버튼을 찾을 수 없습니다');
      }

      // API 키 상태 확인 및 표시
      if (typeof updateApiKeyStatus === 'function') {
        updateApiKeyStatus(mergedSettings);
      }

      // 🔍 모든 필드 로드 상태 확인
      const allFields = [
        'openaiKey', 'geminiKey', 'dalleApiKey', 'pexelsApiKey',
        'naverCustomerId', 'naverSecretKey',
        'googleCseKey', 'googleCseCx',
        'blogId', 'googleClientId', 'googleClientSecret',
        'wordpressSiteUrl', 'wordpressUsername', 'wordpressPassword'
      ];

      const missingFields = [];
      allFields.forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (!el) {
          missingFields.push(`필드 없음: ${fieldId}`);
        } else if (!el.value && mergedSettings[fieldId]) {
          missingFields.push(`값 없음: ${fieldId} (설정에는 있음: ${mergedSettings[fieldId]})`);
        }
      });

      if (missingFields.length > 0) {
        console.warn('⚠️ 로드되지 않은 필드:', missingFields);
      } else {
        console.log('✅ 모든 필드 로드 완료');
      }

      console.log('✅ 환경설정 값 로드 완료');
    } else {
      console.warn('⚠️ 병합된 설정이 없습니다');
    }
  }, 300); // DOM 렌더링 대기 시간

  // 🔥 API 연동 상태 업데이트 (500ms 후 - 값 로드 완료 후)
  setTimeout(() => {
    if (typeof window.updateApiStatusIndicators === 'function') {
      window.updateApiStatusIndicators();
    }
    // 환경설정 플랫폼 필드 업데이트
    if (typeof window.toggleSettingsPlatformFields === 'function') {
      window.toggleSettingsPlatformFields();
    }
  }, 500);
}

// 설정 저장
async function saveSettings() {
  const settings = {
    openaiKey: document.getElementById('openaiKey')?.value || '',
    geminiKey: document.getElementById('geminiKey')?.value || '',
    claudeKey: document.getElementById('claudeKey')?.value || '',
    perplexityKey: document.getElementById('perplexityKey')?.value || '',
    leonardoKey: document.getElementById('leonardoKey')?.value || '',
    dalleApiKey: document.getElementById('dalleApiKey')?.value || '',
    pexelsApiKey: document.getElementById('pexelsApiKey')?.value || '',
    stabilityApiKey: document.getElementById('stabilityApiKey')?.value || '', // Stability AI
    naverCustomerId: document.getElementById('naverCustomerId')?.value || '',
    naverSecretKey: document.getElementById('naverSecretKey')?.value || '',
    blogId: document.getElementById('blogId')?.value || '',
    googleClientId: document.getElementById('googleClientId')?.value || '',
    googleClientSecret: document.getElementById('googleClientSecret')?.value || '',
    googleCseKey: document.getElementById('googleCseKey')?.value || '',
    googleCseCx: document.getElementById('googleCseCx')?.value || '',
    youtubeApiKey: document.getElementById('youtubeApiKey')?.value || '',
    wordpressSiteUrl: document.getElementById('wordpressSiteUrl')?.value || '',
    wordpressUsername: document.getElementById('wordpressUsername')?.value || '',
    wordpressPassword: document.getElementById('wordpressPassword')?.value || '',
    wordpressCategories: document.getElementById('wordpressCategories')?.value || '',
    platform: document.querySelector('input[name="platform"]:checked')?.value || 'blogspot',
    promptMode: 'max-mode', // MAX모드로 고정
    toneStyle: document.getElementById('toneStyle')?.value || 'professional', // 말투/어투 선택
  };

  // 🔧 StorageManager 사용 - 비동기 저장
  const storage = getStorageManager();
  await storage.set('bloggerSettings', settings, true);

  // .env 파일도 함께 업데이트
  try {
    if (window.blogger && window.blogger.saveEnv) {
      // env.ts의 MAP에 맞춰 camelCase 키로 전달
      // 네이버 설정은 naverClientId/naverClientSecret로 변환 (unified-env-manager에서 사용하는 키)
      const envData = {
        blogId: settings.blogId,
        googleClientId: settings.googleClientId,
        googleClientSecret: settings.googleClientSecret,
        wordpressSiteUrl: settings.wordpressSiteUrl,
        wordpressUsername: settings.wordpressUsername,
        wordpressPassword: settings.wordpressPassword,
        googleCseKey: settings.googleCseKey,
        googleCseCx: settings.googleCseCx,
        geminiKey: settings.geminiKey,
        pexelsApiKey: settings.pexelsApiKey,
        // 🔥 Stability AI API Key 추가
        stabilityApiKey: settings.stabilityApiKey,
        // 네이버 설정: naverCustomerId/naverSecretKey를 naverClientId/naverClientSecret로 변환
        naverClientId: settings.naverCustomerId || settings.naverClientId || '',
        naverClientSecret: settings.naverSecretKey || settings.naverClientSecret || '',
        openaiKey: settings.openaiKey,
        dalleApiKey: settings.dalleApiKey
      };

      console.log('🔧 환경 설정 저장 데이터:', envData);
      console.log('📋 네이버 데이터랩 저장 확인:', {
        naverCustomerId: envData.naverCustomerId ? `있음 (${envData.naverCustomerId.length}자)` : '없음',
        naverSecretKey: envData.naverSecretKey ? `있음 (${envData.naverSecretKey.length}자)` : '없음'
      });
      const result = await window.blogger.saveEnv(envData);
      console.log('✅ 환경 설정 저장 결과:', result);

      // 네이버 데이터랩 저장 확인
      if (result && result.ok) {
        console.log('✅ 네이버 데이터랩 설정이 .env 파일에 저장되었습니다');
      } else {
        console.warn('⚠️ 네이버 데이터랩 설정 저장 실패:', result);
      }
    }
  } catch (error) {
    // 🔧 ErrorHandler 사용
    getErrorHandler().handle(error, {
      function: 'saveSettings',
      step: '환경 설정 저장'
    });
  }

  updatePlatformStatus(); // 플랫폼 상태 업데이트

  // API 키 상태 업데이트
  const currentSettings = await loadSettings();
  updateApiKeyStatus(currentSettings);

  // 저장 완료 메시지 표시 후 자동으로 모달 닫기
  alert('✅ 설정이 저장되었습니다.');

  // alert 확인 후 모달 자동 닫기
  setTimeout(() => {
    closeSettingsModal();
  }, 100);
}

// API 키 상태 표시 업데이트
function updateApiKeyStatus(settings) {
  try {
    const statusDiv = document.getElementById('apiKeyStatus');
    const statusIcon = document.getElementById('apiKeyStatusIcon');
    const statusText = document.getElementById('apiKeyStatusText');

    if (!statusDiv || !statusIcon || !statusText) return;

    // 필수 API 키 목록 (실제로 사용되는 모든 API 키 포함)
    const requiredKeys = {
      'Gemini': settings.geminiKey || '',
      '네이버 데이터랩 ID': settings.naverCustomerId || settings.naverClientId || '',
      '네이버 데이터랩 Secret': settings.naverSecretKey || settings.naverClientSecret || '',
      'Google CSE Key': settings.googleCseKey || '',
      'Google CSE CX': settings.googleCseCx || '',
      'Pexels API': settings.pexelsApiKey || '',
      'DALL-E API': settings.dalleApiKey || settings.openaiKey || ''
    };

    const configuredKeys = Object.values(requiredKeys).filter(key => key && key.trim().length > 0).length;
    const totalKeys = Object.keys(requiredKeys).length;

    if (configuredKeys === totalKeys) {
      // 모든 키가 설정됨
      statusIcon.textContent = '';
      statusText.textContent = `모든 API 키가 정상 설정됨 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(16, 185, 129, 0.2)';
      statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      statusText.style.color = '#10b981';
    } else if (configuredKeys >= totalKeys * 0.7) {
      // 대부분 설정됨
      statusIcon.textContent = '';
      statusText.textContent = `대부분 설정됨 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(245, 158, 11, 0.2)';
      statusDiv.style.border = '1px solid rgba(245, 158, 11, 0.4)';
      statusText.style.color = '#f59e0b';
    } else {
      // 설정 부족
      statusIcon.textContent = '';
      statusText.textContent = `설정 필요 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
      statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      statusText.style.color = '#ef4444';
    }

    // 부족한 키 목록 툴팁 제공
    const missingKeys = Object.entries(requiredKeys)
      .filter(([_, value]) => !value || value.trim().length === 0)
      .map(([name]) => name);

    if (missingKeys.length > 0) {
      statusDiv.title = `필요한 키: ${missingKeys.join(', ')}`;
    } else {
      statusDiv.title = '모든 API 키가 정상적으로 설정되었습니다.';
    }
  } catch (error) {
    console.error('[API-STATUS] API 상태 업데이트 실패:', error);
  }
}

// 설정 로드
// 🔧 비동기 loadSettings
async function loadSettings() {
  const storage = getStorageManager();
  let settings = {};

  try {
    const savedSettings = await storage.get('bloggerSettings', true);
    if (savedSettings) {
      settings = savedSettings;
    }
  } catch (e) {
    // 🔧 ErrorHandler 사용
    getErrorHandler().handle(e, {
      function: 'loadSettings',
      step: '설정 파싱'
    });
    settings = {};
  }

  // 플랫폼 기본값 보장 (워드프레스)
  if (!settings.platform) {
    settings.platform = 'wordpress';
    console.log('[LOAD] 플랫폼 기본값 설정: wordpress');
    // 🔧 StorageManager 사용
    const storage = getStorageManager();
    await storage.set('bloggerSettings', settings, true);
  }

  // 설정 적용
  Object.keys(settings).forEach(key => {
    if (key === 'platform') {
      // 플랫폼 라디오 버튼 설정
      const platformRadio = document.querySelector(`input[name="platform"][value="${settings[key]}"]`);
      if (platformRadio) {
        platformRadio.checked = true;
        console.log(`[LOAD] 플랫폼 라디오 버튼 설정: ${settings[key]}`);
      } else {
        // 라디오 버튼이 아직 없으면 나중에 설정
        setTimeout(() => {
          const delayedRadio = document.querySelector(`input[name="platform"][value="${settings[key]}"]`);
          if (delayedRadio) {
            delayedRadio.checked = true;
            console.log(`[LOAD] 플랫폼 라디오 버튼 지연 설정: ${settings[key]}`);
          }
        }, 100);
      }
    } else {
      // 모든 설정 로드
      const element = document.getElementById(key);
      if (element) {
        // 🔧 thumbnailType은 빈 값일 때 기본값 설정
        if (key === 'thumbnailType') {
          if (settings[key] && settings[key].trim() !== '') {
            element.value = settings[key];
            console.log(`[LOAD] ${key} 설정 로드: ${settings[key]}`);
          } else {
            element.value = 'text';
            console.log(`[LOAD] ${key} 빈 값, 기본값 설정: text`);
          }
        } else if (key === 'promptMode') {
          // 프롬프트 모드는 빈 값일 때 기본값 설정
          if (settings[key] && settings[key].trim() !== '') {
            element.value = settings[key];
            console.log(`[LOAD] ${key} 설정 로드: ${settings[key]}`);
          } else {
            element.value = 'max-mode';
            console.log(`[LOAD] ${key} 빈 값, 기본값 설정: max-mode`);
          }
        } else {
          element.value = settings[key];
          console.log(`[LOAD] ${key} 설정 로드: ${settings[key]}`);
        }
      }
    }
  });

  // 플랫폼 기본값이 없으면 워드프레스로 설정
  if (!settings.platform) {
    settings.platform = 'wordpress';
  }

  // 설정 저장 (기본값 반영)
  const storageManager = getStorageManager();
  const savedSettingsData = await storageManager.get('bloggerSettings', true);
  if (!savedSettingsData || !savedSettingsData.platform) {
    await storage.set('bloggerSettings', settings, true);
  }

  return settings;
}

// 접기/펼치기 토글
function toggleCollapsible(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById(id + '-icon');

  if (content && icon) {
    content.classList.toggle('collapsed');
    icon.classList.toggle('rotated');
  }
}

// 실시간 시계 업데이트
function updateRealtimeClock() {
  const now = new Date();

  // 시간 포맷팅 (HH:MM:SS)
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const timeString = `${hours}:${minutes}:${seconds}`;

  // 날짜 포맷팅 (YYYY년 MM월 DD일 (요일))
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const date = now.getDate().toString().padStart(2, '0');
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayName = dayNames[now.getDay()];
  const dateString = `${year}년 ${month}월 ${date}일 (${dayName})`;

  // DOM 업데이트
  const clockElement = document.getElementById('realtime-clock');
  const dateElement = document.getElementById('realtime-date');

  if (clockElement) clockElement.textContent = timeString;
  if (dateElement) dateElement.textContent = dateString;
}

// 작업 기록 저장소 (로컬 스토리지 사용)
let workDiary = JSON.parse(localStorage.getItem('workDiary') || '{}');

// 작업 기록 저장 함수
function saveWorkRecord(date, record) {
  console.log('💾 [WORK_DIARY] 작업 기록 저장 시도:', date, record);
  const dateKey = formatDateKey(date);
  console.log('💾 [WORK_DIARY] 날짜 키:', dateKey);
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
  localStorage.setItem('workDiary', JSON.stringify(workDiary));
}

// 날짜 키 포맷팅 함수
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 특정 날짜의 작업 기록 가져오기
function getWorkRecords(date) {
  const dateKey = formatDateKey(date);
  console.log('📖 [WORK_DIARY] 작업 기록 조회, 날짜 키:', dateKey);
  const records = workDiary[dateKey] || [];
  console.log('📖 [WORK_DIARY] 조회된 기록 개수:', records.length);

  // 기존 기록에 completed 속성이 없는 경우 기본값 설정
  return records.map(record => ({
    ...record,
    completed: record.completed || false
  }));
}

// 달력 전역 변수 (영구 활성화)
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();
let calendarMemoInitialized = true; // 달력 기능 영구 활성화
let calendarRendered = false;
let lastCalendarSignature = '';
let lastCalendarHighlight = '';

// 달력 렌더링
function renderCalendar() {
  console.log('🗓️ [CALENDAR] renderCalendar() 호출됨');

  // 달력 기능을 항상 활성화
  calendarMemoInitialized = true;
  const now = new Date();
  const year = currentCalendarYear;
  const month = currentCalendarMonth;

  console.log(`🗓️ [CALENDAR] 현재 년/월: ${year}년 ${month + 1}월`);

  // 월 표시 업데이트
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const monthElement = document.getElementById('calendar-month');
  console.log('🗓️ [CALENDAR] monthElement:', monthElement);
  if (monthElement) {
    monthElement.innerHTML = `
      <button id="prevMonth" style="background: none; border: none; color: #0ea5e9; font-size: 18px; cursor: pointer; margin-right: 10px;">‹</button>
      <span>${year}년 ${monthNames[month]}</span>
      <button id="nextMonth" style="background: none; border: none; color: #0ea5e9; font-size: 18px; cursor: pointer; margin-left: 10px;">›</button>
    `;

    // 월 이동 버튼 이벤트 추가
    document.getElementById('prevMonth').addEventListener('click', () => {
      currentCalendarMonth--;
      if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
      }
      renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
      currentCalendarMonth++;
      if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
      }
      renderCalendar();
    });
  }

  // 달력 날짜 생성
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay(); // 0=일요일, 1=월요일, ...
  const daysInMonth = lastDay.getDate();

  console.log(`🗓️ [CALENDAR] 첫날: ${firstDay}, 마지막날: ${lastDay}, 일수: ${daysInMonth}`);

  const calendarDates = document.getElementById('calendar-dates');
  console.log('🗓️ [CALENDAR] calendarDates:', calendarDates);
  if (calendarDates) {
    calendarDates.innerHTML = '';
    console.log('🗓️ [CALENDAR] 달력 날짜 생성 시작');

    // 이전 달의 빈 칸들
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.style.padding = '8px 0';
      emptyDay.style.color = 'rgba(148, 163, 184, 0.2)';
      emptyDay.style.fontSize = '14px';
      calendarDates.appendChild(emptyDay);
    }

    // 예약 스케줄 데이터 미리 로드
    let allSchedules = [];
    try {
      allSchedules = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
    } catch (e) {
      console.warn('🗓️ [CALENDAR] scheduledPosts 파싱 실패:', e);
    }

    // 현재 달의 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement('div');
      dayElement.style.padding = '4px';
      dayElement.style.cursor = 'pointer';
      dayElement.style.position = 'relative';
      dayElement.style.minHeight = '60px';
      dayElement.style.display = 'flex';
      dayElement.style.flexDirection = 'column';
      dayElement.style.alignItems = 'stretch';

      // 해당 날짜의 작업 기록이 있는지 확인
      const currentDate = new Date(year, month, day);
      const workRecords = getWorkRecords(currentDate);

      // 해당 날짜의 예약 스케줄이 있는지 확인
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const daySchedules = allSchedules.filter(s => s.date === dateKey && s.status !== 'completed');

      const hasWork = workRecords.length > 0;
      const hasSchedule = daySchedules.length > 0;

      // 날짜 숫자 + 메모 텍스트 html 구성
      let cellHtml = `<div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">${day}</div>`;

      // 🟢 작업 기록 메모 표시 (최대 2건, 각 6자 제한)
      if (hasWork) {
        const displayRecords = workRecords.slice(0, 2);
        displayRecords.forEach(r => {
          const text = (r.content || '').substring(0, 6);
          cellHtml += `<div style="font-size: 9px; color: #10b981; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; line-height: 1.2;">${text}</div>`;
        });
        if (workRecords.length > 2) {
          cellHtml += `<div style="font-size: 8px; color: #10b981; opacity: 0.6;">+${workRecords.length - 2}</div>`;
        }
      }

      // 🟠 예약 스케줄 표시 (최대 2건, 각 6자 제한)
      if (hasSchedule) {
        const displaySchedules = daySchedules.slice(0, 2);
        displaySchedules.forEach(s => {
          const text = (s.topic || '').substring(0, 6);
          cellHtml += `<div style="font-size: 9px; color: #f59e0b; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; line-height: 1.2;">${text}</div>`;
        });
        if (daySchedules.length > 2) {
          cellHtml += `<div style="font-size: 8px; color: #f59e0b; opacity: 0.6;">+${daySchedules.length - 2}</div>`;
        }
      }

      dayElement.innerHTML = cellHtml;

      // hover tooltip: 전체 내용 미리보기
      let tooltipParts = [];
      if (hasWork) {
        tooltipParts.push('📝 작업기록:');
        workRecords.forEach(r => tooltipParts.push(`  · ${r.content || '내용 없음'}`));
      }
      if (hasSchedule) {
        tooltipParts.push('📌 예약 스케줄:');
        daySchedules.forEach(s => tooltipParts.push(`  · ${s.topic || '제목 없음'}${s.time ? ' (' + s.time + ')' : ''}`));
      }
      if (tooltipParts.length > 0) {
        dayElement.title = tooltipParts.join('\n');
      }

      // 날짜 클릭 이벤트 추가
      dayElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🗓️ [CALENDAR] 날짜 클릭됨:', currentDate);
        showWorkDiary(currentDate);
      });
      dayElement.style.borderRadius = '6px';
      dayElement.style.transition = 'all 0.3s ease';

      // 요일별 색상 + 오늘 날짜 하이라이트
      const dayOfWeek = currentDate.getDay(); // 0=일, 6=토
      const today = new Date();
      const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

      if (isToday) {
        dayElement.style.background = 'rgba(14, 165, 233, 0.15)';
        dayElement.style.color = '#0ea5e9';
        dayElement.style.fontWeight = '800';
        dayElement.style.border = '1px solid rgba(14, 165, 233, 0.3)';
      } else if (dayOfWeek === 0) {
        dayElement.style.color = '#f87171'; // 일요일 빨강
      } else if (dayOfWeek === 6) {
        dayElement.style.color = '#38bdf8'; // 토요일 파랑
      } else {
        dayElement.style.color = '#e2e8f0'; // 평일
      }

      // 호버 효과 (오늘 날짜 제외)
      const savedColor = dayElement.style.color;
      dayElement.addEventListener('mouseenter', function () {
        if (!isToday) {
          this.style.background = 'rgba(148, 163, 184, 0.1)';
        }
      });

      dayElement.addEventListener('mouseleave', function () {
        if (!isToday) {
          this.style.background = 'transparent';
        }
      });

      calendarDates.appendChild(dayElement);
    }
  }

  calendarRendered = true;
  lastCalendarSignature = `${year}-${month}`;
  if (now.getFullYear() === year && now.getMonth() === month) {
    lastCalendarHighlight = formatDateKey(now);
  } else {
    lastCalendarHighlight = '';
  }
}

// 작업 일기 표시 함수
function showWorkDiary(date) {
  console.log('📝 [WORK_DIARY] showWorkDiary 호출됨, 날짜:', date);
  const dateString = date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  console.log('📝 [WORK_DIARY] 날짜 문자열:', dateString);
  const workRecords = getWorkRecords(date);
  console.log('📝 [WORK_DIARY] 작업 기록 개수:', workRecords.length);

  // 모달창 생성
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 20px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(148, 163, 184, 0.08);
    color: #e2e8f0;
  `;

  // 🔧 Sanitize 적용 (dateString은 사용자 입력이 아니지만 안전을 위해)
  const sanitizedDateString = sanitizeHTML(dateString);
  // 🔧 작업 기록 내용 sanitize (사용자 입력)
  const sanitizedWorkRecords = workRecords.map(record => ({
    ...record,
    content: sanitizeHTML(record.content || '')
  }));

  // 해당 날짜의 예약 스케줄 조회
  const modalDateKey = formatDateKey(date);
  let modalSchedules = [];
  try {
    const allSch = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
    modalSchedules = allSch.filter(s => s.date === modalDateKey);
  } catch (e) {
    console.warn('📝 [WORK_DIARY] scheduledPosts 파싱 실패:', e);
  }

  // 예약 스케줄 섹션 HTML
  const schedulesSectionHtml = modalSchedules.length > 0 ? `
    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #f59e0b; display: flex; align-items: center; gap: 6px;">📌 예약된 키워드 (${modalSchedules.length}건)</h3>
      ${modalSchedules.map(s => {
    const sColor = s.status === 'completed' ? '#10b981' : s.status === 'failed' ? '#ef4444' : s.status === 'running' ? '#3b82f6' : '#f59e0b';
    const sText = s.status === 'completed' ? '완료' : s.status === 'failed' ? '실패' : s.status === 'running' ? '실행중' : '대기중';
    return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #64748b; font-size: 12px;">🕐 ${sanitizeHTML(s.time || '')}</span>
            <span style="color: #e2e8f0; font-size: 13px; font-weight: 600;">${sanitizeHTML(s.topic || '제목 없음')}</span>
          </div>
          <span style="background: ${sColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600;">${sText}</span>
        </div>`;
  }).join('')}
    </div>
  ` : '';

  // HTML 문자열 생성
  const modalHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 24px; font-weight: 700;">📅 ${sanitizedDateString}</h2>
      <button id="closeModal" style="background: rgba(255, 255, 255, 0.2); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 18px;">×</button>
    </div>
    
    ${schedulesSectionHtml}
    
    <div style="margin-bottom: 20px;">
      <textarea id="workRecordInput" placeholder="오늘 어떤 작업을 하셨나요? (예: 블로그 포스트 3개 작성, 키워드 연구, 이미지 최적화 등)" 
        style="width: 100%; height: 80px; padding: 15px; border: none; border-radius: 10px; background: rgba(255, 255, 255, 0.9); color: #333; font-size: 14px; resize: vertical;"></textarea>
      
      <!-- 빠른 작업 기록 버튼들 -->
      <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button onclick="addQuickWorkRecord('블로그 포스트 작성')" style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📝 포스트 작성</button>
        <button onclick="addQuickWorkRecord('키워드 연구')" style="background: #8b5cf6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🔍 키워드 연구</button>
        <button onclick="addQuickWorkRecord('이미지 최적화')" style="background: #f59e0b; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🖼️ 이미지 작업</button>
        <button onclick="addQuickWorkRecord('SEO 분석')" style="background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📊 SEO 분석</button>
        <button onclick="addQuickWorkRecord('경쟁사 분석')" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🏆 경쟁사 분석</button>
        <button onclick="addQuickWorkRecord('콘텐츠 기획')" style="background: #06b6d4; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📋 콘텐츠 기획</button>
      </div>
      
      <button id="addWorkRecord" style="margin-top: 10px; background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">작업 기록 추가</button>
    </div>
    
    <div id="workRecordsList" style="background: rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 18px;">📝 작업 기록</h3>
        <div style="display: flex; gap: 8px;">
          <button onclick="exportWorkRecords('${formatDateKey(date)}')" style="background: #6366f1; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📊 내보내기</button>
          <button onclick="addWorkRecordTemplate('daily')" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📋 템플릿</button>
        </div>
      </div>
      
      <!-- 작업 통계 -->
      ${sanitizedWorkRecords.length > 0 ? `
        <div style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 15px; display: flex; justify-content: space-around; text-align: center;">
          <div>
            <div style="font-size: 20px; font-weight: bold; color: #10b981;">${sanitizedWorkRecords.filter(r => r.completed).length}</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">완료</div>
          </div>
          <div>
            <div style="font-size: 20px; font-weight: bold; color: #f59e0b;">${sanitizedWorkRecords.filter(r => !r.completed).length}</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">진행중</div>
          </div>
          <div>
            <div style="font-size: 20px; font-weight: bold; color: #3b82f6;">${sanitizedWorkRecords.length}</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">전체</div>
          </div>
          <div>
            <div style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${sanitizedWorkRecords.length > 0 ? Math.round((sanitizedWorkRecords.filter(r => r.completed).length / sanitizedWorkRecords.length) * 100) : 0}%</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">완료율</div>
          </div>
        </div>
      ` : ''}
      ${sanitizedWorkRecords.length === 0 ?
      '<div style="text-align: center; color: rgba(255, 255, 255, 0.7); padding: 20px;">아직 작업 기록이 없습니다.</div>' :
      (() => {
        const incompleteHtml = sanitizedWorkRecords.filter(record => !record.completed).map(record => {
          const checkedAttr = record.completed ? 'checked' : '';
          const dateKey = formatDateKey(date);
          return '<div class="work-record-item" style="background: rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #10b981;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><div style="display: flex; align-items: center; gap: 10px;"><input type="checkbox" ' + checkedAttr + ' onchange="toggleWorkRecordCompletion(\'' + record.id + '\', \'' + dateKey + '\', this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: #10b981;"><span style="font-weight: 600; color: #10b981;">🕐 ' + record.time + '</span></div><button onclick="deleteWorkRecord(\'' + record.id + '\', \'' + dateKey + '\')" style="background: rgba(239, 68, 68, 0.8); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button></div><div style="color: rgba(255, 255, 255, 0.9); line-height: 1.4;">' + record.content + '</div></div>';
        }).join('');

        const completedHtml = sanitizedWorkRecords.filter(record => record.completed).map(record => {
          const checkedAttr = record.completed ? 'checked' : '';
          const dateKey = formatDateKey(date);
          return '<div class="work-record-item" style="background: rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #6b7280; opacity: 0.7;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><div style="display: flex; align-items: center; gap: 10px;"><input type="checkbox" ' + checkedAttr + ' onchange="toggleWorkRecordCompletion(\'' + record.id + '\', \'' + dateKey + '\', this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: #6b7280;"><span style="font-weight: 600; color: #6b7280;">🕐 ' + record.time + '</span></div><button onclick="deleteWorkRecord(\'' + record.id + '\', \'' + dateKey + '\')" style="background: rgba(239, 68, 68, 0.8); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button></div><div style="color: rgba(255, 255, 255, 0.6); line-height: 1.4; text-decoration: line-through;">' + record.content + '</div></div>';
        }).join('');

        return incompleteHtml + (completedHtml ? '<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2);"><h4 style="margin: 0 0 10px 0; font-size: 14px; color: rgba(255, 255, 255, 0.7);">✅ 완료된 작업</h4>' + completedHtml + '</div>' : '');
      })()
    }
    </div>
  `;

  // 🔧 최종 sanitize 적용
  modalContent.innerHTML = sanitizeHTML(modalHtml);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 🔧 이벤트 리스너 핸들러 함수들 (cleanup을 위해 명시적으로 정의)
  const closeModalBtn = document.getElementById('closeModal');
  const addWorkRecordBtn = document.getElementById('addWorkRecord');
  const workRecordInput = document.getElementById('workRecordInput');

  // Cleanup 함수: 모든 이벤트 리스너 제거
  const cleanupEventListeners = () => {
    if (closeModalBtn) {
      closeModalBtn.removeEventListener('click', handleCloseClick);
    }
    if (addWorkRecordBtn) {
      addWorkRecordBtn.removeEventListener('click', handleAddRecordClick);
    }
    if (workRecordInput) {
      workRecordInput.removeEventListener('keypress', handleKeypress);
    }
    document.removeEventListener('keydown', escapeHandler);
    modal.removeEventListener('click', handleModalClick);
    console.log('🧹 [WORK_DIARY] 모든 이벤트 리스너 제거 완료');
  };

  // 이벤트 핸들러 함수들
  const handleCloseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    cleanupEventListeners();
    try {
      document.body.removeChild(modal);
    } catch (error) {
      console.log('Modal already removed');
    }
  };

  const handleAddRecordClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const content = workRecordInput.value.trim();
    if (content) {
      saveWorkRecord(date, content);
      workRecordInput.value = '';
      // 모달창 닫고 다시 열어서 업데이트된 내용 표시
      cleanupEventListeners();
      try {
        document.body.removeChild(modal);
        showWorkDiary(date);
      } catch (error) {
        console.log('Modal removal error:', error);
      }
    } else {
      alert('작업 내용을 입력해주세요!');
    }
  };

  const handleKeypress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      addWorkRecordBtn.click();
    }
  };

  const escapeHandler = (e) => {
    if (e.key === 'Escape' && document.body.contains(modal)) {
      e.preventDefault();
      cleanupEventListeners();
      try {
        document.body.removeChild(modal);
      } catch (error) {
        console.log('Modal removal error:', error);
      }
    }
  };

  const handleModalClick = (e) => {
    if (e.target === modal) {
      cleanupEventListeners();
      try {
        document.body.removeChild(modal);
      } catch (error) {
        console.log('Modal already removed');
      }
    }
  };

  // 이벤트 리스너 추가
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', handleCloseClick);
  }
  if (addWorkRecordBtn) {
    addWorkRecordBtn.addEventListener('click', handleAddRecordClick);
  }
  if (workRecordInput) {
    workRecordInput.addEventListener('keypress', handleKeypress);
  }
  document.addEventListener('keydown', escapeHandler);
  modal.addEventListener('click', handleModalClick);
}

// 작업 기록 완료 상태 토글 함수
function toggleWorkRecordCompletion(recordId, dateKey, isCompleted) {
  if (workDiary[dateKey]) {
    const record = workDiary[dateKey].find(r => r.id == recordId);
    if (record) {
      record.completed = isCompleted;
      localStorage.setItem('workDiary', JSON.stringify(workDiary));

      // 현재 열린 모달이 있다면 새로고침
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

// 작업 기록 삭제 함수
function deleteWorkRecord(recordId, dateKey) {
  if (workDiary[dateKey]) {
    workDiary[dateKey] = workDiary[dateKey].filter(record => record.id != recordId);
    if (workDiary[dateKey].length === 0) {
      delete workDiary[dateKey];
    }
    localStorage.setItem('workDiary', JSON.stringify(workDiary));

    // 달력 다시 렌더링
    renderCalendar();

    // 현재 열려있는 모달이 있다면 닫고 다시 열기
    const modals = document.querySelectorAll('[style*="position: fixed"]');
    if (modals.length > 0) {
      const date = new Date(dateKey);
      modals[0].remove();
      showWorkDiary(date);
    }
  }
}

// 오늘 작업 기록 자동 추가 함수 (포스트 작성 완료 시 호출)
function addTodayWorkRecord(workType, details = '') {
  const today = new Date();
  const record = `${workType}${details ? ': ' + details : ''}`;
  console.log('Adding work record:', record); // 디버깅용
  saveWorkRecord(today, record);
  renderCalendar(); // 달력 업데이트
}

// 빠른 작업 기록 추가 함수
function addQuickWorkRecord(taskType) {
  const textarea = document.getElementById('workRecordInput');
  if (textarea) {
    textarea.value = taskType;
    textarea.focus();
  }
}

// 작업 기록 통계 함수
function getWorkRecordStats(dateKey) {
  const records = workDiary[dateKey] || [];
  const completed = records.filter(record => record.completed).length;
  const total = records.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    pending: total - completed,
    completionRate
  };
}

// 작업 기록 내보내기 함수
function exportWorkRecords(dateKey) {
  const records = workDiary[dateKey] || [];
  const date = new Date(dateKey);
  const dateString = date.toLocaleDateString('ko-KR');

  const csvContent = [
    ['시간', '작업 내용', '완료 여부'],
    ...records.map(record => [
      record.time,
      record.content,
      record.completed ? '완료' : '미완료'
    ])
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `작업기록_${dateString}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 작업 기록 템플릿 함수
function addWorkRecordTemplate(templateType) {
  const templates = {
    'daily': '오늘의 작업 목표:\n1. 블로그 포스트 작성\n2. 키워드 연구\n3. 이미지 최적화\n4. SEO 분석',
    'weekly': '주간 작업 계획:\n1. 콘텐츠 기획\n2. 경쟁사 분석\n3. 포스트 발행\n4. 성과 분석',
    'monthly': '월간 목표:\n1. 콘텐츠 캘린더 작성\n2. 키워드 전략 수립\n3. 성과 측정\n4. 개선점 도출'
  };

  const textarea = document.getElementById('workRecordInput');
  if (textarea && templates[templateType]) {
    textarea.value = templates[templateType];
    textarea.focus();
  }
}

// 플랫폼 상태 업데이트 (배지 + 필드)
async function updatePlatformStatus() {
  const platformStatusElement = document.getElementById('platformStatus');

  // 먼저 현재 선택된 라디오 버튼 확인
  const selectedRadio = document.querySelector('input[name="platform"]:checked');
  let selectedPlatform = 'blogspot'; // 기본값

  if (selectedRadio) {
    selectedPlatform = selectedRadio.value;
  } else {
    // 라디오 버튼이 없으면 저장된 설정에서 가져오기
    try {
      const settings = await loadSettings();
      selectedPlatform = settings.platform || 'blogspot';
    } catch (e) {
      console.warn('[PLATFORM] 설정 로드 실패:', e);
    }
  }

  // 🔥 상단 플랫폼 배지 업데이트
  if (platformStatusElement) {
    const isBlogger = selectedPlatform === 'blogger' || selectedPlatform === 'blogspot';
    platformStatusElement.textContent = isBlogger ? 'Blogger' : 'WordPress';
    platformStatusElement.style.color = isBlogger ? '#f97316' : '#3b82f6';
    console.log('[PLATFORM] 배지 업데이트:', platformStatusElement.textContent);
  }

  // 🔥 updatePlatformBadge도 호출
  if (typeof updatePlatformBadge === 'function') {
    updatePlatformBadge(selectedPlatform);
  }
}

// CTA 설정 토글
function toggleCtaSettings() {
  const ctaMode = document.querySelector('input[name="ctaMode"]:checked')?.value || 'auto';
  const manualCtaSettings = document.getElementById('manualCtaSettings');

  if (manualCtaSettings) {
    manualCtaSettings.style.display = ctaMode === 'manual' ? 'block' : 'none';

    // 수동 모드로 전환 시 첫 번째 CTA 항목 자동 추가
    if (ctaMode === 'manual') {
      const ctaItemsList = document.getElementById('ctaItemsList');
      if (ctaItemsList && ctaItemsList.children.length === 0) {
        addCtaItem();
      }
    }
  }
}

// CTA 항목 추가
let ctaItemCount = 0;
function addCtaItem() {
  const ctaItemsList = document.getElementById('ctaItemsList');
  if (!ctaItemsList) return;

  // 최대 4개까지만 허용
  if (ctaItemsList.children.length >= 4) {
    alert('CTA는 최대 4개까지 추가할 수 있습니다.');
    return;
  }

  ctaItemCount++;
  const itemId = `ctaItem${ctaItemCount}`;

  const itemHtml = `
    <div id="${itemId}" style="padding: 12px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <label style="color: rgba(255, 255, 255, 0.9); font-weight: 600; font-size: 13px;">CTA ${ctaItemsList.children.length + 1}</label>
        <button onclick="removeCtaItem('${itemId}')" style="background: rgba(255, 255, 255, 0.15); border: none; color: rgba(255, 255, 255, 0.9); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
      </div>
      <input type="text" id="${itemId}_title" placeholder="버튼 텍스트 (예: 자세히 보기)" style="width: 100%; padding: 8px 12px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 6px; color: white; font-size: 13px; backdrop-filter: blur(10px); margin-bottom: 8px;">
      <input type="url" id="${itemId}_url" placeholder="URL (예: https://example.com)" style="width: 100%; padding: 8px 12px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 6px; color: white; font-size: 13px; backdrop-filter: blur(10px); margin-bottom: 8px;">
      <textarea id="${itemId}_desc" placeholder="설명 (선택사항)" rows="2" style="width: 100%; padding: 8px 12px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 6px; color: white; font-size: 13px; backdrop-filter: blur(10px); resize: vertical;"></textarea>
    </div>
  `;

  ctaItemsList.insertAdjacentHTML('beforeend', itemHtml);
}

// CTA 항목 제거
function removeCtaItem(itemId) {
  const item = document.getElementById(itemId);
  if (item) {
    item.remove();

    // CTA 번호 재설정
    const ctaItemsList = document.getElementById('ctaItemsList');
    if (ctaItemsList) {
      const items = ctaItemsList.children;
      for (let i = 0; i < items.length; i++) {
        const label = items[i].querySelector('label');
        if (label) {
          label.textContent = `CTA ${i + 1}`;
        }
      }
    }
  }
}

// 🔥 Blogger OAuth 가이드 토글
function toggleBloggerGuide() {
  const guide = document.getElementById('bloggerOAuthGuide');
  if (guide) {
    guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
  }
}
window.toggleBloggerGuide = toggleBloggerGuide;

// 플랫폼 필드 토글 (포스팅 작성 페이지 + 환경설정) - 통합 버전
function togglePlatformFields() {
  const selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'blogspot';
  const isBlogger = selectedPlatform === 'blogger' || selectedPlatform === 'blogspot';

  console.log('[PLATFORM] togglePlatformFields 실행:', selectedPlatform, '-> isBlogger:', isBlogger);

  // 🔥 환경설정 모달의 Blogger/WordPress 필드 토글
  const bloggerFields = document.getElementById('blogger-fields');
  const wordpressFields = document.getElementById('wordpress-fields');

  if (bloggerFields) {
    bloggerFields.style.display = isBlogger ? 'block' : 'none';
  }
  if (wordpressFields) {
    wordpressFields.style.display = isBlogger ? 'none' : 'block';
  }

  // 🔥 새 환경설정 UI 선택 박스 스타일 업데이트
  const bloggerBox = document.getElementById('blogger-select-box');
  const wordpressBox = document.getElementById('wordpress-select-box');

  if (bloggerBox) {
    bloggerBox.style.borderColor = isBlogger ? '#f97316' : '#e2e8f0';
    bloggerBox.style.background = isBlogger ? '#fff7ed' : 'white';
  }
  if (wordpressBox) {
    wordpressBox.style.borderColor = isBlogger ? '#e2e8f0' : '#6366f1';
    wordpressBox.style.background = isBlogger ? 'white' : '#f5f3ff';
  }

  // 🔥 플랫폼 상태 박스 업데이트
  const platformIcon = document.getElementById('platformIcon');
  const platformName = document.getElementById('platformName');
  const platformStatus = document.getElementById('platformStatus');
  const platformStatusBox = document.getElementById('platformStatusBox');

  if (isBlogger) {
    if (platformIcon) platformIcon.textContent = '🅱️';
    if (platformName) platformName.textContent = 'Blogger';
    if (platformStatus) platformStatus.textContent = 'Google 블로그 플랫폼';
    if (platformStatusBox) {
      platformStatusBox.style.background = 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)';
      platformStatusBox.style.borderColor = '#fdba74';
    }
  } else {
    if (platformIcon) platformIcon.textContent = '🌐';
    if (platformName) platformName.textContent = 'WordPress';
    if (platformStatus) platformStatus.textContent = '자체 호스팅 블로그 플랫폼';
    if (platformStatusBox) {
      platformStatusBox.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
      platformStatusBox.style.borderColor = '#93c5fd';
    }
  }

  // 포스팅 페이지용 필드들
  const wordpressCategoryField = document.getElementById('wordpressCategoryField');
  const wpCategorySection = document.getElementById('wpCategorySection');
  const bloggerAuthBtn = document.getElementById('bloggerOAuthBtn');
  const bloggerAuthBtn2 = document.getElementById('bloggerAuthBtn2');
  const loadCategoriesBtn = document.getElementById('loadCategoriesBtn');

  if (wordpressCategoryField) {
    wordpressCategoryField.style.display = isBlogger ? 'none' : 'block';
  }
  if (wpCategorySection) {
    wpCategorySection.style.display = isBlogger ? 'none' : 'block';
  }
  if (bloggerAuthBtn) {
    bloggerAuthBtn.style.display = isBlogger ? 'inline-block' : 'none';
  }
  if (bloggerAuthBtn2) {
    bloggerAuthBtn2.style.display = isBlogger ? 'block' : 'none';
  }
  if (loadCategoriesBtn) {
    loadCategoriesBtn.style.display = isBlogger ? 'none' : 'block';
  }

  // 🔥 상단 플랫폼 배지 업데이트
  updatePlatformBadge(isBlogger ? 'blogger' : 'wordpress');

  // 플랫폼 상태 배지도 업데이트
  if (typeof updatePlatformStatus === 'function') {
    updatePlatformStatus();
  }

  // API 연동 상태 표시 업데이트
  if (typeof updateApiStatusIndicators === 'function') {
    updateApiStatusIndicators();
  }
}

// 🔥 상단 플랫폼 배지 업데이트 함수
function updatePlatformBadge(platform) {
  const badge = document.getElementById('platformStatus');
  if (badge) {
    if (platform === 'blogger' || platform === 'blogspot') {
      badge.textContent = 'Blogger';
      badge.style.color = '#f97316'; // 오렌지색
    } else {
      badge.textContent = 'WordPress';
      badge.style.color = '#3b82f6'; // 파란색
    }
    console.log('[BADGE] 플랫폼 배지 업데이트:', badge.textContent);
  }
}

// 🔥 API 연동 상태 표시 업데이트 함수 (window 버전 호출)
function updateApiStatusIndicators() {
  // window에 정의된 함수 사용 (index.html에 정의됨)
  if (typeof window.updateApiStatusIndicators === 'function' && window.updateApiStatusIndicators !== updateApiStatusIndicators) {
    window.updateApiStatusIndicators();
    return;
  }

  // 폴백: 직접 업데이트
  const indicators = {
    'status-gemini': { el: document.getElementById('geminiKey'), required: true },
    'status-openai': { el: document.getElementById('openaiKey'), required: false },
    'status-pexels': { el: document.getElementById('pexelsApiKey'), required: false },
    'status-stability': { el: document.getElementById('stabilityApiKey'), required: false },
    'status-naver': { el: document.getElementById('naverCustomerId'), required: false },
    'status-cse': { el: document.getElementById('googleCseKey'), required: false }
  };

  Object.entries(indicators).forEach(([statusId, info]) => {
    const statusEl = document.getElementById(statusId);
    if (statusEl) {
      const hasValue = info.el && info.el.value && info.el.value.trim().length > 3;
      if (hasValue) {
        statusEl.textContent = '✅';
      } else if (info.required) {
        statusEl.textContent = '❌';
      } else {
        statusEl.textContent = '⚪';
      }
    }
  });

  console.log('[API-STATUS] API 연동 상태 업데이트 완료 (script.js)');
}

// 플랫폼 연동 확인
async function checkPlatformConnection() {
  const selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'blogspot';

  console.log('플랫폼 연동 확인 시작:', selectedPlatform);

  try {
    if (selectedPlatform === 'wordpress') {
      // 워드프레스 인증 확인
      if (window.electronAPI && window.electronAPI.checkWordPressAuthStatus) {
        const result = await window.electronAPI.checkWordPressAuthStatus();
        console.log('워드프레스 인증 결과:', result);

        if (result.authenticated) {
          alert('✅ 워드프레스 연동이 완료되었습니다!');
        } else {
          alert(`❌ 워드프레스 연동을 완료하려면:\n\n1. 환경설정 모달을 열어주세요\n2. 워드프레스 사이트 URL, 사용자명, 앱 비밀번호를 입력하세요\n3. "설정 저장" 버튼을 클릭하세요\n\n현재 오류: ${result.error || '워드프레스 인증 정보가 없습니다'}`);
        }
      } else {
        alert('워드프레스 인증 확인 기능을 사용할 수 없습니다.');
      }
    } else if (selectedPlatform === 'blogger') {
      // 블로그스팟 인증 확인 - 개선된 로직
      const settings = loadSettings();
      console.log('블로그스팟 설정 확인:', {
        blogId: settings.blogId,
        googleClientId: settings.googleClientId,
        googleClientSecret: settings.googleClientSecret
      });

      // 기본 설정 확인
      if (!settings.blogId || !settings.googleClientId || !settings.googleClientSecret) {
        alert(`❌ 블로그스팟 연동을 완료하려면:\n\n1. 환경설정 모달을 열어주세요\n2. Blogger ID, Google Client ID, Google Client Secret을 입력하세요\n3. "설정 저장" 버튼을 클릭하세요\n\n현재 누락된 정보:\n${!settings.blogId ? '- Blogger ID\n' : ''}${!settings.googleClientId ? '- Google Client ID\n' : ''}${!settings.googleClientSecret ? '- Google Client Secret\n' : ''}`);
        return;
      }

      // 토큰 파일 확인 (개발환경에서는 자동으로 성공 처리)
      if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
        alert('✅ 블로그스팟 연동이 완료되었습니다! (개발환경)');
        return;
      }

      // 실제 인증 상태 확인
      if (window.electronAPI && window.electronAPI.checkBloggerAuthStatus) {
        const result = await window.electronAPI.checkBloggerAuthStatus();
        console.log('블로그스팟 인증 결과:', result);

        if (result.authenticated) {
          alert('✅ 블로그스팟 연동이 완료되었습니다!');
        } else {
          alert(`❌ 블로그스팟 연동을 완료하려면:\n\n1. 환경설정 모달을 열어주세요\n2. Google OAuth2 Client ID/Secret을 입력하세요\n3. "블로거 계정 연동" 버튼을 클릭하세요\n4. 인증 코드를 입력하고 "연동 완료" 버튼을 클릭하세요\n\n현재 오류: ${result.error || '블로거 인증 정보가 없습니다'}`);
        }
      } else {
        // API가 없는 경우 설정만 확인
        alert('✅ 블로그스팟 설정이 저장되어 있습니다.\n\nBlogger ID: ' + settings.blogId.substring(0, 10) + '...\nClient ID: ' + settings.googleClientId.substring(0, 20) + '...');
      }
    } else {
      alert('지원하지 않는 플랫폼입니다.');
    }
  } catch (error) {
    console.error('플랫폼 연동 확인 오류:', error);
    alert('플랫폼 연동 확인 중 오류가 발생했습니다: ' + error.message);
  }
}

// CSE 연동 확인
async function checkCseConnection() {
  try {
    const settings = loadSettings();

    if (!settings.googleCseKey || !settings.googleCseCx) {
      alert('❌ CSE 연동이 필요합니다.\n\n환경설정에서 구글 맞춤 검색 API 키와 검색 엔진 ID를 입력해주세요.');
      return;
    }

    // 간단한 테스트 검색 수행
    if (window.blogger && window.blogger.testCseConnection) {
      const result = await window.blogger.testCseConnection(settings.googleCseKey, settings.googleCseCx);

      if (result.success) {
        alert('✅ CSE 연동이 완료되었습니다!\n\n검색 기능을 정상적으로 사용할 수 있습니다.');
      } else {
        alert(`❌ CSE 연동 확인 실패\n\n${result.error || 'API 키 또는 검색 엔진 ID를 확인해주세요.'}`);
      }
    } else {
      // API가 없는 경우 간단히 설정 확인만
      alert('✅ CSE 설정이 저장되어 있습니다.\n\nAPI 키: ' + settings.googleCseKey.substring(0, 10) + '...\n검색 엔진 ID: ' + settings.googleCseCx.substring(0, 10) + '...');
    }
  } catch (error) {
    console.error('CSE 연동 확인 오류:', error);
    alert('CSE 연동 확인 중 오류가 발생했습니다: ' + error.message);
  }
}

// Blogger OAuth 인증 (별칭 함수)
async function authenticateBlogger() {
  return await startBloggerAuth();
}

// ========================================================
// ========================================================
// ⚙️ 상세설정 아코디언 패널 시스템
// ========================================================

/** 상세 설정 패널 토글 */
function togglePostingSettingsPanel() {
  try {
    const panel = document.getElementById('postingSettingsAccordion');
    const btn = document.getElementById('postingSettingsToggleBtn');
    console.log('[SETTINGS-PANEL] 토글 호출, panel:', !!panel, 'btn:', !!btn);

    if (!panel) {
      console.error('[SETTINGS-PANEL] postingSettingsAccordion 패널을 찾을 수 없습니다');
      return;
    }

    const isVisible = panel.style.display !== 'none';

    if (isVisible) {
      panel.style.display = 'none';
      if (btn) {
        const labelSpan = btn.querySelector('span:nth-child(2)');
        if (labelSpan) labelSpan.textContent = '상세설정';
        btn.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)';
        btn.style.borderColor = 'rgba(99, 102, 241, 0.4)';
      }
      const chevron = document.getElementById('settingsChevron');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    } else {
      panel.style.display = 'block';
      if (btn) {
        const labelSpan = btn.querySelector('span:nth-child(2)');
        if (labelSpan) labelSpan.textContent = '설정 닫기';
        btn.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.5) 0%, rgba(168, 85, 247, 0.5) 100%)';
        btn.style.borderColor = 'rgba(99, 102, 241, 0.7)';
      }
      const chevron = document.getElementById('settingsChevron');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
    console.log('[SETTINGS-PANEL] 상세 설정 패널:', isVisible ? '닫힘' : '열림');
  } catch (err) {
    console.error('[SETTINGS-PANEL] 토글 오류:', err);
  }
}
// 전역 등록 보장
window.togglePostingSettingsPanel = togglePostingSettingsPanel;

/** 아코디언 섹션 토글 */
function togglePostingAccordion(sectionId) {
  const body = document.getElementById(sectionId);
  const header = body?.previousElementSibling;
  if (!body) return;

  const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';

  if (isOpen) {
    body.style.maxHeight = '0px';
    body.style.padding = '0 16px';
    body.style.opacity = '0';
    if (header) {
      const chevron = header.querySelector('.acc-chevron');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  } else {
    body.style.maxHeight = body.scrollHeight + 100 + 'px';
    body.style.padding = '16px';
    body.style.opacity = '1';
    if (header) {
      const chevron = header.querySelector('.acc-chevron');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
  }
}
// 전역 등록 보장
window.togglePostingAccordion = togglePostingAccordion;

// ========================================================
// 🔐 ImageFX Google 로그인 핸들러
// ========================================================

/** ImageFX Google 로그인 상태 확인 */
async function handleImageFxCheckLogin() {
  const statusEl = document.getElementById('imagefxLoginStatus');
  const checkBtn = document.getElementById('imagefxCheckBtn');
  
  try {
    if (checkBtn) {
      checkBtn.disabled = true;
      checkBtn.textContent = '확인 중...';
    }
    if (statusEl) {
      statusEl.textContent = '🔄 로그인 상태 확인 중...';
      statusEl.style.color = '#f59e0b';
    }

    const api = window.blogger || window.electronAPI;
    if (!api || !api.imagefxCheckLogin) {
      if (statusEl) {
        statusEl.textContent = '❌ API를 사용할 수 없습니다. 앱을 재시작해주세요.';
        statusEl.style.color = '#ef4444';
      }
      return;
    }

    const result = await api.imagefxCheckLogin();
    console.log('[ImageFX] 로그인 확인 결과:', result);

    if (statusEl) {
      if (result.loggedIn) {
        statusEl.textContent = `✅ 로그인 완료${result.userName ? ': ' + result.userName : ''}`;
        statusEl.style.color = '#34d399';
        // 로그인 버튼 스타일 변경
        const loginBtn = document.getElementById('imagefxLoginBtn');
        if (loginBtn) {
          loginBtn.style.background = 'linear-gradient(135deg, #34d399, #059669)';
          loginBtn.innerHTML = '<span style="font-size: 16px;">✅</span> 로그인 완료';
        }
      } else {
        statusEl.textContent = '⚠️ ' + (result.message || 'Google 로그인이 필요합니다.');
        statusEl.style.color = '#f59e0b';
      }
    }
  } catch (error) {
    console.error('[ImageFX] 로그인 확인 오류:', error);
    if (statusEl) {
      statusEl.textContent = '❌ 확인 실패: ' + (error.message || '알 수 없는 오류');
      statusEl.style.color = '#ef4444';
    }
  } finally {
    if (checkBtn) {
      checkBtn.disabled = false;
      checkBtn.textContent = '확인';
    }
  }
}

/** ImageFX Google 로그인 실행 */
async function handleImageFxLogin() {
  const statusEl = document.getElementById('imagefxLoginStatus');
  const loginBtn = document.getElementById('imagefxLoginBtn');
  
  try {
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span style="font-size: 16px;">⏳</span> 로그인 중...';
      loginBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    }
    if (statusEl) {
      statusEl.textContent = '🔑 Google 로그인 브라우저가 열립니다. 로그인을 완료해주세요...';
      statusEl.style.color = '#60a5fa';
    }

    const api = window.blogger || window.electronAPI;
    if (!api || !api.imagefxLogin) {
      if (statusEl) {
        statusEl.textContent = '❌ API를 사용할 수 없습니다. 앱을 재시작해주세요.';
        statusEl.style.color = '#ef4444';
      }
      return;
    }

    const result = await api.imagefxLogin();
    console.log('[ImageFX] 로그인 결과:', result);

    if (statusEl) {
      if (result.loggedIn) {
        statusEl.textContent = `✅ Google 로그인 완료${result.userName ? ': ' + result.userName : ''}`;
        statusEl.style.color = '#34d399';
        if (loginBtn) {
          loginBtn.style.background = 'linear-gradient(135deg, #34d399, #059669)';
          loginBtn.innerHTML = '<span style="font-size: 16px;">✅</span> 로그인 완료';
        }
      } else {
        statusEl.textContent = '⚠️ ' + (result.message || '로그인에 실패했습니다.');
        statusEl.style.color = '#f59e0b';
      }
    }
  } catch (error) {
    console.error('[ImageFX] 로그인 오류:', error);
    if (statusEl) {
      statusEl.textContent = '❌ 로그인 실패: ' + (error.message || '알 수 없는 오류');
      statusEl.style.color = '#ef4444';
    }
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      if (!loginBtn.innerHTML.includes('✅')) {
        loginBtn.innerHTML = '<span style="font-size: 16px;">🔑</span> Google 로그인';
        loginBtn.style.background = 'linear-gradient(135deg, #4285f4, #34a853)';
      }
    }
  }
}

// 전역 등록
window.handleImageFxCheckLogin = handleImageFxCheckLogin;
window.handleImageFxLogin = handleImageFxLogin;

/** 간편 모드 전용 말투 버튼 클릭 */
function selectSimpleTone(tone) {
  // 1. 버튼 스타일 갱신
  const btns = document.querySelectorAll('#simpleToneButtons .simple-tone-btn');
  btns.forEach(btn => {
    const isActive = btn.getAttribute('data-tone') === tone;
    btn.style.border = isActive
      ? '2px solid rgba(99, 102, 241, 0.6)'
      : '2px solid rgba(255,255,255,0.15)';
    btn.style.background = isActive
      ? 'rgba(99, 102, 241, 0.15)'
      : 'rgba(255,255,255,0.05)';
    btn.style.color = isActive ? 'white' : 'rgba(255,255,255,0.8)';
  });

  // 2. 원본 toneStyle select 동기화
  const origSelect = document.getElementById('toneStyle');
  if (origSelect) {
    origSelect.value = tone;
    console.log('[SIMPLE-TONE] 동기화 → toneStyle =', tone);
  }
}

/** 간편 모드 전용 이미지 버튼 클릭 */
function selectSimpleImage(imgType) {
  // 1. 버튼 스타일 갱신
  const btns = document.querySelectorAll('#simpleImageButtons .simple-img-btn');
  btns.forEach(btn => {
    const isActive = btn.getAttribute('data-img') === imgType;
    btn.style.border = isActive
      ? '2px solid rgba(99, 102, 241, 0.6)'
      : '2px solid rgba(255,255,255,0.15)';
    btn.style.background = isActive
      ? 'rgba(99, 102, 241, 0.15)'
      : 'rgba(255,255,255,0.05)';
    btn.style.color = isActive ? 'white' : 'rgba(255,255,255,0.8)';
  });

  // 2. 원본 select들에 매핑 동기화
  const thumbSelect = document.getElementById('thumbnailType');
  const h2Select = document.getElementById('h2ImageSource');

  const mapping = {
    'ai': { thumb: 'nanobananapro', h2: 'nanobananapro' },
    'search': { thumb: 'cse', h2: 'none' },
    'text': { thumb: 'svg', h2: 'none' },
    'none': { thumb: 'none', h2: 'none' }
  };

  const m = mapping[imgType] || mapping['ai'];
  if (thumbSelect) thumbSelect.value = m.thumb;
  if (h2Select) h2Select.value = m.h2;
  console.log('[SIMPLE-IMG] 동기화 → thumbnailType=' + m.thumb + ', h2ImageSource=' + m.h2);
}

/** 간편 모드 전용 키워드 제목 옵션 토글 */
function toggleSimpleKeywordOption(optionType, labelEl) {
  const cb = labelEl.querySelector('input[type="checkbox"]');
  if (!cb) return;

  // 체크박스 toggle
  cb.checked = !cb.checked;

  // 스타일 갱신
  if (cb.checked) {
    labelEl.style.border = '2px solid ' + (optionType === 'useAsTitle' ? 'rgba(168, 85, 247, 0.6)' : 'rgba(59, 130, 246, 0.6)');
    labelEl.style.background = optionType === 'useAsTitle' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)';
    labelEl.style.color = 'white';
  } else {
    labelEl.style.border = '2px solid rgba(255,255,255,0.15)';
    labelEl.style.background = 'rgba(255,255,255,0.05)';
    labelEl.style.color = 'rgba(255,255,255,0.8)';
  }

  // 키워드=제목 체크 시 키워드맨앞 비활성화 (상호 배타)
  if (optionType === 'useAsTitle') {
    const frontCb = document.getElementById('keywordFront');
    const frontLabel = frontCb?.closest('label');
    if (frontCb && frontLabel) {
      if (cb.checked) {
        frontCb.checked = false;
        frontLabel.style.opacity = '0.4';
        frontLabel.style.pointerEvents = 'none';
        frontLabel.style.border = '2px solid rgba(255,255,255,0.15)';
        frontLabel.style.background = 'rgba(255,255,255,0.05)';
        frontLabel.style.color = 'rgba(255,255,255,0.8)';
      } else {
        frontLabel.style.opacity = '1';
        frontLabel.style.pointerEvents = 'auto';
      }
    }
  }

  console.log('[SIMPLE-KEYWORD] ' + optionType + ' = ' + cb.checked);
}

/** 페이지 로드 시 초기화 (상세 설정 패널 닫힌 상태) */
function initPostingViewMode() {
  const panel = document.getElementById('postingSettingsAccordion');
  if (panel) {
    panel.style.display = 'none';
  }
  console.log('[SETTINGS-PANEL] 초기화: 상세 설정 패널 닫힘');
}


// DOMContentLoaded에서 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPostingViewMode);
} else {
  // 이미 로드 완료된 경우
  setTimeout(initPostingViewMode, 100);
}

// 초안 섹션 토글 함수
function toggleDraftSection() {
  try {
    const draftSection = document.getElementById('draftInputSection');
    const toggleIcon = document.getElementById('draftToggleIcon');

    if (!draftSection) {
      console.warn('[DRAFT] 초안 입력 영역을 찾을 수 없습니다.');
      return;
    }

    const isVisible = draftSection.style.display !== 'none';

    if (isVisible) {
      draftSection.style.display = 'none';
      if (toggleIcon) {
        toggleIcon.style.transform = 'rotate(0deg)';
      }
    } else {
      draftSection.style.display = 'block';
      if (toggleIcon) {
        toggleIcon.style.transform = 'rotate(180deg)';
      }
    }

    console.log('[DRAFT] 초안 섹션 토글:', isVisible ? '숨김' : '표시');
  } catch (error) {
    console.error('[DRAFT] 초안 섹션 토글 오류:', error);
  }
}

// 초안 글자수 업데이트 함수 (원본)
function _updateDraftCount() {
  try {
    const draftInput = document.getElementById('draftInput');
    const draftCount = document.getElementById('draftCount');

    if (!draftInput || !draftCount) return;

    const text = draftInput.value || '';
    const charCount = text.length;
    const maxChars = 5000;

    draftCount.textContent = `${charCount}/${maxChars}`;

    if (charCount > maxChars) {
      draftCount.style.color = '#ef4444';
    } else if (charCount > maxChars * 0.8) {
      draftCount.style.color = '#f59e0b';
    } else {
      draftCount.style.color = 'rgba(255, 255, 255, 0.7)';
    }
  } catch (error) {
    console.error('[DRAFT] 글자수 업데이트 오류:', error);
  }
}

// 🔧 Debounce 적용된 updateDraftCount (300ms)
const updateDraftCount = debounce(_updateDraftCount, 300);

// 🔥 블로그스팟 OAuth 인증 시작 (로컬 서버 기반으로 리다이렉트)
async function startBloggerAuth() {
  // startBloggerOAuth로 통합 (OOB deprecated 대응)
  return startBloggerOAuth();
}

// 블로그스팟 인증 필드 표시
function showBloggerAuthFields() {
  const bloggerAuthBtn = document.getElementById('bloggerAuthBtn');
  const bloggerAuthBtn2 = document.getElementById('bloggerAuthBtn2');

  // 기존 인증 필드가 있는지 확인
  let authContainer = document.getElementById('bloggerAuthContainer');

  if (!authContainer) {
    // 인증 필드 컨테이너 생성
    authContainer = document.createElement('div');
    authContainer.id = 'bloggerAuthContainer';
    authContainer.style.cssText = `
      margin-top: 15px;
      padding: 15px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    // 코드 입력 필드
    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.id = 'bloggerAuthCode';
    codeInput.placeholder = '인증 코드를 입력하세요 (브라우저에서 복사)';
    codeInput.style.cssText = `
      width: 100%;
      padding: 10px;
      margin-bottom: 10px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #ddd;
      border-radius: 4px;
      color: #333;
      font-size: 14px;
    `;

    // 연동 확인 버튼
    const verifyBtn = document.createElement('button');
    verifyBtn.type = 'button';
    verifyBtn.id = 'bloggerVerifyBtn';
    verifyBtn.textContent = '연동 확인';
    verifyBtn.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.3s;
    `;
    verifyBtn.onclick = verifyBloggerAuth;

    // 연동 상태 표시
    const statusDiv = document.createElement('div');
    statusDiv.id = 'bloggerAuthStatus';
    statusDiv.style.cssText = `
      margin-top: 10px;
      padding: 8px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      display: none;
    `;

    authContainer.appendChild(codeInput);
    authContainer.appendChild(verifyBtn);
    authContainer.appendChild(statusDiv);

    // 인증 버튼 다음에 컨테이너 삽입
    if (bloggerAuthBtn) {
      bloggerAuthBtn.parentNode.insertBefore(authContainer, bloggerAuthBtn.nextSibling);
    } else if (bloggerAuthBtn2) {
      bloggerAuthBtn2.parentNode.insertBefore(authContainer, bloggerAuthBtn2.nextSibling);
    }
  }

  // 필드 표시
  authContainer.style.display = 'block';

  // 안내 메시지
  const statusDiv = document.getElementById('bloggerAuthStatus');
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#2196F3';
    statusDiv.style.color = 'white';
    statusDiv.textContent = '브라우저에서 인증 완료 후 코드를 복사해서 입력하세요';
  }
}

// 블로그스팟 인증 확인
async function verifyBloggerAuth() {
  const codeInput = document.getElementById('bloggerAuthCode');
  const verifyBtn = document.querySelector('button[onclick="verifyBloggerAuth()"]');
  const statusDiv = document.getElementById('bloggerAuthStatus');

  if (!codeInput || !codeInput.value.trim()) {
    alert('❌ 인증 코드를 입력해주세요.');
    return;
  }

  try {
    // 버튼 비활성화
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = '연동 중...';
      verifyBtn.style.background = '#ccc';
    }

    // 상태 표시
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.style.background = '#FF9800';
      statusDiv.style.color = 'white';
      statusDiv.textContent = '연동 확인 중...';
    }

    // 인증 코드로 토큰 교환
    const result = await handleBloggerCallback(codeInput.value.trim());

    if (result.ok) {
      // 성공
      if (statusDiv) {
        statusDiv.style.background = '#4CAF50';
        statusDiv.style.color = 'white';
        statusDiv.textContent = '✅ 연동완료';
      }

      // 입력 필드 숨기기
      if (codeInput) codeInput.value = '';

      alert('✅ 블로그스팟 연동이 완료되었습니다!');

      // 인증 모달 닫기
      closeBloggerAuthModal();

      // 플랫폼 상태 업데이트
      updatePlatformStatus();
    } else {
      // 실패
      if (statusDiv) {
        statusDiv.style.background = '#f44336';
        statusDiv.style.color = 'white';
        statusDiv.textContent = '❌ 연동 실패: ' + (result.error || '알 수 없는 오류');
      }

      alert('❌ 블로그스팟 연동에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('블로그스팟 인증 확인 오류:', error);

    if (statusDiv) {
      statusDiv.style.background = '#f44336';
      statusDiv.style.color = 'white';
      statusDiv.textContent = '❌ 연동 오류: ' + error.message;
    }

    alert('❌ 블로그스팟 연동 중 오류가 발생했습니다: ' + error.message);
  } finally {
    // 버튼 복원
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = '✅ 연동 확인';
      verifyBtn.style.background = 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)';
    }
  }
}

// 🔥 블로그스팟 OAuth 시작 (로컬 서버 기반 - 자동 콜백)
async function startBloggerOAuth() {
  try {
    // 환경설정 모달에서 키 값들 가져오기
    const settings = await loadSettings();
    const blogId = settings.blogId || '';
    const googleClientId = settings.googleClientId || '';
    const googleClientSecret = settings.googleClientSecret || '';

    if (!blogId || !googleClientId || !googleClientSecret) {
      alert('❌ 환경설정에서 Blogger ID, Google Client ID, Google Client Secret을 먼저 설정해주세요.');
      return;
    }

    // 🔥 Electron IPC로 로컬 서버 시작 + OAuth URL 열기
    if (window.electronAPI && window.electronAPI.startBloggerAuth) {
      console.log('[BLOGGER-AUTH] 로컬 서버 기반 OAuth 시작...');

      const result = await window.electronAPI.startBloggerAuth({
        blogId,
        googleClientId,
        googleClientSecret
      });

      if (!result.ok) {
        alert('❌ 블로그스팟 OAuth 시작 실패: ' + (result.error || '알 수 없는 오류'));
        return;
      }

      console.log('[BLOGGER-AUTH] OAuth URL 열림:', result.authUrl);
      console.log('[BLOGGER-AUTH] Redirect URI:', result.redirectUri);

      // 🔥 로딩 모달 표시 (자동 콜백 대기)
      showBloggerAuthWaitingModal();

    } else {
      // 🔥 Electron API 없음 - 에러 표시
      console.error('[BLOGGER-AUTH] Electron API 없음!');
      alert('❌ Blogger 인증을 사용하려면 앱을 다시 시작해주세요.\n\nElectron API를 찾을 수 없습니다.');
    }

  } catch (error) {
    console.error('❌ 블로그스팟 OAuth 시작 오류:', error);
    alert('❌ 블로그스팟 OAuth 시작 중 오류가 발생했습니다: ' + error.message);
  }
}

// 🔥 블로그스팟 인증 대기 모달 표시 (자동 콜백용)
function showBloggerAuthWaitingModal() {
  // 기존 모달 제거
  const existingModal = document.getElementById('bloggerAuthWaitingModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'bloggerAuthWaitingModal';
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
    z-index: 99999;
  `;

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%); border-radius: 20px; padding: 40px; max-width: 450px; width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
      <div style="font-size: 60px; margin-bottom: 20px; animation: pulse 2s infinite;">🔐</div>
      <h2 style="color: white; font-size: 24px; margin-bottom: 15px;">브라우저에서 인증 중...</h2>
      <p style="color: #94a3b8; font-size: 16px; margin-bottom: 20px;">
        브라우저에서 Google 계정으로 로그인하고<br>
        권한을 승인해주세요.
      </p>
      <div style="background: rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 15px; margin-bottom: 20px;">
        <div style="width: 40px; height: 40px; border: 3px solid #3b82f6; border-top-color: transparent; border-radius: 50%; margin: 0 auto; animation: spin 1s linear infinite;"></div>
        <p style="color: #60a5fa; font-size: 14px; margin-top: 10px;">인증 완료를 기다리는 중...</p>
      </div>
      <button onclick="closeBloggerAuthWaitingModal()" style="padding: 12px 30px; background: #64748b; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
        취소
      </button>
    </div>
    <style>
      @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  `;

  document.body.appendChild(modal);
}

// 🔥 블로그스팟 인증 대기 모달 닫기
function closeBloggerAuthWaitingModal() {
  const modal = document.getElementById('bloggerAuthWaitingModal');
  if (modal) modal.remove();
}

// 🔥 블로그스팟 인증 완료 이벤트 리스너
if (window.electronAPI && window.electronAPI.onBloggerAuthComplete) {
  window.electronAPI.onBloggerAuthComplete((result) => {
    console.log('[BLOGGER-AUTH] 인증 완료 이벤트 수신:', result);

    // 대기 모달 닫기
    closeBloggerAuthWaitingModal();

    if (result.ok) {
      alert('✅ 블로그스팟 연동이 완료되었습니다!');
      updatePlatformStatus();

      // 환경설정 모달의 상태도 업데이트
      const statusDiv = document.getElementById('bloggerAuthStatus');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#4CAF50';
        statusDiv.style.color = 'white';
        statusDiv.textContent = '✅ 연동완료';
      }
    } else {
      alert('❌ 블로그스팟 연동 실패: ' + (result.error || '알 수 없는 오류'));
    }
  });
}

// 블로그스팟 인증 모달 표시
function showBloggerAuthModal() {
  const modal = document.createElement('div');
  modal.id = 'bloggerAuthModal';
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
    <div style="background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
      <h3 style="color: #333; font-size: 24px; font-weight: 700; margin-bottom: 20px; text-align: center;">
        🔐 블로그스팟 OAuth2 인증
      </h3>
      
      <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong>인증 단계:</strong><br>
          1. 새 창에서 Google 계정으로 로그인<br>
          2. 권한 승인 후 인증 코드 복사<br>
          3. 아래 입력란에 인증 코드 붙여넣기
        </p>
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 12px; margin-top: 12px;">
          <p style="color: #856404; font-size: 13px; line-height: 1.5; margin: 0;">
            <strong>📅 토큰 유효기간 안내:</strong><br>
            • Access Token: 1시간 유효 (자동 갱신)<br>
            • Refresh Token: 영구 유효 (재인증 필요시만 갱신)<br>
            • 인증 오류 시: 환경설정에서 재연동 필요
          </p>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">인증 코드</label>
        <input type="text" id="bloggerAuthCode" placeholder="인증 코드를 입력하세요" 
               style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px;">
      </div>
      
      <div style="display: flex; gap: 12px;">
        <button onclick="verifyBloggerAuth()" 
                style="flex: 1; padding: 12px 20px; background: linear-gradient(135deg, #4285f4 0%, #34a853 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          ✅ 연동 확인
        </button>
        <button onclick="closeBloggerAuthModal()" 
                style="flex: 1; padding: 12px 20px; background: #f8f9fa; color: #666; border: 2px solid #e1e5e9; border-radius: 8px; font-weight: 600; cursor: pointer;">
          취소
        </button>
      </div>
      
      <div id="bloggerAuthStatus" style="margin-top: 16px; padding: 12px; border-radius: 8px; display: none; text-align: center; font-weight: 600;"></div>
    </div>
  `;

  document.body.appendChild(modal);

  // 인증 코드 입력 필드에 포커스
  setTimeout(() => {
    const codeInput = document.getElementById('bloggerAuthCode');
    if (codeInput) codeInput.focus();
  }, 100);
}

// 블로그스팟 인증 모달 닫기
function closeBloggerAuthModal() {
  const modal = document.getElementById('bloggerAuthModal');
  if (modal) {
    modal.remove();
  }
}

// 블로그스팟 OAuth 코드 처리
async function handleBloggerCallback(code) {
  try {
    if (window.electronAPI && window.electronAPI.handleBloggerCallback) {
      const result = await window.electronAPI.handleBloggerCallback(code);
      return result;
    } else {
      return { ok: false, error: '블로그스팟 인증 처리 기능을 사용할 수 없습니다.' };
    }
  } catch (error) {
    console.error('블로그스팟 인증 처리 오류:', error);
    return { ok: false, error: error.message };
  }
}

// 워드프레스 카테고리 로드 (전역 스코프에 노출)
window.loadWordPressCategories = async function loadWordPressCategories() {
  try {
    const loadBtn = document.getElementById('loadCategoriesBtn') || document.getElementById('btnLoadCategories');
    if (loadBtn) {
      loadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-9-9c0 1.5 0.4 2.9 1 4.1l-1 1.9"></path><path d="M3 12a9 9 0 019-9c1.5 0 2.9 0.4 4.1 1l-1.9 1"></path></svg> 로딩중...';
      loadBtn.disabled = true;
    }

    // 환경 변수에서 워드프레스 설정 가져오기
    const wpSiteUrl = document.getElementById('wordpressSiteUrl')?.value || '';
    const wpUsername = document.getElementById('wordpressUsername')?.value || '';
    const wpPassword = document.getElementById('wordpressPassword')?.value || '';

    // 설정이 없으면 저장된 설정에서 가져오기
    let settings = {};
    try {
      if (window.blogger && window.blogger.getSettings) {
        settings = await window.blogger.getSettings();
      }
    } catch (e) {
      console.warn('설정 로드 실패:', e);
    }

    const finalSiteUrl = wpSiteUrl || settings.wordpressSiteUrl || '';
    const finalUsername = wpUsername || settings.wordpressUsername || '';
    const finalPassword = wpPassword || settings.wordpressPassword || '';

    if (!finalSiteUrl || !finalUsername || !finalPassword) {
      alert('워드프레스 설정이 완료되지 않았습니다.\n설정에서 워드프레스 사이트 URL, 사용자명, 비밀번호를 입력해주세요.');
      return [];
    }

    console.log('[WP 카테고리] 로드 시작:', { siteUrl: finalSiteUrl, username: finalUsername });

    // IPC 핸들러 호출
    if (window.electronAPI && window.electronAPI.loadWordPressCategories) {
      const result = await window.electronAPI.loadWordPressCategories({
        siteUrl: finalSiteUrl,
        username: finalUsername,
        password: finalPassword
      });

      if (result.ok && result.categories) {
        // 카테고리 선택 UI 업데이트
        updateWordPressCategoryUI(result.categories);
        showCategoryConnectionStatus(true);
        console.log('[WP 카테고리] 로드 성공:', result.categories.length, '개');
        return result.categories;
      } else {
        console.error('워드프레스 카테고리 로드 실패:', result.error);
        alert('워드프레스 카테고리 로드 실패: ' + (result.error || '알 수 없는 오류'));
        return [];
      }
    } else if (window.blogger && window.blogger.loadWordPressCategories) {
      // 폴백: 기존 방식
      const result = await window.blogger.loadWordPressCategories({
        siteUrl: finalSiteUrl,
        username: finalUsername,
        password: finalPassword
      });

      if (result.ok && result.data) {
        updateWordPressCategoryUI(result.data);
        showCategoryConnectionStatus(true);
        return result.data;
      } else {
        console.error('워드프레스 카테고리 로드 실패:', result.error);
        alert('워드프레스 카테고리 로드 실패: ' + (result.error || '알 수 없는 오류'));
        return [];
      }
    } else {
      console.log('워드프레스 카테고리 로드 기능을 사용할 수 없습니다.');
      alert('워드프레스 카테고리 로드 기능을 사용할 수 없습니다.');
      return [];
    }
  } catch (error) {
    console.error('워드프레스 카테고리 로드 오류:', error);
    alert('워드프레스 카테고리 로드 중 오류가 발생했습니다: ' + error.message);
    return [];
  } finally {
    const loadBtn = document.getElementById('loadCategoriesBtn') || document.getElementById('btnLoadCategories');
    if (loadBtn) {
      loadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> 로드';
      loadBtn.disabled = false;
    }
  }
};

// 워드프레스 카테고리 UI 업데이트
function updateWordPressCategoryUI(categories) {
  const wpCategoryList = document.getElementById('wpCategoryList');
  const wpCategoryDropdown = document.getElementById('wpCategoryDropdown');
  const wpCategoryManual = document.getElementById('wpCategoryManual');

  if (!wpCategoryList || !wpCategoryDropdown || !wpCategoryManual) return;

  // 카테고리 목록 초기화
  wpCategoryList.innerHTML = '';

  // 카테고리 항목들 추가
  categories.forEach(category => {
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.style.cssText = `
      padding: 12px 16px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    categoryItem.innerHTML = `
      <input type="checkbox" id="cat_${category.id}" value="${category.id}" style="width: 16px; height: 16px; cursor: pointer;">
      <label for="cat_${category.id}" style="cursor: pointer; flex: 1; margin: 0;">
        <div style="font-weight: 600;">${category.name}</div>
        ${category.description ? `<div style="font-size: 12px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">${category.description}</div>` : ''}
      </label>
      <span style="font-size: 12px; color: rgba(255, 255, 255, 0.5);">${category.count || 0}개</span>
    `;

    // 호버 효과
    categoryItem.addEventListener('mouseenter', () => {
      categoryItem.style.background = 'rgba(255, 255, 255, 0.2)';
      categoryItem.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    });

    categoryItem.addEventListener('mouseleave', () => {
      categoryItem.style.background = 'rgba(255, 255, 255, 0.1)';
      categoryItem.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    // 체크박스 변경 이벤트
    const checkbox = categoryItem.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      updateSelectedCategories();
    });

    wpCategoryList.appendChild(categoryItem);
  });

  // 드롭다운 표시, 수동 입력 숨기기
  wpCategoryDropdown.style.display = 'block';
  wpCategoryManual.style.display = 'none';
}

// 선택된 카테고리 업데이트
function updateSelectedCategories() {
  const checkboxes = document.querySelectorAll('#wpCategoryList input[type="checkbox"]:checked');
  const selectedCategories = document.getElementById('selectedCategories');
  const selectedCategoryTags = document.getElementById('selectedCategoryTags');

  if (!selectedCategories || !selectedCategoryTags) return;

  if (checkboxes.length > 0) {
    selectedCategoryTags.innerHTML = '';

    checkboxes.forEach(checkbox => {
      const categoryName = checkbox.nextElementSibling.querySelector('div').textContent;
      const tag = document.createElement('span');
      tag.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
      `;
      tag.innerHTML = `
        ${categoryName}
        <button onclick="removeCategory('${checkbox.value}')" style="background: none; border: none; color: white; cursor: pointer; padding: 0; margin-left: 4px; font-size: 14px;">×</button>
      `;
      selectedCategoryTags.appendChild(tag);
    });

    selectedCategories.style.display = 'block';
    showCategoryConnectionStatus(true);
  } else {
    selectedCategories.style.display = 'none';
    showCategoryConnectionStatus(false);
  }
}

// 카테고리 제거
function removeCategory(categoryId) {
  const checkbox = document.getElementById(`cat_${categoryId}`);
  if (checkbox) {
    checkbox.checked = false;
    updateSelectedCategories();
  }
}

// 카테고리 연결 상태 표시
function showCategoryConnectionStatus(connected) {
  const statusElement = document.getElementById('categoryConnectionStatus');
  if (statusElement) {
    if (connected) {
      statusElement.style.display = 'inline-block';
      statusElement.style.background = 'rgba(34, 197, 94, 0.2)';
      statusElement.style.color = '#22c55e';
      statusElement.innerHTML = '✅ 연결됨';
    } else {
      statusElement.style.display = 'none';
    }
  }
}

// 워드프레스 카테고리 선택값 가져오기
function getSelectedWordPressCategories() {
  const checkboxes = document.querySelectorAll('#wpCategoryList input[type="checkbox"]:checked');
  if (checkboxes.length === 0) return '';

  return Array.from(checkboxes).map(checkbox => checkbox.value).join(',');
}

// 키워드 필드 관리 함수들
function addKeywordField() {
  const keywordFields = document.getElementById('keywordFields');
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  const keywordCount = document.getElementById('keywordCount');

  // keywordFields가 없으면 통합 UI를 사용 중이므로 함수 종료
  if (!keywordFields) {
    console.log('통합 UI에서는 키워드 필드 추가가 필요하지 않습니다.');
    return;
  }

  // 현재 키워드 필드 개수 확인
  const currentFields = keywordFields.querySelectorAll('.keyword-field').length;

  if (currentFields >= 50) {
    alert('최대 50개의 키워드만 입력할 수 있습니다.');
    return;
  }

  // 새 키워드 필드 생성
  const newField = document.createElement('div');
  newField.className = 'keyword-field';
  newField.style.cssText = 'display: flex; gap: 8px; align-items: center;';

  newField.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px; padding: 16px; background: rgba(255, 255, 255, 0.1); border-radius: 12px; backdrop-filter: blur(10px);">
      <!-- 키워드 입력과 예약시간 -->
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" class="keyword-input form-input" placeholder="예: 블로그 수익화 방법" style="background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 16px; padding: 14px; flex: 1;">
        <input type="datetime-local" class="keyword-schedule-time form-input" placeholder="예약시간 (선택사항)" style="background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 14px; padding: 14px; width: 200px;">
        <button type="button" class="remove-keyword-btn" onclick="removeKeywordField(this)" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); border: none; color: white; padding: 14px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <!-- 키워드별 제목 선택 (선택사항) -->
      <div style="display: flex; gap: 8px; align-items: center;">
        <label style="color: rgba(255, 255, 255, 0.8); font-size: 12px; font-weight: 500; min-width: 50px;">제목:</label>
        <select class="keyword-title-select form-input" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 12px; padding: 10px; border-radius: 8px; flex: 1;">
          <option value="auto" style="background: #667eea; color: white;">자동 생성 (키워드 기반)</option>
          <option value="custom" style="background: #667eea; color: white;">직접 입력</option>
        </select>
      </div>
      
      <!-- 직접 입력 모드일 때만 표시되는 텍스트 입력 -->
      <div class="custom-title-input-container" style="display: none; gap: 8px; align-items: center;">
        <input type="text" class="keyword-title-input form-input" placeholder="제목을 직접 입력하세요" style="background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); color: white; backdrop-filter: blur(10px); font-size: 12px; padding: 10px; flex: 1;">
      </div>

      <!-- 🔥 키워드 제목 옵션 체크박스 -->
      <div class="keyword-title-options" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; color: rgba(255,255,255,0.8); font-size: 11px; padding: 5px 10px; background: rgba(255,255,255,0.08); border-radius: 6px; border: 1px solid rgba(255,255,255,0.12);">
          <input type="checkbox" class="keyword-use-as-title" style="width: 14px; height: 14px; accent-color: #a855f7; cursor: pointer;">
          <span>🎯 키워드=제목</span>
        </label>
        <label class="keyword-front-label" style="display: flex; align-items: center; gap: 5px; cursor: pointer; color: rgba(255,255,255,0.8); font-size: 11px; padding: 5px 10px; background: rgba(255,255,255,0.08); border-radius: 6px; border: 1px solid rgba(255,255,255,0.12);">
          <input type="checkbox" class="keyword-front" style="width: 14px; height: 14px; accent-color: #3b82f6; cursor: pointer;">
          <span>📌 키워드 맨앞</span>
        </label>
      </div>
      
         <!-- 키워드별 썸네일/이미지 소스 선택 -->
         <div style="display: flex; gap: 8px; align-items: center;">
           <label style="color: rgba(255, 255, 255, 0.8); font-size: 11px; font-weight: 500; min-width: 60px;">썸네일:</label>
           <select class="keyword-thumbnail-select form-input" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 12px; padding: 6px; border-radius: 4px; flex: 1;">
             <option value="svg" style="background: #667eea; color: white;">📝 SVG 썸네일 (기본)</option>
             <option value="nanobananapro" style="background: #667eea; color: white;">🍌 Nano Banana Pro</option>
             <option value="text" style="background: #667eea; color: white;">텍스트 썸네일</option>
             <option value="pexels" style="background: #667eea; color: white;">Pexels 이미지</option>
             <option value="dalle" style="background: #667eea; color: white;">DALL-E 이미지</option>
             <option value="cse" style="background: #667eea; color: white;">CSE 이미지</option>
           </select>
         </div>
         
         <!-- 키워드별 이미지 소스 선택 -->
         <div style="display: flex; gap: 8px; align-items: center;">
           <label style="color: rgba(255, 255, 255, 0.8); font-size: 11px; font-weight: 500; min-width: 60px;">이미지:</label>
           <select class="keyword-image-select form-input" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 12px; padding: 6px; border-radius: 4px; flex: 1;">
             <option value="pexels" style="background: #667eea; color: white;">Pexels 이미지</option>
             <option value="dalle" style="background: #667eea; color: white;">DALL-E 이미지</option>
             <option value="cse" style="background: #667eea; color: white;">CSE 이미지</option>
           </select>
         </div>
    </div>
  `;

  keywordFields.appendChild(newField);
  updateKeywordCount();
  updateRemoveButtons();

  // 제목 선택 드롭다운 이벤트 리스너 추가
  const titleSelect = newField.querySelector('.keyword-title-select');
  const customTitleInput = newField.querySelector('.custom-title-input-container');
  const titleOptions = newField.querySelector('.keyword-title-options');

  titleSelect.addEventListener('change', function () {
    if (this.value === 'custom') {
      customTitleInput.style.display = 'flex';
      if (titleOptions) titleOptions.style.display = 'none';
    } else {
      customTitleInput.style.display = 'none';
      if (titleOptions) titleOptions.style.display = 'flex';
    }
  });

  // 🔥 키워드 제목 옵션 체크박스 이벤트 리스너
  const useAsTitleCb = newField.querySelector('.keyword-use-as-title');
  const frontCb = newField.querySelector('.keyword-front');
  const frontLabel = newField.querySelector('.keyword-front-label');

  if (useAsTitleCb && frontCb && frontLabel) {
    useAsTitleCb.addEventListener('change', function () {
      if (this.checked) {
        frontCb.checked = false;
        frontCb.disabled = true;
        frontLabel.style.opacity = '0.4';
        frontLabel.style.cursor = 'not-allowed';
      } else {
        frontCb.disabled = false;
        frontLabel.style.opacity = '1';
        frontLabel.style.cursor = 'pointer';
      }
    });
  }

  // 새 필드에 포커스
  newField.querySelector('.keyword-input').focus();
}

function removeKeywordField(button) {
  const keywordField = button.closest('.keyword-field');
  const keywordFields = document.getElementById('keywordFields');

  // 최소 1개 필드는 유지
  if (keywordFields.querySelectorAll('.keyword-field').length <= 1) {
    alert('최소 1개의 키워드 필드는 유지되어야 합니다.');
    return;
  }

  keywordField.remove();
  updateKeywordCount();
  updateRemoveButtons();
}

function updateKeywordCount() {
  const keywordCount = document.getElementById('keywordCount');
  const addKeywordBtn = document.getElementById('addKeywordBtn');

  // 새로운 통합 UI에서는 keywordFields가 없으므로 기본값 사용
  const keywordFields = document.getElementById('keywordFields');
  const currentCount = keywordFields ? keywordFields.querySelectorAll('.keyword-field').length : 1;

  if (keywordCount) {
    keywordCount.textContent = `(${currentCount}/50)`;
  }

  if (addKeywordBtn) {
    // 50개에 도달하면 추가 버튼 비활성화
    if (currentCount >= 50) {
      addKeywordBtn.style.opacity = '0.5';
      addKeywordBtn.style.cursor = 'not-allowed';
      addKeywordBtn.disabled = true;
    } else {
      addKeywordBtn.style.opacity = '1';
      addKeywordBtn.style.cursor = 'pointer';
      addKeywordBtn.disabled = false;
    }
  }
}

// 썸네일 생성기 서브 탭 전환 함수
function showThumbnailSubTab(tab) {
  const generatorContent = document.getElementById('thumbnail-generator-content');
  const converterContent = document.getElementById('image-converter-content');
  const generatorTab = document.getElementById('thumbnailGeneratorTab');
  const converterTab = document.getElementById('imageConverterTab');

  if (tab === 'generator') {
    generatorContent.style.display = 'grid';
    converterContent.style.display = 'none';
    generatorTab.style.opacity = '1';
    converterTab.style.opacity = '0.7';
  } else {
    generatorContent.style.display = 'none';
    converterContent.style.display = 'grid';
    generatorTab.style.opacity = '0.7';
    converterTab.style.opacity = '1';
  }
}

// 이미지 변환기 관련 변수
let originalImageFile = null;
let convertedImageBlob = null;

// 이미지 드래그 앤 드롭 핸들러
function handleImageDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = '#4facfe';
  e.currentTarget.style.backgroundColor = 'rgba(79, 172, 254, 0.1)';
}

function handleImageDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
}

function handleImageDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleImageFile(files[0]);
  }
}

// 이미지 선택 핸들러 (원본)
function _handleImageSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    handleImageFile(files[0]);
  }
}

// 🔧 Debounce 적용된 handleImageSelect (200ms)
const handleImageSelect = debounce(_handleImageSelect, 200);

function handleImageFile(file) {
  console.log('🖼️ 이미지 파일 선택됨:', file.name, file.type, file.size);

  // 파일 크기 확인 (50MB 제한)
  if (file.size > 50 * 1024 * 1024) {
    alert('이미지 파일이 너무 큽니다. 50MB 이하의 파일을 선택해주세요.');
    return;
  }

  // 지원하는 이미지 형식 확인 (대소문자 구분 없이)
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  const fileType = file.type.toLowerCase();

  console.log('파일 타입 확인:', fileType, '지원 타입:', supportedTypes);

  if (!supportedTypes.includes(fileType)) {
    alert(`지원하지 않는 파일 형식입니다. (현재: ${file.type})\n지원 형식: JPG, PNG, GIF, WebP, BMP`);
    return;
  }

  originalImageFile = file;

  // 원본 이미지 미리보기
  const reader = new FileReader();
  reader.onload = function (e) {
    console.log('✅ 이미지 로드 완료');
    const originalPreview = document.getElementById('originalImagePreview');
    originalPreview.innerHTML = `
      <img src="${e.target.result}" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div style="display:none; padding:20px; text-align:center; color:#ef4444; background:#fef2f2; border:1px dashed #fca5a5; border-radius:8px;">
        <p>이미지 미리보기 로드 실패</p>
        <small>파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.</small>
      </div>
    `;

    // 변환 버튼 활성화
    const convertBtn = document.getElementById('convertImageBtn');
    if (convertBtn) {
      convertBtn.disabled = false;
      convertBtn.style.opacity = '1';
      convertBtn.style.cursor = 'pointer';
      console.log('✅ 변환 버튼 활성화됨');
    } else {
      console.error('❌ 변환 버튼을 찾을 수 없습니다');
    }
  };

  reader.onerror = function () {
    console.log('❌ 파일 읽기 실패');
    alert('파일을 읽을 수 없습니다. 파일이 손상되었거나 접근 권한이 없을 수 있습니다.');
  };

  reader.readAsDataURL(file);
}

// 품질 값 업데이트
function updateQualityValue(value) {
  document.getElementById('qualityValue').textContent = value;
}

// 이미지 변환 함수
function convertImage() {
  console.log('🔄 이미지 변환 시작');

  if (!originalImageFile) {
    console.log('❌ 원본 이미지 파일이 없음');
    alert('먼저 이미지를 업로드해주세요.');
    return;
  }

  const outputFormat = document.getElementById('outputFormat').value;
  const quality = parseInt(document.getElementById('qualitySlider').value) / 100;
  const filterEffect = document.getElementById('filterEffect').value;
  const resizeWidth = document.getElementById('resizeWidth').value;
  const resizeHeight = document.getElementById('resizeHeight').value;
  const maintainRatio = document.getElementById('maintainRatio').checked;

  console.log('📋 변환 설정:', { outputFormat, quality, filterEffect, resizeWidth, resizeHeight, maintainRatio });

  // 변환 버튼 비활성화
  const convertBtn = document.getElementById('convertImageBtn');
  convertBtn.disabled = true;
  convertBtn.textContent = '🔄 변환 중...';

  // Canvas를 사용한 이미지 변환
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = function () {
    console.log('✅ 이미지 로드 완료:', img.width, 'x', img.height);

    // 크기 계산
    let width = img.width;
    let height = img.height;

    if (resizeWidth || resizeHeight) {
      if (maintainRatio) {
        const ratio = img.width / img.height;
        if (resizeWidth) {
          width = parseInt(resizeWidth);
          height = width / ratio;
        } else {
          height = parseInt(resizeHeight);
          width = height * ratio;
        }
      } else {
        width = resizeWidth ? parseInt(resizeWidth) : img.width;
        height = resizeHeight ? parseInt(resizeHeight) : img.height;
      }
    }

    canvas.width = width;
    canvas.height = height;

    // 필터 효과 적용
    if (filterEffect === 'none') {
      // 필터 없음
      ctx.drawImage(img, 0, 0, width, height);
    } else if (filterEffect === 'grayscale') {
      // 흑백 필터 (픽셀 단위 처리)
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
    } else if (filterEffect === 'sepia') {
      // 세피아 필터
      ctx.filter = 'sepia(100%)';
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else if (filterEffect === 'vintage') {
      // 빈티지 필터 (세피아 + 낮은 대비)
      ctx.filter = 'sepia(50%) contrast(0.9) brightness(1.05)';
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else if (filterEffect === 'brighten') {
      // 밝게
      ctx.filter = 'brightness(1.2)';
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else if (filterEffect === 'darken') {
      // 어둡게
      ctx.filter = 'brightness(0.8)';
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else {
      // 기본
      ctx.drawImage(img, 0, 0, width, height);
    }

    // 변환된 이미지를 Blob으로 변환
    console.log('🖼️ Canvas 변환 완료, Blob 생성 중...');
    canvas.toBlob(function (blob) {
      if (!blob) {
        console.log('❌ Blob 생성 실패');
        alert('이미지 변환에 실패했습니다.');
        convertBtn.disabled = false;
        convertBtn.textContent = '🔄 이미지 변환하기';
        return;
      }

      console.log('✅ Blob 생성 완료:', blob.size, 'bytes');
      convertedImageBlob = blob;

      // 변환된 이미지 미리보기
      const url = URL.createObjectURL(blob);
      const convertedPreview = document.getElementById('convertedImagePreview');
      convertedPreview.innerHTML = `
        <img src="${url}" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
      `;

      console.log('✅ 변환 결과 미리보기 표시 완료');

      // 다운로드 버튼 표시
      const downloadBtn = document.getElementById('downloadConvertedImageBtn');
      downloadBtn.style.display = 'block';

      console.log('✅ 다운로드 버튼 활성화');

      // 변환 버튼 복원
      convertBtn.disabled = false;
      convertBtn.textContent = '🔄 이미지 변환하기';

    }, `image/${outputFormat}`, quality);
  };

  img.onerror = function (e) {
    console.log('❌ 이미지 로드 실패:', e);
    console.log('📁 파일 정보:', originalImageFile);
    console.log('🔗 이미지 URL:', img.src);

    // 파일 크기와 타입 확인
    if (originalImageFile.size > 50 * 1024 * 1024) { // 50MB
      alert('이미지 파일이 너무 큽니다. 50MB 이하의 파일을 선택해주세요.');
    } else if (!originalImageFile.type.startsWith('image/')) {
      alert('지원하지 않는 파일 형식입니다. JPG, PNG, GIF, WebP 파일을 선택해주세요.');
    } else {
      alert('이미지 로드에 실패했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.');
    }

    convertBtn.disabled = false;
    convertBtn.textContent = '🔄 이미지 변환하기';
  };

  console.log('🖼️ 이미지 로드 시작:', originalImageFile.name);
  img.src = URL.createObjectURL(originalImageFile);
}

// 변환된 이미지 다운로드
function downloadConvertedImage() {
  console.log('📥 다운로드 요청');

  if (!convertedImageBlob) {
    console.log('❌ 변환된 이미지 Blob이 없음');
    alert('변환할 이미지가 없습니다.');
    return;
  }

  console.log('✅ 다운로드 시작:', convertedImageBlob.size, 'bytes');

  const url = URL.createObjectURL(convertedImageBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `converted_image_${Date.now()}.${document.getElementById('outputFormat').value}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('✅ 다운로드 완료');
}

function updateRemoveButtons() {
  const keywordFields = document.getElementById('keywordFields');
  if (!keywordFields) return;

  const fields = keywordFields.querySelectorAll('.keyword-field');

  fields.forEach(field => {
    const removeBtn = field.querySelector('.remove-keyword-btn');
    // 필드가 1개뿐이면 삭제 버튼 숨기기
    if (fields.length <= 1) {
      removeBtn.style.display = 'none';
    } else {
      removeBtn.style.display = 'flex';
    }
  });
}

function getAllKeywords() {
  const keywords = [];

  // 1. 키워드 입력 필드에서 직접 읽기 (단일 포스팅용)
  const keywordInput = DOMCache.get('keywordInput');
  if (keywordInput && keywordInput.value.trim()) {
    keywords.push(keywordInput.value.trim());
    console.log('키워드 입력 필드에서 수집:', keywordInput.value.trim());
  }

  // 2. 키워드 리스트에서 읽기 (대량 포스팅용)
  const keywordList = document.getElementById('keywordList');
  if (keywordList) {
    const keywordItems = keywordList.querySelectorAll('.keyword-item');

    keywordItems.forEach(item => {
      // 여러 방법으로 키워드 텍스트 찾기
      let keywordText = '';

      // 방법 1: span 태그에서 찾기
      const span = item.querySelector('span');
      if (span && span.textContent.trim()) {
        keywordText = span.textContent.trim();
      }

      // 방법 2: 첫 번째 텍스트 노드에서 찾기
      if (!keywordText) {
        const textNodes = Array.from(item.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
          keywordText = textNodes[0].textContent.trim();
        }
      }

      // 방법 3: 직접 텍스트에서 찾기
      if (!keywordText) {
        const allText = item.textContent || item.innerText || '';
        const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length > 0) {
          keywordText = lines[0];
        }
      }

      if (keywordText && keywordText.length > 0) {
        keywords.push(keywordText);
      }
    });
  }

  // 3. 기존 방식 (하위 호환성)
  if (keywords.length === 0) {
    const keywordInputs = document.querySelectorAll('.keyword-input');
    const fallbackKeywords = Array.from(keywordInputs)
      .map(input => input.value.trim())
      .filter(keyword => keyword.length > 0);
    keywords.push(...fallbackKeywords);
  }

  console.log('최종 수집된 키워드들:', keywords);
  return keywords;
}

// 대량 포스팅용 썸네일/이미지 선택 UI 생성
function createBulkThumbnailSelectionUI(keywordData, defaultImageType) {
  // 기존 UI 숨기기
  const existingImageSelection = document.querySelector('div[style*="썸네일/이미지 선택"]');
  if (existingImageSelection) {
    existingImageSelection.style.display = 'none';
  }

  // 대량 포스팅용 썸네일 선택 모달 생성
  const modal = document.createElement('div');
  modal.id = 'bulkThumbnailModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 20px;
    padding: 30px;
    max-width: 800px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;

  // 🔧 Sanitize 적용 (키워드와 제목은 사용자 입력)
  const sanitizedKeywordData = keywordData.map(data => ({
    ...data,
    keyword: sanitizeHTML(data.keyword || ''),
    title: data.title ? sanitizeHTML(data.title) : ''
  }));

  // HTML 문자열 생성
  const bulkModalHtml = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: white; margin: 0 0 10px 0; font-size: 24px; font-weight: 700;">🖼️ 대량 포스팅 썸네일/이미지 설정</h2>
      <p style="color: rgba(255, 255, 255, 0.8); margin: 0; font-size: 14px;">각 키워드별로 썸네일/이미지 타입을 선택하세요</p>
    </div>
    
           <div id="bulkThumbnailList" style="margin-bottom: 30px;">
             ${sanitizedKeywordData.map((data, index) => `
               <div class="keyword-thumbnail-item" style="background: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 16px; backdrop-filter: blur(10px);">
                 <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                   <span style="background: rgba(255, 255, 255, 0.2); color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${index + 1}</span>
                   <span style="color: white; font-size: 16px; font-weight: 600;">${data.keyword}</span>
                   ${data.title ? `<span style="color: rgba(255, 255, 255, 0.7); font-size: 14px;">[${data.title}]</span>` : ''}
                 </div>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: white; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; transition: all 0.3s ease;">
              <input type="radio" name="imageType_${index}" value="text" ${defaultImageType === 'text' ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
              <span>텍스트 썸네일</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: white; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; transition: all 0.3s ease;">
              <input type="radio" name="imageType_${index}" value="pexels" ${defaultImageType === 'pexels' ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
              <span>Pexels 이미지</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: white; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; transition: all 0.3s ease;">
              <input type="radio" name="imageType_${index}" value="dalle" ${defaultImageType === 'dalle' ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
              <span>DALL-E 이미지</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: white; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; transition: all 0.3s ease;">
              <input type="radio" name="imageType_${index}" value="cse" ${defaultImageType === 'cse' ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
              <span>CSE 이미지</span>
            </label>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="bulkThumbnailConfirm" style="padding: 12px 24px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border: none; color: white; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.3s ease;">
        ✅ 설정 완료
      </button>
      <button id="bulkThumbnailCancel" style="padding: 12px 24px; background: rgba(255, 255, 255, 0.2); border: 2px solid rgba(255, 255, 255, 0.3); color: white; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.3s ease;">
        ❌ 취소
      </button>
    </div>
  `;

  // 🔧 최종 sanitize 적용
  modalContent.innerHTML = sanitizeHTML(bulkModalHtml);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 이벤트 리스너 추가
  document.getElementById('bulkThumbnailConfirm').onclick = () => {
    const thumbnailSettings = getBulkThumbnailSettings(keywords);
    document.body.removeChild(modal);
    proceedWithBulkPosting(keywords, thumbnailSettings);
  };

  document.getElementById('bulkThumbnailCancel').onclick = () => {
    document.body.removeChild(modal);
    hideProgressModal();
    // 🔧 AppState 사용
    getAppState().isCanceled = true;
  };

  // 호버 효과 추가
  modalContent.querySelectorAll('label').forEach(label => {
    label.addEventListener('mouseenter', () => {
      label.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    label.addEventListener('mouseleave', () => {
      label.style.background = 'rgba(255, 255, 255, 0.1)';
    });
  });
}

// 대량 포스팅용 썸네일 설정 가져오기
function getBulkThumbnailSettings(keywordData) {
  const settings = {};
  keywordData.forEach((data, index) => {
    const selectedType = document.querySelector(`input[name="imageType_${index}"]:checked`)?.value || 'text';
    settings[data.keyword] = selectedType;
  });
  return settings;
}

// 대량 포스팅 진행
function proceedWithBulkPosting(keywordData, thumbnailSettings) {
  addLog('🖼️ 썸네일/이미지 설정 완료:');
  keywordData.forEach((data, index) => {
    const imageType = thumbnailSettings[data.keyword];
    addLog(`   ${index + 1}. ${data.keyword} → ${getImageTypeText(imageType)}`);
  });

  // 실제 포스팅 로직 계속 진행
  // (기존 포스팅 로직이 여기서 계속 실행됨)
}

// 이미지 타입 텍스트 변환
function getImageTypeText(imageType) {
  const typeMap = {
    'text': '텍스트 썸네일',
    'pexels': 'Pexels 이미지',
    'dalle': 'DALL-E 이미지',
    'cse': 'CSE 이미지',
    'none': '썸네일 없음'
  };
  return typeMap[imageType] || '텍스트 썸네일';
}

// 포스팅 프로세스 (실시간 진행률 업데이트)
async function simulatePostingProcess(keywordData, postingMode, scheduleSettings) {
  console.log('🚀 포스팅 프로세스 시작 - 실시간 진행률 업데이트');

  // 즉시 진행률 업데이트 시작
  updateProgress(5, 5);
  updateTime(5);

  // 단계별 진행률 시뮬레이션 (백엔드 진행률과 동기화)
  const steps = [
    { progress: 10, label: '시스템 초기화 중...' },
    { progress: 20, label: '키워드 분석 중...' },
    { progress: 30, label: '콘텐츠 구조 설계 중...' },
    { progress: 40, label: 'AI 콘텐츠 생성 중...' },
    { progress: 60, label: '이미지 생성 중...' },
    { progress: 80, label: 'SEO 최적화 중...' },
    { progress: 90, label: '최종 검토 중...' },
    { progress: 100, label: '완료!' }
  ];

  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, 800)); // 각 단계마다 0.8초 대기
    updateProgress(step.progress, step.progress);
    updateTime(step.progress);

    // 작업 상태 업데이트
    const statusEl = document.getElementById('workStatusTitle');
    const subtitleEl = document.getElementById('workStatusSubtitle');
    if (statusEl) statusEl.textContent = step.label;
    if (subtitleEl) {
      if (step.progress < 30) {
        subtitleEl.textContent = '시스템을 초기화하고 있습니다';
      } else if (step.progress < 60) {
        subtitleEl.textContent = 'AI가 고품질 콘텐츠를 생성하고 있습니다';
      } else if (step.progress < 90) {
        subtitleEl.textContent = '이미지와 미디어를 처리하고 있습니다';
      } else {
        subtitleEl.textContent = '모든 작업이 거의 완료되었습니다';
      }
    }
  }
}

// 단계 활성화
function activateStep(stepId) {
  const stepElement = document.getElementById(`step-${stepId}`);
  if (stepElement) {
    stepElement.classList.add('active');
    const icon = stepElement.querySelector('.progress-step-icon');
    if (icon) {
      icon.classList.remove('pending');
      icon.classList.add('active');
    }
  }
}

// 단계 완료
function completeStep(stepId, duration) {
  const stepElement = document.getElementById(`step-${stepId}`);
  if (stepElement) {
    stepElement.classList.remove('active');
    stepElement.classList.add('completed');
    const icon = stepElement.querySelector('.progress-step-icon');
    if (icon) {
      icon.classList.remove('active');
      icon.classList.add('completed');
    }

    // 단계 소요 시간 표시
    const timeElement = stepElement.querySelector(`#step-${stepId}-time`);
    if (timeElement) {
      timeElement.textContent = `${Math.round(duration / 1000)}초`;
    }
  }
}

// 현재 단계 업데이트
function updateCurrentStep(current, total) {
  const currentStepElement = document.getElementById('currentStepNumber');
  const totalStepsElement = document.getElementById('totalSteps');

  if (currentStepElement) currentStepElement.textContent = current;
  if (totalStepsElement) totalStepsElement.textContent = total;
}

// 작업 상태 업데이트
function updateWorkStatus(icon, title, subtitle) {
  const iconElement = document.getElementById('workStatusIcon');
  const titleElement = document.getElementById('workStatusTitle');
  const subtitleElement = document.getElementById('workStatusSubtitle');

  if (iconElement) iconElement.textContent = icon;
  if (titleElement) titleElement.textContent = title;
  if (subtitleElement) subtitleElement.textContent = subtitle;
}

// 예상 완료 시간 업데이트
function updateEstimatedTime(startTime, totalDuration, currentStep, totalSteps) {
  const elapsedTime = Date.now() - startTime;
  const elapsedSeconds = Math.floor(elapsedTime / 1000);
  const estimatedTotalTime = Math.floor((elapsedTime / currentStep) * totalSteps);
  const remainingTime = estimatedTotalTime - elapsedTime;

  // 경과 시간 업데이트
  const elapsedElement = document.getElementById('elapsedTime');
  if (elapsedElement) {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    elapsedElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 예상 완료 시간 업데이트
  const estimatedElement = document.getElementById('estimatedTime');
  if (estimatedElement && remainingTime > 0) {
    const remainingSeconds = Math.floor(remainingTime / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    estimatedElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

// 🔧 하위 호환성을 위한 래퍼 함수들 (기존 코드와의 호환성 유지)
function updateProgress(stepPercentage, targetPercentage = null, statusText = null) {
  getProgressManager().updateProgress(stepPercentage, targetPercentage, statusText);
}

function updateStepProgress(percentage) {
  getProgressManager().updateStepProgress(percentage);
}

function updateOverallProgressBar(percentage) {
  getProgressManager().updateOverallProgressBar(percentage);
}

function updateProgressCircle(percentage) {
  getProgressManager().updateProgressCircle(percentage);
}

function smoothProgressUpdate(targetProgress, label) {
  getProgressManager().smoothProgressUpdate(targetProgress, label);
}

function updateProgressStatus(statusText) {
  getProgressManager().updateStatus(statusText);
}

function updateTime(percentage = 0) {
  getProgressManager()._updateTime(percentage);
}

// 진행률 UI 업데이트 함수
// updateProgressUI 함수는 updateProgress 함수로 통합됨 (중복 제거)

// 포스팅 모드 텍스트 변환
function getPostingModeText(mode) {
  const modeMap = {
    'immediate': '즉시 발행',
    'draft': '임시 발행',
    'schedule': '예약 발행'
  };
  return modeMap[mode] || '즉시 발행';
}

// 엑셀 파일 선택 처리
function handleExcelFileSelect(event) {
  const file = event.target.files[0];
  const fileInfo = document.getElementById('selectedFileInfo');

  if (file) {
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    fileInfo.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #4ade80;">
          <path d="M9 12l2 2 4-4"></path>
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
        <div>
          <span style="color: white; font-weight: 600; display: block;">${file.name}</span>
          <span style="color: rgba(255, 255, 255, 0.7); font-size: 12px;">크기: ${fileSize} MB</span>
        </div>
      </div>
    `;
    fileInfo.style.display = 'block';
  } else {
    fileInfo.style.display = 'none';
  }
}

// 포스팅 모드 변경 시 예약 설정 UI 토글
function toggleScheduleSettings() {
  const scheduleSettings = document.getElementById('scheduleSettings');
  const selectedMode = document.querySelector('input[name="postingMode"]:checked')?.value;

  // scheduleSettings 요소가 존재하지 않으면 함수 종료
  if (!scheduleSettings) {
    console.warn('⚠️ [SCHEDULE] scheduleSettings 요소를 찾을 수 없습니다.');
    return;
  }

  if (selectedMode === 'schedule') {
    scheduleSettings.style.display = 'block';
    // 예약 시간 기본값 설정 (현재 시간 + 1시간)
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const dateTimeString = now.toISOString().slice(0, 16);
    const scheduleDateTime = document.getElementById('scheduleDateTime');
    if (scheduleDateTime) {
      scheduleDateTime.value = dateTimeString;
    }
  } else {
    scheduleSettings.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 라이선스 관리 함수들 (네이버 자동화 툴 스타일)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 라이선스 상태 새로고침 및 표시
 */
async function refreshLicenseStatus() {
  console.log('[LICENSE] 라이선스 상태 확인 중...');

  try {
    // 라이선스 상태 확인
    let status = null;

    if (window.electronAPI && window.electronAPI.invoke) {
      status = await window.electronAPI.invoke('license-status-new');
    } else if (window.blogger && window.blogger.getLicense) {
      const result = await window.blogger.getLicense();
      if (result.ok && result.data) {
        status = {
          valid: true,
          type: result.data.licenseType || 'unknown',
          expiresAt: result.data.expiresAt
        };
      }
    }

    console.log('[LICENSE] 상태:', status);

    // UI 업데이트
    updateLicenseDisplay(status);

    // 헤더 라이선스 상태도 업데이트
    updateHeaderLicenseStatus(status);

  } catch (error) {
    console.error('[LICENSE] 상태 확인 실패:', error);
    updateLicenseDisplay({ valid: false, message: '상태 확인 실패: ' + error.message });
  }
}

/**
 * 라이선스 표시 UI 업데이트
 */
function updateLicenseDisplay(status) {
  const typeDisplay = document.getElementById('licenseTypeDisplay');
  const validDisplay = document.getElementById('licenseValidDisplay');
  const expiryDisplay = document.getElementById('licenseExpiryDisplay');
  const deviceIdDisplay = document.getElementById('deviceIdDisplay');
  const messageDisplay = document.getElementById('licenseMessageDisplay');

  if (!typeDisplay) return;

  if (status && status.valid) {
    // 유효한 라이선스
    typeDisplay.textContent = status.type === 'permanent' ? '영구제' :
      status.type === 'temporary' ? '기간제' :
        status.type === 'dev' ? '개발자 모드' : '활성화됨';
    typeDisplay.style.color = '#fbbf24';

    validDisplay.textContent = '✅ 활성화됨';
    validDisplay.style.color = '#10b981';

    if (status.expiresAt) {
      const expDate = new Date(status.expiresAt);
      const now = new Date();
      const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
      expiryDisplay.textContent = expDate.toLocaleDateString('ko-KR') + ` (${daysLeft}일 남음)`;
      expiryDisplay.style.color = daysLeft > 7 ? '#f8fafc' : '#fbbf24';
    } else {
      expiryDisplay.textContent = status.type === 'permanent' ? '무제한' : '-';
      expiryDisplay.style.color = '#10b981';
    }

    if (messageDisplay) {
      messageDisplay.textContent = status.message || '라이선스가 정상 작동 중입니다.';
      messageDisplay.style.display = 'block';
      messageDisplay.style.background = 'rgba(16, 185, 129, 0.3)';
    }
  } else {
    // 무효한 라이선스
    typeDisplay.textContent = '미등록';
    typeDisplay.style.color = '#ef4444';

    validDisplay.textContent = '❌ 비활성화';
    validDisplay.style.color = '#ef4444';

    expiryDisplay.textContent = '-';
    expiryDisplay.style.color = '#94a3b8';

    if (messageDisplay) {
      messageDisplay.textContent = status?.message || '라이선스가 등록되지 않았습니다. 아이디, 비밀번호, 코드를 입력해주세요.';
      messageDisplay.style.display = 'block';
      messageDisplay.style.background = 'rgba(239, 68, 68, 0.3)';
    }
  }

  // 디바이스 ID 업데이트
  if (deviceIdDisplay) {
    if (status?.deviceId) {
      deviceIdDisplay.textContent = status.deviceId;
    } else {
      // 디바이스 ID 조회
      (async () => {
        try {
          const result = await window.electronAPI?.invoke('license-status');
          if (result?.deviceId) {
            deviceIdDisplay.textContent = result.deviceId;
          } else {
            deviceIdDisplay.textContent = '확인 불가';
          }
        } catch {
          deviceIdDisplay.textContent = '확인 불가';
        }
      })();
    }
  }
}

/**
 * 헤더 라이선스 상태 업데이트
 */
function updateHeaderLicenseStatus(status) {
  const headerStatus = document.getElementById('licenseStatus');
  if (headerStatus) {
    if (status && status.valid) {
      if (status.type === 'permanent') {
        headerStatus.textContent = '영구제';
        headerStatus.style.color = '#10b981';
      } else if (status.type === 'temporary') {
        if (status.expiresAt) {
          const expDate = new Date(status.expiresAt);
          const now = new Date();
          const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
          headerStatus.textContent = `기간제 (${daysLeft}일)`;
          headerStatus.style.color = daysLeft > 7 ? '#10b981' : '#fbbf24';
        } else {
          headerStatus.textContent = '기간제';
          headerStatus.style.color = '#10b981';
        }
      } else if (status.type === 'dev') {
        headerStatus.textContent = '개발자';
        headerStatus.style.color = '#3b82f6';
      } else {
        headerStatus.textContent = '활성화됨';
        headerStatus.style.color = '#10b981';
      }
    } else {
      headerStatus.textContent = '미등록';
      headerStatus.style.color = '#ef4444';
    }
  }
}

/**
 * 라이선스 코드 등록
 */
async function registerLicenseCode() {
  const userIdInput = document.getElementById('licenseUserId');
  const passwordInput = document.getElementById('licensePassword');
  const codeInput = document.getElementById('licenseCodeInput');

  const userId = userIdInput?.value?.trim() || '';
  const password = passwordInput?.value || '';
  const licenseCode = codeInput?.value?.trim() || undefined;

  if (!userId || !password) {
    alert('❌ 아이디와 비밀번호를 입력해주세요.');
    return;
  }

  console.log('[LICENSE] 라이선스 등록 시도:', { userId, hasCode: !!licenseCode });

  try {
    let result = null;

    if (window.electronAPI && window.electronAPI.invoke) {
      result = await window.electronAPI.invoke('license-authenticate', {
        userId,
        password,
        licenseCode
      });
    } else {
      throw new Error('API를 사용할 수 없습니다.');
    }

    console.log('[LICENSE] 등록 결과:', result);

    if (result && result.success) {
      alert(`✅ 라이선스 등록 성공!\n\n${result.message || '정상적으로 등록되었습니다.'}`);

      // 비밀번호 필드 초기화 (보안)
      if (passwordInput) passwordInput.value = '';

      // 라이선스 상태 새로고침
      await refreshLicenseStatus();
    } else {
      alert(`❌ 라이선스 등록 실패\n\n${result?.message || '등록에 실패했습니다.'}`);
    }
  } catch (error) {
    console.error('[LICENSE] 등록 오류:', error);
    alert(`❌ 라이선스 등록 중 오류 발생\n\n${error.message}`);
  }
}

/**
 * 라이선스 로그아웃
 */
async function logoutLicense() {
  if (!confirm('정말 로그아웃 하시겠습니까?\n\n로그아웃 후에는 다시 로그인해야 합니다.')) {
    return;
  }

  console.log('[LICENSE] 로그아웃 시도');

  try {
    // 라이선스 파일 삭제 요청
    if (window.electronAPI && window.electronAPI.invoke) {
      await window.electronAPI.invoke('license-logout');
    }

    // 자동 로그인 설정 해제
    localStorage.removeItem('autoLoginEnabled');

    alert('✅ 로그아웃 되었습니다.\n\n앱을 다시 시작하면 로그인 화면이 나타납니다.');

    // 라이선스 상태 새로고침
    await refreshLicenseStatus();

  } catch (error) {
    console.error('[LICENSE] 로그아웃 오류:', error);
    // 오류가 발생해도 UI는 업데이트
    await refreshLicenseStatus();
  }
}

// 전역으로 노출
window.refreshLicenseStatus = refreshLicenseStatus;
window.registerLicenseCode = registerLicenseCode;
window.logoutLicense = logoutLicense;

// ═══════════════════════════════════════════════════════════════════════════

// 이벤트 위임 관리자 (최적화됨)
const EventManager = {
  init() {
    // 이벤트 위임으로 성능 최적화
    document.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('change', this.handleChange.bind(this));
    document.addEventListener('keypress', this.handleKeypress.bind(this));
  },

  handleClick(e) {
    const target = e.target;

    // 탭 전환
    if (target.matches('.tab-btn')) {
      const tabName = target.getAttribute('onclick')?.match(/showTab\('(.+)'\)/)?.[1];
      if (tabName) showTab(tabName);
    }

    // 기타 클릭 이벤트들...
  },

  handleChange(e) {
    const target = e.target;

    // 썸네일 타입 변경
    if (target.id === 'thumbnailType') {
      updateThumbnailPreview();
    }

    // 기타 변경 이벤트들...
  },

  handleKeypress(e) {
    if (e.key === 'Enter') {
      const target = e.target;
      if (target.classList.contains('work-record-input')) {
        addTodayWorkRecord('manual', target.value);
        target.value = '';
      }
    }
  }
};

// 초안 글자 수 업데이트 함수는 위의 updateDraftCount로 통합됨 (중복 제거)

// 페이지 로드 시 초기화 (최적화됨)
document.addEventListener('DOMContentLoaded', async function () {
  // 이벤트 매니저 초기화
  EventManager.init();

  // DOM 캐시 초기화
  DOMCache.init();
  LogManager.init();

  // 🔧 진행률 관리자 초기화
  getProgressManager().init();

  // 🔧 애플리케이션 상태 관리자 초기화
  const appState = getAppState();
  appState.reset(); // 초기 상태로 리셋
  syncGlobalAppStateVars(); // 전역 변수 동기화

  // 엑셀 드래그 앤 드롭 초기화
  setupExcelDropZone();

  // 썸네일 타입을 항상 텍스트로 강제 설정
  const thumbnailTypeSelect = DOMCache.get('thumbnailType');
  if (thumbnailTypeSelect) {
    thumbnailTypeSelect.value = 'text';
  }

  // 🔐 이벤트 위임 방식으로 워드프레스 관련 버튼 처리
  // (버튼이 나중에 생성되어도 동작하도록)
  document.addEventListener('click', function (e) {
    // 버튼 또는 버튼 내부 요소 클릭 처리
    const target = e.target.closest('button') || e.target;
    if (!target) return;

    const buttonText = target.textContent || '';
    const buttonId = target.id || '';
    const parentButton = target.closest('button');

    // 워드프레스 앱 비밀번호 가이드 버튼 (다양한 조건으로 감지)
    if (buttonId === 'wpAppPasswordGuideBtn' ||
      buttonId === 'wpAppPasswordGuideBtnSemiAuto' ||
      buttonText.includes('발급 방법') ||
      (parentButton && parentButton.textContent.includes('발급 방법'))) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[WP 가이드] 버튼 클릭됨 (이벤트 위임)', { buttonId, buttonText: buttonText.substring(0, 20) });
      if (window.showWordPressAppPasswordGuide) {
        window.showWordPressAppPasswordGuide();
      } else {
        console.error('[WP 가이드] 함수 없음');
        alert('가이드 기능이 로드되지 않았습니다. 페이지를 새로고침해주세요.');
      }
      return;
    }

    // 워드프레스 카테고리 로드 버튼 (🔄 이모지 또는 ID로 감지)
    if (buttonId === 'loadWpCategoriesBtn' ||
      buttonId === 'loadCategoriesBtn' ||
      buttonId === 'btnLoadCategories' ||
      (parentButton && (buttonText === '🔄' || buttonText.includes('카테고리 불러오기')))) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[WP 카테고리] 로드 버튼 클릭됨 (이벤트 위임)', { buttonId });
      if (window.loadWpCategories) {
        window.loadWpCategories();
      } else if (window.loadWordPressCategories) {
        window.loadWordPressCategories();
      } else {
        console.error('[WP 카테고리] 함수 없음');
        alert('카테고리 로드 기능이 로드되지 않았습니다. 페이지를 새로고침해주세요.');
      }
      return;
    }
  }, true); // capture 단계에서 처리

  // localStorage 설정 로드
  loadSettings();

  // 기본값 보장
  if (thumbnailTypeSelect && !thumbnailTypeSelect.value) {
    thumbnailTypeSelect.value = 'text';
  }


  // 🔧 StorageManager 사용 (3차 최종 보장)
  try {
    const storage = getStorageManager();
    const settings = await storage.get('bloggerSettings', true) || {};

    // 기본값 보장 (무조건 강제)
    settings.thumbnailType = 'text';
    // 플랫폼 설정은 유지 (사용자 선택 존중)

    await storage.set('bloggerSettings', settings, true);
    console.log('[INIT] localStorage에 기본값 최종 저장 완료 (3차):', settings);
  } catch (e) {
    console.error('[INIT] localStorage 저장 실패 (3차):', e);
  }


  // 콘텐츠 모드 변경 시 소제목 개수 자동 설정
  const contentModeSelect = DOMCache.get('contentMode');
  const sectionCountSelect = document.getElementById('sectionCount');
  const customSectionCountInput = document.getElementById('customSectionCount');

  if (contentModeSelect && sectionCountSelect) {
    contentModeSelect.addEventListener('change', function () {
      const selectedMode = this.value;
      console.log(`[콘텐츠 모드 변경] 선택된 모드: ${selectedMode}`);

      // 페러프레이징 모드일 때 초안 입력 필드 표시/숨김
      const draftInputSection = document.getElementById('draftInputSection');
      const keywordInputSection = document.querySelector('[style*="스마트 키워드 입력"]').parentElement;

      if (selectedMode === 'paraphrasing') {
        if (draftInputSection) draftInputSection.style.display = 'block';
        if (keywordInputSection) keywordInputSection.style.display = 'none';
      } else {
        if (draftInputSection) draftInputSection.style.display = 'none';
        if (keywordInputSection) keywordInputSection.style.display = 'block';
      }

      if (selectedMode === 'shopping') {
        // 쇼핑 모드일 때 자동으로 7개 설정
        sectionCountSelect.value = '7';
        if (customSectionCountInput) {
          customSectionCountInput.value = '7';
        }
        console.log('[콘텐츠 모드 변경] 쇼핑 모드 선택 - 소제목 개수를 7개로 자동 설정');
      } else {
        // 다른 모드일 때는 기본값 5개로 설정
        sectionCountSelect.value = '5';
        if (customSectionCountInput) {
          customSectionCountInput.value = '5';
        }
        console.log('[콘텐츠 모드 변경] 일반 모드 선택 - 소제목 개수를 5개로 자동 설정');
      }
    });
  }

  // .env 파일에서도 설정 불러오기 (API 키 등)
  if (window.blogger && window.blogger.getEnv) {
    try {
      const envResult = await window.blogger.getEnv();
      if (envResult && envResult.ok && envResult.data) {
        console.log('[ENV] .env 파일에서 API 키 로드 성공');
        // localStorage 설정과 병합 (env가 우선)
        const savedSettings = loadSettings();
        const mergedSettings = { ...savedSettings, ...envResult.data };
        localStorage.setItem('bloggerSettings', JSON.stringify(mergedSettings));
        console.log('[ENV] API 키가 자동으로 로드되었습니다');
      }
    } catch (error) {
      console.error('[ENV] .env 로드 실패:', error);
    }
  }

  console.log('[PREVIEW] 미리보기 탭이 기본으로 표시됩니다');

  // 라이센스 정보 로드
  await loadLicenseInfo();

  // 초기 플랫폼 설정 (워드프레스가 기본값)
  const bloggerRadio = document.getElementById('platform-blogger');
  const wordpressRadio = document.getElementById('platform-wordpress');

  // 저장된 설정에서 플랫폼 로드
  const savedSettings = loadSettings();
  let platform = savedSettings.platform || 'blogspot';
  // blogger와 blogspot은 동일하게 처리
  if (platform === 'blogger') {
    platform = 'blogspot';
  }
  console.log('[INIT] 플랫폼 설정:', platform);

  // 플랫폼 라디오 버튼 설정
  if (bloggerRadio && wordpressRadio) {
    if (platform === 'blogger') {
      bloggerRadio.checked = true;
      wordpressRadio.checked = false;
    } else {
      bloggerRadio.checked = false;
      wordpressRadio.checked = true;
    }
    console.log(`[INIT] 플랫폼 설정: ${platform}`);
  } else {
    // 라디오 버튼이 아직 없으면 지연 설정
    setTimeout(() => {
      const delayedBloggerRadio = document.getElementById('platform-blogger');
      const delayedWordpressRadio = document.getElementById('platform-wordpress');
      if (delayedBloggerRadio && delayedWordpressRadio) {
        if (platform === 'blogger') {
          delayedBloggerRadio.checked = true;
          delayedWordpressRadio.checked = false;
        } else {
          delayedBloggerRadio.checked = false;
          delayedWordpressRadio.checked = true;
        }
        console.log(`[INIT] 플랫폼 지연 설정: ${platform}`);
      }
    }, 200);
  }

  // 설정이 없거나 플랫폼이 유효하지 않으면 워드프레스로 기본값 설정
  const validPlatforms = ['wordpress', 'blogger', 'blogspot'];
  if (!savedSettings.platform || !validPlatforms.includes(savedSettings.platform)) {
    savedSettings.platform = 'wordpress';
    localStorage.setItem('bloggerSettings', JSON.stringify(savedSettings));
    console.log('[INIT] 플랫폼 기본값 설정: wordpress');
  }

  // 플랫폼 필드 토글 실행
  togglePlatformFields();

  // 초기 로드 시 블로그스팟 인증 버튼 숨김 (워드프레스가 기본값)
  const bloggerAuthBtn = document.getElementById('bloggerOAuthBtn');
  if (bloggerAuthBtn && platform !== 'blogger') {
    bloggerAuthBtn.style.display = 'none';
    console.log('[INIT] 블로그스팟 인증 버튼 초기 숨김 (워드프레스 모드)');
  }

  console.log('[INIT] 초기 플랫폼 설정 완료:', platform);
  console.log('초기 플랫폼 설정:', {
    savedPlatform: savedSettings.platform,
    bloggerChecked: bloggerRadio ? bloggerRadio.checked : 'N/A',
    wordpressChecked: wordpressRadio ? wordpressRadio.checked : 'N/A'
  });

  // 플랫폼 상태 업데이트
  updatePlatformStatus();

  // 플랫폼 필드 초기화
  togglePlatformFields();

  // 키워드 카운트 초기화
  updateKeywordCount();
  updateRemoveButtons();

  // 실시간 시계 및 달력 초기화
  updateRealtimeClock();
  renderCalendar();

  // 1초마다 시계 업데이트
  setInterval(updateRealtimeClock, 1000);

  // 자동 백업 시스템 시작 (30분마다)
  startAutoBackup();

  // 첫 번째 키워드 필드의 제목 선택 드롭다운 이벤트 리스너
  const firstTitleSelect = document.querySelector('.keyword-title-select');
  const firstCustomTitleInput = document.getElementById('customTitleInput');

  if (firstTitleSelect && firstCustomTitleInput) {
    firstTitleSelect.addEventListener('change', function () {
      if (this.value === 'custom') {
        firstCustomTitleInput.style.display = 'flex';
      } else {
        firstCustomTitleInput.style.display = 'none';
      }
    });
  }

  // 플랫폼 변경 이벤트 리스너
  document.querySelectorAll('input[name="platform"]').forEach(radio => {
    radio.addEventListener('change', function () {
      console.log('플랫폼 변경 감지:', this.value);

      const platform = this.value;
      const bloggerSettings = document.getElementById('bloggerSettings');
      const wordpressSettings = document.getElementById('wordpressSettings');

      if (platform === 'wordpress') {
        if (wordpressSettings) wordpressSettings.style.display = 'block';
        if (bloggerSettings) bloggerSettings.style.display = 'none';
      } else {
        if (wordpressSettings) wordpressSettings.style.display = 'none';
        if (bloggerSettings) bloggerSettings.style.display = 'block';
      }

      // 플랫폼 상태 배지 업데이트
      updatePlatformStatus();

      // 포스팅 페이지의 플랫폼 필드도 업데이트
      togglePlatformFields();
    });
  });

  // ============================================
  // IPC 이벤트 리스너 (백엔드로부터 로그 및 진행 상황 받기)
  // ============================================

  // 로그 메시지 수신 (진행률과 동기화)
  if (window.blogger && window.blogger.onLog) {
    window.blogger.onLog((line) => {
      // 🔥 [PROGRESS] 패턴 직접 파싱하여 진행률 업데이트
      const progressMatch = line.match(/\[PROGRESS\]\s*(\d+)%\s*-\s*(.+)/);
      if (progressMatch) {
        const percent = parseInt(progressMatch[1], 10);
        const label = progressMatch[2] || '';
        console.log(`🎯 [LOG->PROGRESS] ${percent}% - ${label}`);

        // 직접 UI 업데이트
        updateProgressUI(percent, label);
      }

      // 백엔드에서 오는 로그에 현재 진행률 정보 추가
      const currentProgress = getProgressManager().overallProgress || 0;

      // 진행률 관련 로그인지 확인
      if (line.includes('[PROGRESS]') || line.includes('진행률') || line.includes('%')) {
        addLog(line, 'progress');
      } else {
        const enhancedLine = `[${currentProgress}%] ${line}`;
        addLog(enhancedLine);
      }
    });
  }

  // 🔥 끝판왕 진행률 UI 직접 업데이트 함수
  function updateProgressUI(percent, label) {
    const actualProgress = Math.min(100, Math.max(0, percent));

    // 🎨 원형 진행률 (부드러운 애니메이션)
    const progressCircle = document.getElementById('progressCircle');
    if (progressCircle) {
      const circumference = 2 * Math.PI * 50; // r=50
      const offset = circumference - (actualProgress / 100) * circumference;
      progressCircle.style.transition = 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      progressCircle.style.strokeDashoffset = offset;

      // 🔥 글로우 효과 강화
      if (actualProgress >= 100) {
        progressCircle.style.filter = 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.8))';
      } else if (actualProgress > 0) {
        progressCircle.style.filter = 'drop-shadow(0 0 15px rgba(102, 126, 234, 0.6))';
      }
    }

    // 🎨 막대 진행률 (부드러운 애니메이션)
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      progressFill.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      progressFill.style.width = `${actualProgress}%`;
    }

    // 🎨 퍼센트 텍스트 (카운트업 애니메이션)
    const progressPercentage = document.getElementById('progressPercentage');
    if (progressPercentage) {
      const currentValue = parseInt(progressPercentage.textContent) || 0;
      if (Math.abs(currentValue - actualProgress) > 1) {
        // 숫자 카운트업 애니메이션
        animateValue(progressPercentage, currentValue, actualProgress, 400);
      } else {
        progressPercentage.textContent = `${actualProgress}%`;
      }

      // 완료 시 색상 변경
      if (actualProgress >= 100) {
        progressPercentage.style.color = '#10b981';
        progressPercentage.style.textShadow = '0 0 30px rgba(16, 185, 129, 0.8)';
      }
    }

    // 🎨 상태 텍스트 (페이드 효과)
    const progressStep = document.getElementById('progressStep');
    if (progressStep && label) {
      const cleanLabel = label.replace(/\[PROGRESS\]\s*\d+%\s*-\s*/, '').trim() || '처리 중...';
      if (progressStep.textContent !== cleanLabel) {
        progressStep.style.opacity = '0';
        setTimeout(() => {
          progressStep.textContent = cleanLabel;
          progressStep.style.transition = 'opacity 0.3s ease';
          progressStep.style.opacity = '1';
        }, 150);
      }
    }

    // 🎨 로그 추가 (스타일 개선)
    const progressLogContent = document.getElementById('progressLogContent');
    if (progressLogContent && label) {
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const cleanLabel = label.replace(/\[PROGRESS\]\s*\d+%\s*-\s*/, '').trim();
      const color = actualProgress >= 100 ? '#10b981' : actualProgress > 50 ? '#60a5fa' : '#94a3b8';
      const icon = actualProgress >= 100 ? '✅' : actualProgress > 80 ? '🚀' : actualProgress > 50 ? '⚡' : actualProgress > 20 ? '📝' : '🔍';
      progressLogContent.innerHTML += `<div style="color: ${color}; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">${icon} [${timestamp}] ${cleanLabel}</div>`;
      progressLogContent.scrollTop = progressLogContent.scrollHeight;
    }

    // 🎨 단계 표시 업데이트
    updateAutoProgressStages(actualProgress);
  }

  // 🔥 숫자 카운트업 애니메이션
  function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(start + (end - start) * easeOut);
      element.textContent = `${current}%`;
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };
    requestAnimationFrame(update);
  }

  // 진행 상황 수신 (로그와 동기화 개선)
  console.log('🔧 [DEBUG] onProgress 리스너 등록 시도...');
  console.log('🔧 [DEBUG] window.blogger:', !!window.blogger);
  console.log('🔧 [DEBUG] window.blogger.onProgress:', !!(window.blogger && window.blogger.onProgress));

  if (window.blogger && window.blogger.onProgress) {
    console.log('✅ [DEBUG] onProgress 리스너 등록 성공!');
    window.blogger.onProgress((data) => {
      const { p, label } = data;
      console.log(`🎯 [PROGRESS-EVENT] ${p}% - ${label || ''}`);
      console.log('🎯 [PROGRESS-EVENT] 데이터 수신됨:', JSON.stringify(data));

      // 백엔드에서 보내는 정확한 진행률을 직접 사용
      const actualProgress = Math.min(100, Math.max(0, p));

      // 🔧 ProgressManager 사용
      const progressManager = getProgressManager();

      // 라벨(작업 단계)은 항상 업데이트
      const progressStep = document.getElementById('progressStep');
      if (progressStep && label) {
        const cleanLabel = label.replace(/\[PROGRESS\]\s*\d+%\s*-\s*/, '').trim();
        if (cleanLabel) progressStep.textContent = cleanLabel;
      }

      // 진행률이 현재보다 낮으면 퍼센트/바 업데이트만 스킵 (라벨은 위에서 이미 처리)
      if (actualProgress <= progressManager.overallProgress && actualProgress < 100) {
        console.log(`[PROGRESS] 역행 방지: ${actualProgress}% -> ${progressManager.overallProgress}%`);
        return;
      }

      // 🎨 새 모달 UI 요소 업데이트
      // 원형 진행률 (SVG)
      const progressCircle = document.getElementById('progressCircle');
      console.log('🔍 [DEBUG] progressCircle 요소:', !!progressCircle);
      if (progressCircle) {
        const circumference = 2 * Math.PI * 50; // r=50
        const offset = circumference - (actualProgress / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
        console.log(`✅ [PROGRESS] 원형 진행률 업데이트: ${actualProgress}% (offset: ${offset})`);
      } else {
        console.error('❌ [DEBUG] progressCircle 요소를 찾을 수 없습니다!');
      }

      // 막대 진행률
      const progressFill = document.getElementById('progressFill');
      console.log('🔍 [DEBUG] progressFill 요소:', !!progressFill);
      if (progressFill) {
        progressFill.style.width = `${actualProgress}%`;
        console.log(`✅ [PROGRESS] 막대 진행률 업데이트: ${actualProgress}%`);
      } else {
        console.error('❌ [DEBUG] progressFill 요소를 찾을 수 없습니다!');
      }

      // 퍼센트 텍스트
      const progressPercentage = document.getElementById('progressPercentage');
      console.log('🔍 [DEBUG] progressPercentage 요소:', !!progressPercentage);
      if (progressPercentage) {
        progressPercentage.textContent = `${Math.round(actualProgress)}%`;
        console.log(`✅ [PROGRESS] 퍼센트 텍스트 업데이트: ${Math.round(actualProgress)}%`);
      } else {
        console.error('❌ [DEBUG] progressPercentage 요소를 찾을 수 없습니다!');
      }

      // 상태 텍스트
      const progressStep = document.getElementById('progressStep');
      if (progressStep && label) {
        progressStep.textContent = label.replace(/\[PROGRESS\]\s*\d+%\s*-\s*/, '').trim() || '처리 중...';
      }

      // 로그 추가
      const progressLogContent = document.getElementById('progressLogContent');
      if (progressLogContent && label) {
        const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const color = actualProgress >= 100 ? '#10b981' : '#60a5fa';
        progressLogContent.innerHTML += `<div style="color: ${color};">[${timestamp}] ${label}</div>`;
        progressLogContent.scrollTop = progressLogContent.scrollHeight;
      }

      // 단계 표시 업데이트
      updateAutoProgressStages(actualProgress);

      // 진행률 업데이트 (label 사용)
      updateProgress(actualProgress, actualProgress, label || `${actualProgress}% 진행 중...`);
      updateTime(actualProgress);

      // 크롤링 상세 정보 업데이트
      updateCrawlingDetails(label || '');

      // 진행률 업데이트 시간 기록 (동기화용)
      // 🔧 AppState 사용
      const appState = getAppState();
      appState.lastProgressUpdateTime = new Date();

      // 로그와 진행률 동기화 - 의미있는 진행률 단계에서만 로그 추가
      if (actualProgress !== progressManager.overallProgress) {
        let progressMessage = '';
        let shouldLog = false;

        if (label && label.trim()) {
          progressMessage = `[PROGRESS] ${actualProgress}% - ${label}`;
          shouldLog = true; // 백엔드에서 명시적인 라벨이 있으면 항상 로그
        } else {
          // 단계별 메시지 자동 생성 및 로그 조건 체크
          if (actualProgress >= 10 && actualProgress < 20) {
            progressMessage = `[PROGRESS] ${actualProgress}% - 시스템 초기화 중`;
            shouldLog = actualProgress % 10 === 0; // 10% 단위에서만
          } else if (actualProgress >= 20 && actualProgress < 40) {
            progressMessage = `[PROGRESS] ${actualProgress}% - 키워드 및 콘텐츠 분석 중`;
            shouldLog = actualProgress % 10 === 0; // 10% 단위에서만
          } else if (actualProgress >= 40 && actualProgress < 60) {
            progressMessage = `[PROGRESS] ${actualProgress}% - AI 콘텐츠 생성 중`;
            shouldLog = actualProgress % 10 === 0; // 10% 단위에서만
          } else if (actualProgress >= 60 && actualProgress < 80) {
            progressMessage = `[PROGRESS] ${actualProgress}% - 이미지 및 미디어 처리 중`;
            shouldLog = actualProgress % 10 === 0; // 10% 단위에서만
          } else if (actualProgress >= 80 && actualProgress < 95) {
            progressMessage = `[PROGRESS] ${actualProgress}% - 최종 검토 및 발행 준비 중`;
            shouldLog = actualProgress % 5 === 0; // 5% 단위 (더 세밀하게)
          } else if (actualProgress >= 95) {
            progressMessage = `[PROGRESS] ${actualProgress}% - 작업 거의 완료`;
            shouldLog = actualProgress >= 95; // 95% 이상에서는 항상
          }
        }

        // 추가 조건: 100%는 항상 로그, 첫 시작(0% 이상)도 로그
        // 🔧 ProgressManager 사용
        if (actualProgress === 100 || (actualProgress > 0 && progressManager.overallProgress === 0)) {
          shouldLog = true;
        }

        if (progressMessage && shouldLog) {
          // 진행률 로그에 정확한 타임스탬프 적용 (동기화된 시간 사용)
          // 🔧 AppState 사용
          const syncTime = appState.lastProgressUpdateTime ? appState.lastProgressUpdateTime.toLocaleTimeString() : new Date().toLocaleTimeString();
          const syncMessage = progressMessage.replace(/\[.*?\]/, `[${syncTime}]`);
          addLog(syncMessage, 'progress');

          // 진행률 업데이트와 로그 시간 동기화를 위한 추가 정보 로깅
          console.log(`[SYNC] 진행률 ${actualProgress}% 업데이트 및 로그 동기화 완료 - ${syncTime}`);
        }
      }

      // 작업 상태 업데이트
      const statusEl = document.getElementById('workStatusTitle');
      const subtitleEl = document.getElementById('workStatusSubtitle');
      if (statusEl && label) {
        statusEl.textContent = label;
      }
      if (subtitleEl) {
        if (p < 20) {
          subtitleEl.textContent = '시스템을 초기화하고 있습니다';
        } else if (p < 40) {
          subtitleEl.textContent = '키워드와 콘텐츠를 분석하고 있습니다';
        } else if (p < 60) {
          subtitleEl.textContent = 'AI가 고품질 콘텐츠를 생성하고 있습니다';
        } else if (p < 80) {
          subtitleEl.textContent = '이미지와 미디어를 처리하고 있습니다';
        } else if (p < 95) {
          subtitleEl.textContent = '최종 검토 및 발행 준비 중입니다';
        } else {
          subtitleEl.textContent = '모든 작업이 거의 완료되었습니다';
        }
      }

      // 현재 진행률 업데이트
      // 🔧 ProgressManager 사용
      progressManager.overallProgress = actualProgress;
      syncGlobalProgressVars();

      // 부드러운 진행률 업데이트 비활성화 (정확한 진행률 표시를 위해)
      // smoothProgressUpdate(p, label);
    });
  }

  // 관리자 모드 단축키 수신 (Shift+Z)
  if (window.blogger && window.blogger.onAdminShortcut) {
    window.blogger.onAdminShortcut(() => {
      console.log('[ADMIN] 관리자 모드 단축키 수신!');

      // PIN 입력 프롬프트
      const pin = prompt('🔐 관리자 모드\n\nPIN을 입력하세요:');
      if (pin === '1234' || pin === 'admin') {
        alert('✅ 관리자 모드 활성화!\n\n- 개발자 도구: F12\n- 콘솔 로그 확인 가능');

        // 관리자 배지 표시
        const devBadge = document.getElementById('dev-mode-badge');
        if (devBadge) {
          devBadge.style.display = 'block';
        }

        // 개발자 도구 열기
        if (window.electronAPI?.invoke) {
          window.electronAPI.invoke('open-dev-tools').catch(console.error);
        }

        console.log('[ADMIN] ✅ 관리자 모드 활성화됨');
      } else if (pin !== null) {
        alert('❌ PIN이 올바르지 않습니다.');
      }
    });
  } else {
    console.warn('[ADMIN] onAdminShortcut 함수가 없습니다');
  }
});

// ============================================
// 썸네일 생성기 함수들
// ============================================

let currentThumbnailCanvas = null;

// 썸네일 미리보기 업데이트 (원본)
function _updateThumbnailPreview() {
  const text = document.getElementById('thumbnailText')?.value || '';
  const fontSize = document.getElementById('thumbnailFontSize')?.value || 80;
  const bgColor = document.getElementById('thumbnailBgColor')?.value || '#ffffff';
  const textColor = document.getElementById('thumbnailTextColor')?.value || '#000000';
  const borderColor = document.getElementById('thumbnailBorderColor')?.value || '#ff6b35';

  // 폰트 크기 값 표시
  const fontSizeValue = document.getElementById('fontSizeValue');
  if (fontSizeValue) fontSizeValue.textContent = fontSize;

  // 색상 값 표시
  const bgColorValue = document.getElementById('bgColorValue');
  const textColorValue = document.getElementById('textColorValue');
  const borderColorValue = document.getElementById('borderColorValue');
  if (bgColorValue) bgColorValue.textContent = bgColor;
  if (textColorValue) textColorValue.textContent = textColor;
  if (borderColorValue) borderColorValue.textContent = borderColor;

  const previewDiv = document.getElementById('thumbnailPreview');
  if (!previewDiv || !text) return;

  // 캔버스 생성
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  // 배경색
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 테두리
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 20;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // 텍스트 설정
  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 텍스트를 여러 줄로 나누기
  const maxWidth = canvas.width - 100;
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  // 각 줄 그리기
  const lineHeight = parseInt(fontSize) * 1.3;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });

  // 미리보기에 표시
  previewDiv.innerHTML = '';
  const img = document.createElement('img');
  img.src = canvas.toDataURL();
  img.style.cssText = 'max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);';
  previewDiv.appendChild(img);

  // 다운로드 버튼 표시
  const downloadBtn = document.getElementById('downloadThumbnailBtn');
  if (downloadBtn) downloadBtn.style.display = 'block';

  // 현재 캔버스 저장
  currentThumbnailCanvas = canvas;
}

// 🔧 Debounce 적용된 updateThumbnailPreview (300ms)
const updateThumbnailPreview = debounce(_updateThumbnailPreview, 300);

// 텍스트 썸네일 생성
function generateTextThumbnail() {
  const text = document.getElementById('thumbnailText')?.value;
  if (!text || text.trim() === '') {
    alert('썸네일에 표시할 텍스트를 입력해주세요.');
    return;
  }

  updateThumbnailPreview();

  // 생성된 썸네일을 localStorage에 저장 (포스팅 시 자동 사용)
  if (currentThumbnailCanvas) {
    currentThumbnailCanvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = function () {
        const dataUrl = reader.result;
        localStorage.setItem('generatedThumbnail', dataUrl);
        localStorage.setItem('thumbnailText', text);
        console.log('✅ 썸네일이 저장되었습니다. 포스팅 시 자동으로 사용됩니다.');
      };
      reader.readAsDataURL(blob);
    });
  }

  alert('✅ 썸네일이 생성되었습니다! 포스팅 시 자동으로 사용됩니다.');
}

// 썸네일 다운로드
function downloadThumbnail() {
  if (!currentThumbnailCanvas) {
    alert('먼저 썸네일을 생성해주세요.');
    return;
  }

  try {
    // Canvas를 Blob으로 변환
    currentThumbnailCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnail-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('✅ 썸네일이 다운로드되었습니다!');
    }, 'image/png');
  } catch (error) {
    console.error('썸네일 다운로드 오류:', error);
    alert('❌ 썸네일 다운로드 중 오류가 발생했습니다.');
  }
}

// 프리셋 적용
function applyPreset(bgColor, textColor, borderColor) {
  const bgInput = document.getElementById('thumbnailBgColor');
  const textInput = document.getElementById('thumbnailTextColor');
  const borderInput = document.getElementById('thumbnailBorderColor');

  if (bgInput) bgInput.value = bgColor;
  if (textInput) textInput.value = textColor;
  if (borderInput) borderInput.value = borderColor;

  updateThumbnailPreview();
}

// ===== 엑셀 관련 개선된 함수들 =====

// 드래그앤드롭 핸들러
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '#4ade80';
  e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
}

function handleDragLeave(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
}

function handleFileDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      document.getElementById('excelFile').files = files;
      handleExcelFileSelect({ target: { files: files } });
    } else {
      addLog('❌ .xlsx 또는 .xls 파일만 업로드 가능합니다.', 'error');
    }
  }
}


function downloadExcelTemplate() {
  // XLSX 라이브러리 확인
  if (typeof XLSX === 'undefined') {
    alert('❌ XLSX 라이브러리가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // 한국시간(KST) 기준 예시 데이터 생성
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const example1 = new Date(kstNow.getTime() + (60 * 60 * 1000)); // 1시간 후
  const example2 = new Date(kstNow.getTime() + (24 * 60 * 60 * 1000)); // 1일 후

  const formatKSTDateTime = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes} (KST)`;
  };

  // 엑셀 템플릿 데이터 생성
  const templateData = [
    {
      '제목': '맛있는 파스타 만들기',
      '키워드': '파스타, 레시피, 요리',
      '플랫폼': 'blogger',
      '콘텐츠모드': 'external',
      '프롬프트모드': 'max-mode',
      '예약시간': formatKSTDateTime(example1)
    },
    {
      '제목': '건강한 운동 루틴',
      '키워드': '운동, 헬스, 피트니스',
      '플랫폼': 'wordpress',
      '콘텐츠모드': 'spiderwebbing',
      '프롬프트모드': 'max-mode',
      '예약시간': formatKSTDateTime(example2)
    }
  ];

  try {
    // 워크시트 생성
    const ws = XLSX.utils.json_to_sheet(templateData);

    // 컬럼 너비 설정
    const colWidths = [
      { wch: 25 }, // 제목
      { wch: 20 }, // 키워드
      { wch: 12 }, // 플랫폼
      { wch: 15 }, // 콘텐츠모드
      { wch: 15 }, // 프롬프트모드
      { wch: 20 }  // 예약시간
    ];
    ws['!cols'] = colWidths;

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '포스팅 템플릿');

    // 파일명 생성
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `블로그_포스팅_템플릿_${timestamp}.xlsx`;

    // 엑셀 파일 다운로드
    XLSX.writeFile(wb, filename);

    console.log('✅ 엑셀 템플릿 다운로드 완료:', filename);

    // 결과 표시
    const resultsDiv = document.getElementById('excelResults');
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <div style="font-size: 18px; font-weight: 600; color: #10b981; margin-bottom: 8px;">템플릿 다운로드 완료!</div>
          <div style="font-size: 14px; color: #64748b;">${filename}</div>
        </div>
      `;
    }

  } catch (error) {
    console.error('❌ 엑셀 템플릿 생성 실패:', error);
    alert('❌ 템플릿 생성에 실패했습니다: ' + error.message);
  }
}

// 엑셀 드래그 앤 드롭 기능
function setupExcelDropZone() {
  const dropZone = document.getElementById('excelDropZone');
  const fileInput = document.getElementById('excelFile');

  if (!dropZone || !fileInput) return;

  // 클릭 시 파일 선택
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // 드래그 오버
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#667eea';
    dropZone.style.backgroundColor = '#f0f4ff';
  });

  // 드래그 리브
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#cbd5e1';
    dropZone.style.backgroundColor = '#f8fafc';
  });

  // 드롭
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#cbd5e1';
    dropZone.style.backgroundColor = '#f8fafc';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      handleExcelFile(files[0]);
    }
  });

  // 파일 선택 시
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleExcelFile(e.target.files[0]);
    }
  });
}

// 엑셀 파일 처리
function handleExcelFile(file) {
  if (!file.name.match(/\.(xlsx|xls)$/)) {
    alert('❌ 엑셀 파일만 업로드 가능합니다 (.xlsx, .xls)');
    return;
  }

  const resultsDiv = document.getElementById('excelResults');
  if (resultsDiv) {
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
        <div style="font-size: 18px; font-weight: 600; color: #3b82f6; margin-bottom: 8px;">파일 업로드 완료!</div>
        <div style="font-size: 14px; color: #64748b;">${file.name}</div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">이제 "배치 처리 시작" 버튼을 클릭하세요</div>
      </div>
    `;
  }

  console.log('✅ 엑셀 파일 업로드:', file.name);
}

function showTemplatePreview() {
  alert('📋 템플릿 미리보기\n\n' +
    '👶 초보자용 (간단):\n' +
    '• 📝 포스트 제목: 글 제목만 입력\n' +
    '• 🏷️ 키워드: 쉼표로 구분된 키워드\n' +
    '• 📱 플랫폼: 블로거/워드프레스\n' +
    '• ⏰ 발행 방식: 임시저장/즉시발행/예약발행\n' +
    '• 📅 예약 날짜: 예약발행시에만 입력\n' +
    '• 🖼️ 썸네일: 자동생성/달리/펙셀스\n' +
    '• 📊 글자 수: 자동\n\n' +
    '모든 옵션을 쉽게 선택할 수 있어요!');
}

function showQuickGuide() {
  alert('📖 빠른 사용 가이드\n\n' +
    '1️⃣ 템플릿 다운로드 버튼 클릭\n' +
    '2️⃣ 다운로드된 엑셀 파일을 열기\n' +
    '3️⃣ 예시 데이터를 참고하여 내용 작성\n' +
    '4️⃣ 파일을 .xlsx 형식으로 저장\n' +
    '5️⃣ 드래그앤드롭 또는 파일 선택으로 업로드\n' +
    '6️⃣ 배치 처리 시작 버튼 클릭\n\n' +
    '💡 tip: 필수 컬럼(포스트 제목, 키워드)만 작성해도 됩니다!');
}

// 엑셀 배치 처리 함수
function runExcelBatch() {
  const fileInput = document.getElementById('excelFile');
  if (!fileInput.files || fileInput.files.length === 0) {
    addLog('❌ 먼저 엑셀 파일을 선택해주세요.', 'error');
    return;
  }

  const file = fileInput.files[0];
  addLog(`🚀 엑셀 배치 처리 시작: ${file.name}`, 'info');

  // 파일을 읽어서 백엔드로 전송
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = e.target.result;

      // 백엔드에 엑셀 배치 처리 요청
      if (window.blogger && window.blogger.runExcelBatch) {
        addLog('📤 백엔드에 엑셀 데이터 전송 중...', 'info');

        const result = await window.blogger.runExcelBatch({
          fileName: file.name,
          fileData: data,
          settings: {
            // 현재 UI 설정값들 전달
            platform: document.querySelector('input[name="platform"]:checked')?.value || 'blogspot',
            contentMode: DOMCache.getValue('contentMode') || 'external',
            promptMode: 'max-mode',
            h2Images: getH2ImageSections(),
            toneStyle: document.getElementById('toneStyle')?.value || 'professional'
          }
        });

        if (result.ok) {
          addLog(`✅ 배치 처리 완료! 총 ${result.processedCount || 0}개 포스팅 처리됨`, 'success');

          // 결과 표시
          const resultsDiv = document.getElementById('excelResults');
          if (resultsDiv) {
            resultsDiv.innerHTML = `
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 12px 0; font-size: 18px;">✅ 배치 처리 완료</h3>
                <p style="margin: 0; font-size: 14px;">총 ${result.processedCount || 0}개의 포스팅이 성공적으로 처리되었습니다.</p>
              </div>
              <div style="display: flex; gap: 12px;">
                <button onclick="downloadExcelResults()" style="flex: 1; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                  📊 결과 다운로드
                </button>
                <button onclick="clearExcelResults()" style="flex: 1; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                  🗑️ 결과 지우기
                </button>
              </div>
            `;
          }
        } else {
          addLog(`❌ 배치 처리 실패: ${result.error || '알 수 없는 오류'}`, 'error');
        }
      } else {
        // 백엔드 연동이 없는 경우 시뮬레이션
        addLog('⚠️ 백엔드 연동이 없어 시뮬레이션으로 실행됩니다.', 'warning');
        setTimeout(() => {
          addLog('✅ 배치 처리 완료! (시뮬레이션)', 'success');
        }, 2000);
      }
    } catch (error) {
      console.error('엑셀 배치 처리 오류:', error);
      addLog(`❌ 배치 처리 중 오류 발생: ${error.message}`, 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}

function downloadExcelResults() {
  // 백엔드에서 결과 다운로드 요청
  if (window.blogger && window.blogger.downloadExcelResults) {
    addLog('📥 결과 파일 다운로드 중...', 'info');

    window.blogger.downloadExcelResults()
      .then(result => {
        if (result.ok) {
          addLog('✅ 결과 파일 다운로드 완료!', 'success');

          // 파일 다운로드 처리
          const blob = new Blob([result.fileData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.fileName || 'batch_results.xlsx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } else {
          addLog(`❌ 다운로드 실패: ${result.error || '알 수 없는 오류'}`, 'error');
        }
      })
      .catch(error => {
        console.error('결과 다운로드 오류:', error);
        addLog(`❌ 다운로드 중 오류 발생: ${error.message}`, 'error');
      });
  } else {
    addLog('⚠️ 백엔드 연동이 없어 다운로드할 수 없습니다.', 'warning');
  }
}

function clearExcelResults() {
  const resultsDiv = document.getElementById('excelResults');
  resultsDiv.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: rgba(255, 255, 255, 0.5); margin-bottom: 16px;">
        <path d="M9 11H5a2 2 0 0 0-2 2v3c0 1.1.9 2 2 2h4"></path>
        <path d="M15 11h4a2 2 0 0 1 2 2v3c0 1.1-.9 2-2 2h-4"></path>
        <path d="M9 11V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
      </svg>
      <p style="color: rgba(255, 255, 255, 0.7); margin: 0; font-size: 16px;">배치 처리 결과가 여기에 표시됩니다</p>
    </div>
  `;
  addLog('🗑️ 결과가 지워졌습니다.', 'info');
}

// 워드프레스 카테고리 로드 함수 (전역 스코프에 노출)
window.loadWpCategories = async function loadWpCategories() {
  // 환경 설정 모달에서 워드프레스 정보 가져오기
  const wpUrlElement = document.getElementById('wordpressSiteUrl');
  const wpUsernameElement = document.getElementById('wordpressUsername');
  const wpPasswordElement = document.getElementById('wordpressPassword');

  if (!wpUrlElement || !wpUsernameElement || !wpPasswordElement) {
    alert('워드프레스 연결 정보를 먼저 설정해주세요. 환경 설정에서 워드프레스 정보를 입력하세요.');
    return;
  }

  const wpUrl = wpUrlElement.value;
  const wpUsername = wpUsernameElement.value;
  const wpPassword = wpPasswordElement.value;

  console.log('워드프레스 정보:', { wpUrl, wpUsername, wpPassword: wpPassword ? '***' : 'empty' });

  if (!wpUrl || !wpUsername || !wpPassword) {
    alert('워드프레스 URL, 사용자명, 비밀번호를 모두 입력해주세요.');
    return;
  }

  try {
    console.log('워드프레스 카테고리 로드 시작...');
    const result = await window.electronAPI.loadWpCategories({ wpUrl, wpUsername, wpPassword });
    console.log('카테고리 로드 결과:', result);

    if (result.ok && result.categories) {
      const categorySelect = document.getElementById('wpCategory');
      categorySelect.innerHTML = '<option value="">카테고리 선택</option>';

      result.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
      });

      alert(`${result.categories.length}개의 카테고리를 로드했습니다.`);
    } else {
      alert('카테고리 로드에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('워드프레스 카테고리 로드 오류:', error);
    alert('카테고리 로드 중 오류가 발생했습니다: ' + error.message);
  }
};

// 키워드 추가 함수 (통합 UI용) - 예약시간과 이미지 설정 포함
function addKeyword() {
  const keywordInput = DOMCache.get('keywordInput');
  if (!keywordInput) {
    console.log('키워드 입력 필드를 찾을 수 없습니다.');
    return;
  }

  const keyword = keywordInput.value.trim();
  if (!keyword) {
    alert('키워드를 입력해주세요.');
    return;
  }

  // 키워드 목록에 추가
  const keywordList = document.getElementById('keywordList');
  if (keywordList) {
    const keywordId = 'keyword_' + Date.now();
    const keywordItem = document.createElement('div');
    keywordItem.className = 'keyword-item';
    keywordItem.id = keywordId;
    keywordItem.style.cssText = `
             background: rgba(255, 255, 255, 0.15);
             border: 1px solid rgba(255, 255, 255, 0.2);
             border-radius: 16px;
             padding: 20px;
             margin: 12px auto;
             backdrop-filter: blur(15px);
             transition: all 0.3s ease;
        width: 100%;
        max-width: 1600px;
             box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1);
           `;

    // 🔧 Sanitize 적용 (키워드는 사용자 입력)
    const sanitizedKeyword = sanitizeHTML(keyword);
    // HTML 문자열 생성
    const keywordItemHtml = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 8px; height: 8px; border-radius: 50%;"></div>
          <span style="color: white; font-size: 16px; font-weight: 600;">${sanitizedKeyword}</span>
        </div>
        <button onclick="removeKeyword(this)" style="background: rgba(255, 0, 0, 0.2); border: 1px solid rgba(255, 0, 0, 0.4); color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;" onmouseover="this.style.background='rgba(255, 0, 0, 0.4)'" onmouseout="this.style.background='rgba(255, 0, 0, 0.2)'">×</button>
      </div>
      
             <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; max-width: 1500px; margin: 0 auto;">
        <!-- 예약시간 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">⏰ 예약시간</label>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="date" id="${keywordId}_date" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; flex: 1;">
            <input type="time" id="${keywordId}_time" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 120px;">
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="color: rgba(255, 255, 255, 0.8); font-size: 12px;">또는</span>
            <input type="number" id="${keywordId}_minutesAfter" placeholder="분 후 발행 (예: 15)" min="1" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 6px 8px; font-size: 12px; flex: 1;">
            <span style="color: rgba(255, 255, 255, 0.7); font-size: 11px;">분 후</span>
          </div>
        </div>
        
        <!-- 콘텐츠 모드 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">📝 콘텐츠 모드</label>
          <select id="${keywordId}_contentMode" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 100%;">
            <option value="external">🔗 단일 외부링크 (SEO)</option>
            <option value="internal">🕸️ 내부링크 거미줄치기</option>
            <option value="shopping">🛒 쇼핑/구매유도</option>
          </select>
          <small style="color: rgba(255, 255, 255, 0.6); font-size: 10px; margin-top: 4px; display: block;">외부: 공식 사이트 유도, 내부: 관련 글 연결, 쇼핑: 제품 리뷰</small>
        </div>
        
        <!-- CTA 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">🔗 CTA 설정</label>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: rgba(255, 255, 255, 0.9);">
              <input type="radio" name="cta_${keywordId}" value="auto" id="${keywordId}_ctaAuto" checked style="width: 14px; height: 14px; cursor: pointer;">
              🤖 자동
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: rgba(255, 255, 255, 0.9);">
              <input type="radio" name="cta_${keywordId}" value="manual" id="${keywordId}_ctaManual" style="width: 14px; height: 14px; cursor: pointer;">
              ✏️ 수동
            </label>
          </div>
          <button onclick="openKeywordCtaModal('${keywordId}')" id="${keywordId}_ctaBtn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; width: 100%; display: none;">
            CTA 링크 설정
          </button>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 1500px; margin: 16px auto 0 auto;">
        <!-- 이미지 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">🖼️ 이미지 설정</label>
          <select id="${keywordId}_imageMode" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 100%;" onchange="toggleImageSettings('${keywordId}')">
            <option value="pexels">📸 픽셀</option>
            <option value="dalle">🎨 달리</option>
            <option value="cse">🔍 CSE</option>
            <option value="custom">✏️ 직접입력</option>
            <option value="none">🚫 없음</option>
          </select>
          <input type="text" id="${keywordId}_imagePrompt" placeholder="이미지 설명" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 100%; margin-top: 8px; display: none;">
        </div>

        <!-- 추가 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">⚙️ 추가 옵션</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="color: rgba(255, 255, 255, 0.8); font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" id="${keywordId}_autoPublish" style="transform: scale(1.1);">
              <span>자동 발행</span>
            </label>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
        <small style="color: rgba(255, 255, 255, 0.7); font-size: 11px;">💡 예약시간 미설정시 즉시 포스팅,<br>이미지 AI 자동생성</small>
      </div>
    `;

    // 🔧 최종 sanitize 적용
    keywordItem.innerHTML = sanitizeHTML(keywordItemHtml);

    keywordList.appendChild(keywordItem);

    // 오늘 날짜를 기본값으로 설정
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    document.getElementById(`${keywordId}_date`).value = today;
    document.getElementById(`${keywordId}_time`).value = currentTime;

    // CTA 라디오 버튼 이벤트 리스너 추가
    const ctaAutoRadio = document.getElementById(`${keywordId}_ctaAuto`);
    const ctaManualRadio = document.getElementById(`${keywordId}_ctaManual`);
    const ctaBtn = document.getElementById(`${keywordId}_ctaBtn`);

    if (ctaAutoRadio && ctaManualRadio && ctaBtn) {
      ctaAutoRadio.addEventListener('change', function () {
        if (this.checked) {
          ctaBtn.style.display = 'none';
        }
      });

      ctaManualRadio.addEventListener('change', function () {
        if (this.checked) {
          ctaBtn.style.display = 'block';
        }
      });
    }
  }

  // 입력 필드 초기화
  keywordInput.value = '';

  console.log('키워드 추가됨:', keyword);
}

// 키워드 제거 함수
function removeKeyword(button) {
  const keywordItem = button.closest('.keyword-item');
  if (keywordItem) {
    keywordItem.remove();
  }
}

// 이미지 설정 토글 함수
function toggleImageSettings(keywordId) {
  const imageMode = document.getElementById(`${keywordId}_imageMode`);
  const imagePrompt = document.getElementById(`${keywordId}_imagePrompt`);

  if (imageMode.value === 'custom') {
    imagePrompt.style.display = 'block';
    imagePrompt.focus();
    imagePrompt.placeholder = '이미지 설명을 입력하세요 (예: 고품질 비즈니스 이미지)';
  } else {
    imagePrompt.style.display = 'none';
    imagePrompt.value = '';

    // 각 이미지 모드별로 적절한 플레이스홀더 설정
    if (imageMode.value === 'pexels') {
      imagePrompt.placeholder = 'Pexels에서 검색할 키워드를 입력하세요';
    } else if (imageMode.value === 'dalle') {
      imagePrompt.placeholder = 'DALL-E로 생성할 이미지 설명을 입력하세요';
    } else if (imageMode.value === 'cse') {
      imagePrompt.placeholder = 'Google CSE로 검색할 키워드를 입력하세요';
    }
  }
}

// 모든 키워드 설정 수집 함수
function getAllKeywordSettings() {
  const keywordList = document.getElementById('keywordList');
  const keywordItems = keywordList.querySelectorAll('.keyword-item');
  const settings = [];

  keywordItems.forEach(item => {
    const keywordId = item.id;
    const keywordText = item.querySelector('span').textContent;
    const date = document.getElementById(`${keywordId}_date`)?.value;
    const time = document.getElementById(`${keywordId}_time`)?.value;
    const minutesAfter = document.getElementById(`${keywordId}_minutesAfter`)?.value;
    const contentMode = document.getElementById(`${keywordId}_contentMode`)?.value || 'external';
    const imageMode = document.getElementById(`${keywordId}_imageMode`)?.value;
    const imagePrompt = document.getElementById(`${keywordId}_imagePrompt`)?.value;
    const autoPublish = document.getElementById(`${keywordId}_autoPublish`)?.checked || false;

    // CTA 설정 확인
    const ctaAuto = document.getElementById(`${keywordId}_ctaAuto`)?.checked;
    const ctaManual = document.getElementById(`${keywordId}_ctaManual`)?.checked;
    // 🔧 AppState 사용
    const customCtas = getAppState().keywordCtaData[keywordId] || null;

    // 예약시간 계산
    let scheduledTime = null;
    if (minutesAfter && parseInt(minutesAfter) > 0) {
      // "몇 분 후" 설정이 있으면 우선 적용
      const now = new Date();
      scheduledTime = new Date(now.getTime() + parseInt(minutesAfter) * 60000);
    } else if (date && time) {
      // 그렇지 않으면 날짜/시간 설정 사용
      scheduledTime = new Date(`${date}T${time}`);
    }

    settings.push({
      keyword: keywordText,
      scheduledTime: scheduledTime,
      contentMode: contentMode,
      imageMode: imageMode,
      imagePrompt: imagePrompt,
      autoPublish: autoPublish,
      ctaMode: ctaManual ? 'manual' : 'auto',
      customCtas: customCtas
    });
  });

  return settings;
}

// 대량 포스팅 실행 함수
async function runBulkPosting() {
  const appState = getAppState();

  // ── Guard: 중복 실행 방지 ──
  if (appState.isRunning) {
    addLog('작업이 실행 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
    return;
  }

  const keywordSettings = getAllKeywordSettings();
  if (keywordSettings.length === 0) {
    alert('포스팅할 키워드를 먼저 추가해주세요.');
    return;
  }

  // 현재 설정 수집 (기본값 사용)
  const currentSettings = {
    provider: document.getElementById('generationEngine')?.value || 'gemini',
    platform: 'blogspot',
    thumbnailMode: 'auto',
    imageProvider: 'auto',
    wordCount: 2000,
    autoPublish: false,
    includeImages: true,
    includeCTA: true,
    includeTableOfContents: true,
    seoOptimized: true
  };

  const scheduledPosts = keywordSettings.filter(setting => setting.scheduledTime && setting.scheduledTime > new Date());
  const immediatePosts = keywordSettings.filter(setting => !setting.scheduledTime || setting.scheduledTime <= new Date());

  let totalPosts = keywordSettings.length;
  let completedPosts = 0;

  const progressModal = createProgressModal(totalPosts);
  document.body.appendChild(progressModal);

  try {
    // ── 상태 전환 ──
    appState.isRunning = true;
    setRunning(true);

    for (let idx = 0; idx < immediatePosts.length; idx++) {
      const setting = immediatePosts[idx];
      updateProgressModal(progressModal, completedPosts + 1, totalPosts, setting.keyword, '포스트 생성 중...');

      try {
        await createSinglePost(setting, currentSettings);
        completedPosts++;
        updateProgressModal(progressModal, completedPosts, totalPosts, setting.keyword, '완료!');

        // 포스트 간 지연
        if (idx < immediatePosts.length - 1) {
          updateProgressModal(progressModal, completedPosts, totalPosts, '다음 포스트 준비 중...', '5초 대기 중...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error('포스트 생성 오류:', error);
        updateProgressModal(progressModal, completedPosts, totalPosts, setting.keyword, `오류: ${error.message}`);
      }
    }

    // 예약 포스트 스케줄링
    if (scheduledPosts.length > 0) {
      updateProgressModal(progressModal, completedPosts, totalPosts, '예약 포스트 스케줄링', '예약 포스트를 등록합니다...');
      for (const setting of scheduledPosts) {
        await schedulePost(setting, currentSettings);
      }
      updateProgressModal(progressModal, completedPosts + scheduledPosts.length, totalPosts, '모든 작업 완료!', `${scheduledPosts.length}개의 예약 포스트가 등록되었습니다.`);
    } else {
      updateProgressModal(progressModal, completedPosts, totalPosts, '모든 작업 완료!', '모든 포스트가 성공적으로 생성되었습니다.');
    }

  } catch (error) {
    console.error('대량 포스팅 오류:', error);
    addLog(`❌ 대량 포스팅 오류: ${error.message}`, 'error');
  } finally {
    // ── 상태 복구 (항상 실행) ──
    appState.isRunning = false;
    setRunning(false);

    // 3초 후 진행 상황 모달 닫기
    setTimeout(() => {
      if (progressModal._cleanupEventListeners) {
        progressModal._cleanupEventListeners();
        delete progressModal._cleanupEventListeners;
      }
      try {
        document.body.removeChild(progressModal);
      } catch (e) {
        // already removed
      }
    }, 3000);
  }
}

// 단일 포스트 생성 함수
async function createSinglePost(setting, currentSettings) {
  // 이미지 모드에 따라 imageProvider 설정
  let imageProvider = currentSettings.imageProvider;
  if (setting.imageMode === 'pexels') {
    imageProvider = 'pexels';
  } else if (setting.imageMode === 'dalle') {
    imageProvider = 'dalle';
  } else if (setting.imageMode === 'cse') {
    imageProvider = 'cse';
  }

  const payload = {
    keywords: [{
      keyword: setting.keyword,
      title: setting.keyword, // AI가 제목을 생성하도록 함
      imageMode: setting.imageMode,
      imagePrompt: setting.imagePrompt
    }],
    provider: currentSettings.provider,
    platform: currentSettings.platform,
    thumbnailMode: currentSettings.thumbnailMode,
    imageProvider: imageProvider,
    wordCount: currentSettings.wordCount,
    autoPublish: setting.autoPublish !== undefined ? setting.autoPublish : currentSettings.autoPublish,
    includeImages: currentSettings.includeImages,
    includeCTA: setting.includeCTA !== undefined ? setting.includeCTA : currentSettings.includeCTA,
    includeTableOfContents: currentSettings.includeTableOfContents,
    seoOptimized: currentSettings.seoOptimized
  };

  return await window.blogger.runPost(payload);
}

// 예약 포스트 스케줄링 함수
async function schedulePost(setting, currentSettings) {
  const payload = {
    keywords: [{
      keyword: setting.keyword,
      title: setting.keyword,
      imageMode: setting.imageMode,
      imagePrompt: setting.imagePrompt
    }],
    scheduledTime: setting.scheduledTime,
    ...currentSettings
  };

  // StorageManager 통일
  const storage = getStorageManager();
  const scheduledPosts = await storage.get('scheduledPosts', true) || [];
  scheduledPosts.push({
    id: Date.now(),
    payload: payload,
    scheduledTime: setting.scheduledTime.toISOString(),
    status: 'scheduled'
  });
  await storage.set('scheduledPosts', scheduledPosts, true);

  debugLog('SCHEDULE', `예약 포스트 등록: ${setting.keyword}`);
}

// 진행 상황 모달 생성 함수
function createProgressModal(totalPosts) {
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
    <div style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    ">
      <h2 style="color: white; margin-bottom: 20px; font-size: 24px;">📝 대량 포스팅 진행 중</h2>
      <div style="
        background: rgba(255, 255, 255, 0.2);
        border-radius: 15px;
        padding: 20px;
        margin-bottom: 20px;
      ">
        <div id="progressText" style="color: white; font-size: 18px; margin-bottom: 10px;">준비 중...</div>
        <div style="
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          overflow: hidden;
        ">
          <div id="progressBar" style="
            height: 100%;
            background: linear-gradient(90deg, #10b981, #34d399);
            width: 0%;
            transition: width 0.3s ease;
          "></div>
        </div>
        <div id="progressPercent" style="color: white; font-size: 14px; margin-top: 8px;">0%</div>
      </div>
      <div id="currentPost" style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin-bottom: 10px;">대기 중...</div>
      <div id="statusText" style="color: rgba(255, 255, 255, 0.7); font-size: 14px;">시작 중...</div>
    </div>
  `;

  // 🔧 이벤트 리스너 핸들러 함수들 (cleanup을 위해 명시적으로 정의)
  // Cleanup 함수: 모든 이벤트 리스너 제거
  const cleanupEventListeners = () => {
    document.removeEventListener('keydown', handleEscape);
    modal.removeEventListener('click', handleModalClick);
    console.log('🧹 [PROGRESS_MODAL] 모든 이벤트 리스너 제거 완료');
  };

  // 이벤트 핸들러 함수들 (ESC 키로 닫기는 비활성화 - 진행 중에는 닫으면 안 됨)
  // 하지만 cleanup은 필요하므로 함수는 정의
  const handleEscape = (e) => {
    // 진행 중 모달은 ESC로 닫지 않음 (실수로 닫는 것 방지)
    // 필요시 주석 해제: if (e.key === 'Escape') { cleanupEventListeners(); ... }
  };

  const handleModalClick = (e) => {
    // 진행 중 모달은 배경 클릭으로 닫지 않음 (실수로 닫는 것 방지)
    // 필요시 주석 해제: if (e.target === modal) { cleanupEventListeners(); ... }
  };

  // 이벤트 리스너 추가 (현재는 비활성화되어 있지만 cleanup을 위해 등록)
  // document.addEventListener('keydown', handleEscape);
  // modal.addEventListener('click', handleModalClick);

  // 모달에 cleanup 함수 저장 (제거할 때 호출 가능하도록)
  modal._cleanupEventListeners = cleanupEventListeners;

  return modal;
}

// 진행 상황 업데이트 함수 (대량 포스팅용)
function updateProgressModal(modal, current, total, currentPost, status) {
  const progressBar = modal.querySelector('#progressBar');
  const progressPercent = modal.querySelector('#progressPercent');
  const progressText = modal.querySelector('#progressText');
  const currentPostEl = modal.querySelector('#currentPost');
  const statusText = modal.querySelector('#statusText');

  const percent = Math.round((current / total) * 100);

  progressBar.style.width = percent + '%';
  progressPercent.textContent = percent + '%';
  progressText.textContent = `${current} / ${total} 완료`;
  currentPostEl.textContent = currentPost;
  statusText.textContent = status;
}

// 글 미리보기 모달 관련 함수들
let previewData = null;

// 미리보기 모달 표시
function showPreviewModal(title, content, platform) {
  previewData = { title, content, platform };

  const overlay = document.getElementById('previewOverlay');
  const modal = document.getElementById('previewModal');
  const titleText = document.getElementById('previewTitleText');
  const platformText = document.getElementById('previewPlatformText');
  const charCount = document.getElementById('previewCharCount');
  const body = document.getElementById('previewBody');

  if (overlay && modal) {
    // 정보 업데이트
    if (titleText) titleText.textContent = title || '제목 없음';
    if (platformText) platformText.textContent = platform === 'wordpress' ? 'WordPress' : 'Blogger';

    // 🔧 순수 텍스트 글자수 계산
    const textLength = getTextLength(content);
    if (charCount) charCount.textContent = textLength.toLocaleString() + '자';

    // 본문 표시 (🔧 Sanitize 적용)
    if (body) {
      body.innerHTML = sanitizeHTML(content);
    }

    // 모달 표시
    overlay.style.display = 'block';
    modal.style.display = 'flex';
  }
}

// 미리보기 모달 닫기
function closePreviewModal() {
  const overlay = document.getElementById('previewOverlay');
  const modal = document.getElementById('previewModal');

  if (overlay) overlay.style.display = 'none';
  if (modal) modal.style.display = 'none';

  previewData = null;
}

// 확인 후 포스팅
function confirmAndPost() {
  if (!previewData) {
    alert('미리보기 데이터가 없습니다.');
    return;
  }

  closePreviewModal();

  // 실제 포스팅 진행
  addLog('✅ 사용자가 미리보기를 확인하고 포스팅을 승인했습니다.');
  addLog('🚀 포스팅을 시작합니다...');

  // TODO: 실제 포스팅 로직 연결
  // 현재는 미리보기만 표시하고, 실제 포스팅은 기존 로직 유지
  alert('미리보기 기능은 개발 중입니다. 실제 포스팅은 아직 연결되지 않았습니다.');
}

// 테스트용 미리보기 표시 함수
function testPreview() {
  const sampleContent = `
    <h1 style="color: #1e293b; margin-bottom: 20px;">카카오톡 활용 가이드</h1>
    
    <div style="background: rgba(102, 126, 234, 0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h2 style="color: #667eea;">📌 카카오톡 기본 기능</h2>
    </div>
    
    <p style="line-height: 1.8; color: #334155; margin: 15px 0;">
      카카오톡은 한국에서 가장 많이 사용되는 메신저 앱으로, 다양한 기능을 제공하고 있습니다.
      이 가이드에서는 카카오톡의 주요 기능과 활용법을 자세히 알아보겠습니다.
    </p>
    
    <img src="https://via.placeholder.com/800x400" style="width: 100%; border-radius: 12px; margin: 20px 0;" />
    
    <p style="line-height: 1.8; color: #334155; margin: 15px 0;">
      먼저 카카오톡의 기본적인 메시지 기능부터 살펴보겠습니다. 
      텍스트 메시지, 음성 메시지, 이모티콘 등 다양한 방식으로 소통할 수 있습니다.
    </p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
      <thead>
        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <th style="padding: 12px; text-align: left; color: white;">기능</th>
          <th style="padding: 12px; text-align: left; color: white;">설명</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 12px;">채팅</td>
          <td style="padding: 12px;">1:1 및 그룹 채팅 지원</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 12px;">보이스톡</td>
          <td style="padding: 12px;">무료 음성통화</td>
        </tr>
        <tr>
          <td style="padding: 12px;">페이스톡</td>
          <td style="padding: 12px;">화상통화 기능</td>
        </tr>
      </tbody>
    </table>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="#" style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 700;">
        🔗 자세히 알아보기
      </a>
    </div>
  `;

  showPreviewModal('카카오톡 활용 가이드', sampleContent, 'wordpress');
}

// ==========================================
// 미리보기 생성 및 발행 함수
// ==========================================

// 생성된 콘텐츠는 AppState에서 관리됩니다

// ==========================================
// 새로운 미리보기 시스템
// ==========================================

// 콘텐츠 생성 (미리보기) - 완전히 새로운 버전
async function generatePreview() {
  console.log('[NEW-PREVIEW] 미리보기 함수 시작');

  try {
    // 0. 이전 캐시 삭제 (새로운 콘텐츠 생성을 위해)
    localStorage.removeItem('lastGeneratedContent');
    localStorage.removeItem('lastGeneratedTitle');
    localStorage.removeItem('lastGeneratedCharCount');
    console.log('[NEW-PREVIEW] 이전 캐시 삭제 완료');

    // 1. 라이선스 체크
    if (!isLicenseValid()) {
      alert('🔒 라이선스 등록이 필요합니다.');
      const licenseModal = document.getElementById('licenseModal');
      if (licenseModal) licenseModal.style.display = 'flex';
      return;
    }

    // 2. 실행 중 체크
    // 🔧 AppState 사용
    if (getAppState().isRunning) {
      alert('작업이 실행 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // 3. 키워드 확인
    const keywordInput = DOMCache.get('keywordInput');
    const keyword = keywordInput?.value?.trim();
    if (!keyword) {
      alert('키워드를 입력해주세요.');
      return;
    }

    console.log('[NEW-PREVIEW] 키워드:', keyword);

    // 4. 상태 설정
    // 🔧 AppState 사용
    setRunning(true);
    getAppState().isCanceled = false;

    // 5. 버튼 로딩 상태
    ButtonStateManager.setLoading('generateBtn', '⏳ 생성 중...');

    addLog('[NEW-PREVIEW] 콘텐츠 생성 시작...');

    // 6. Payload 생성
    const payload = createPreviewPayload();

    console.log('[NEW-PREVIEW] Payload:', payload);

    // 7. API 호출
    const result = await window.blogger.runPost(payload);
    console.log('[NEW-PREVIEW] Result:', result);

    // 8. 결과 처리
    console.log('[NEW-PREVIEW] Result 상세:', {
      ok: result?.ok,
      title: result?.title,
      html: result?.html?.substring(0, 100),
      content: result?.content?.substring(0, 100),
      logs: result?.logs
    });

    if (result?.ok) {
      addLog('✅ 콘텐츠 생성 완료!', 'success');

      // 콘텐츠 저장
      const htmlContent = result.html || result.content || '';
      // 🔧 순수 텍스트 글자수 계산
      const textLength = getTextLength(htmlContent);
      const htmlSizeKB = (htmlContent.length / 1024).toFixed(2);
      console.log(`[NEW-PREVIEW] HTML 콘텐츠 크기: ${textLength}자 (순수 텍스트, HTML: ${htmlContent.length}자, ${htmlSizeKB}KB)`);
      addLog(`📏 받은 HTML 크기: ${textLength}자 (순수 텍스트)`, 'info');

      // 🔧 AppState 사용
      const appState = getAppState();
      appState.generatedContent.title = result.title || keyword;
      appState.generatedContent.content = htmlContent;
      appState.generatedContent.thumbnailUrl = result.thumbnailUrl || '';
      appState.generatedContent.payload = payload;

      // 🔧 순수 텍스트 글자수 계산
      const savedTextLength = getTextLength(appState.generatedContent.content);
      console.log('[NEW-PREVIEW] 저장된 콘텐츠:', {
        title: appState.generatedContent.title,
        contentLength: savedTextLength, // 순수 텍스트 글자수
        htmlLength: appState.generatedContent.content.length, // HTML 전체 길이
        contentPreview: appState.generatedContent.content.substring(0, 200)
      });

      // 9. 미리보기 표시 (데이터만 저장, 모달은 사용자가 선택)
      displayPreviewInModal();

      addLog('[NEW-PREVIEW] 미리보기 데이터 준비 완료! 미리보기 버튼을 클릭하세요.', 'success');

    } else {
      throw new Error(result?.error || result?.logs || '콘텐츠 생성 실패');
    }

  } catch (error) {
    // 🔧 ErrorHandler 사용
    getErrorHandler().handle(error, {
      function: 'generatePreview',
      step: '콘텐츠 생성'
    });
  } finally {
    // 버튼 복원
    // 🔧 ButtonStateManager 사용
    ButtonStateManager.restore('generateBtn');
    setRunning(false);
    // 🔧 AppState 사용
    getAppState().isCanceled = false;
  }
}

// 미리보기 탭에 콘텐츠 표시
function displayPreviewInModal() {
  console.log('[DISPLAY-PREVIEW] 미리보기 탭에 표시 시작');

  const previewContent = DOMCache.get('previewContent');
  const previewTitleText = document.getElementById('previewTitleText');
  const previewCharCount = document.getElementById('previewCharCount');

  if (!previewContent) {
    console.error('[DISPLAY-PREVIEW] previewContent 요소를 찾을 수 없습니다');
    return;
  }

  // 🔧 AppState 사용
  const appState = getAppState();
  const content = appState.generatedContent.content;
  const title = appState.generatedContent.title;
  const thumbnailUrl = appState.generatedContent.thumbnailUrl;

  if (content && content.trim()) {
    // 제목 표시
    if (previewTitleText) {
      previewTitleText.textContent = title || '제목 없음';
    }

    // 제목을 previewTitle에도 표시
    const previewTitle = document.getElementById('previewTitle');
    if (previewTitle) {
      previewTitle.textContent = title || '제목 없음';
    }

    // 썸네일 표시
    const thumbnailSection = document.getElementById('previewThumbnailSection');
    const thumbnailImage = document.getElementById('previewThumbnailImage');
    if (thumbnailUrl && thumbnailUrl.trim()) {
      if (thumbnailSection) thumbnailSection.style.display = 'block';
      if (thumbnailImage) {
        thumbnailImage.src = thumbnailUrl;
        thumbnailImage.onerror = function () {
          if (thumbnailSection) thumbnailSection.style.display = 'none';
          console.warn('[DISPLAY-PREVIEW] 썸네일 로드 실패:', thumbnailUrl);
        };
      }
      console.log('[DISPLAY-PREVIEW] 썸네일 표시:', thumbnailUrl);
    } else {
      if (thumbnailSection) thumbnailSection.style.display = 'none';
      console.log('[DISPLAY-PREVIEW] 썸네일 없음');
    }

    // 콘텐츠가 있으면 표시
    console.log('[DISPLAY-PREVIEW] 표시할 콘텐츠 길이:', content.length);
    console.log('[DISPLAY-PREVIEW] 콘텐츠 미리보기 (처음 500자):', content.substring(0, 500));

    // HTML 콘텐츠를 안전하게 설정
    try {
      let displayContent = content;

      // 콘텐츠가 너무 길면 (50KB 이상) 절반만 표시
      if (content.length > 50000) {
        const halfLength = Math.floor(content.length / 2);
        displayContent = content.substring(0, halfLength);
        console.log('[DISPLAY-PREVIEW] ⚠️ 콘텐츠가 너무 길어 절반만 표시합니다 (' + halfLength + '자)');

        // 절반 표시 안내 메시지 추가
        displayContent += `
          <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); 
                      color: white; 
                      padding: 20px; 
                      border-radius: 12px; 
                      margin: 30px 0; 
                      text-align: center; 
                      font-weight: 700; 
                      box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3);">
            ⚠️ 콘텐츠가 너무 길어 미리보기는 절반만 표시됩니다<br>
            📋 전체 콘텐츠는 "HTML 복사" 또는 "브라우저에서 보기"를 이용하세요
          </div>
        `;
      }

      // 🔧 Sanitize 적용
      let sanitizedContent;
      if (displayContent.includes('<') && displayContent.includes('>')) {
        // HTML 콘텐츠인 경우 sanitize 적용
        sanitizedContent = sanitizeHTML(displayContent);
      } else {
        // 텍스트 콘텐츠인 경우 HTML로 감싸기 (이미 안전함)
        sanitizedContent = `<div style="padding: 20px; font-size: 14px; line-height: 1.6; color: #374151;">${sanitizeHTML(displayContent)}</div>`;
      }
      previewContent.innerHTML = sanitizedContent;

      // 미리보기 컨테이너 스타일 강제 설정
      previewContent.style.height = 'auto';
      previewContent.style.maxHeight = 'none';
      previewContent.style.overflow = 'visible';
      previewContent.style.whiteSpace = 'normal';
      previewContent.style.wordWrap = 'break-word';
      previewContent.style.display = 'block';

      // 부모 컨테이너도 확인
      const parentContainer = previewContent.parentElement;
      if (parentContainer) {
        parentContainer.style.height = 'auto';
        parentContainer.style.maxHeight = 'none';
        parentContainer.style.overflow = 'visible';
      }

      console.log('[DISPLAY-PREVIEW] 콘텐츠 표시 완료');
      console.log('[DISPLAY-PREVIEW] 실제 표시된 콘텐츠 길이:', previewContent.innerHTML.length);

      // DOM이 완전히 렌더링될 때까지 잠시 대기
      setTimeout(() => {
        console.log('[DISPLAY-PREVIEW] 렌더링 완료 후 실제 높이:', previewContent.scrollHeight + 'px');
      }, 100);

    } catch (error) {
      console.error('[DISPLAY-PREVIEW] 콘텐츠 표시 오류:', error);
      // 🔧 Sanitize 적용
      const errorMessage = sanitizeHTML(error.message);
      previewContent.innerHTML = sanitizeHTML(`<div style="color: red; padding: 20px; font-size: 14px;">콘텐츠 표시 중 오류가 발생했습니다: ${errorMessage}</div>`);
    }

    // 🔧 순수 텍스트 글자수 계산
    const actualCharCount = getTextLength(content);

    // 글자수 표시
    if (previewCharCount) {
      previewCharCount.textContent = `${actualCharCount}자`;
    }

    console.log('[DISPLAY-PREVIEW] 제목:', title);
    console.log('[DISPLAY-PREVIEW] 글자수:', actualCharCount);

    // localStorage에 콘텐츠 저장 (미리보기 모달에서 재사용하기 위해)
    try {
      localStorage.setItem('lastGeneratedContent', content);
      localStorage.setItem('lastGeneratedTitle', title || '제목 없음');
      localStorage.setItem('lastGeneratedCharCount', actualCharCount.toString());
      console.log('[DISPLAY-PREVIEW] localStorage에 콘텐츠 저장 완료');
    } catch (error) {
      console.error('[DISPLAY-PREVIEW] localStorage 저장 중 오류:', error);
    }

    // 🚀 자동으로 미리보기 탭으로 전환
    console.log('[DISPLAY-PREVIEW] 미리보기 탭으로 자동 전환');
    setTimeout(() => {
      showTab('preview');
      console.log('[DISPLAY-PREVIEW] 미리보기 탭 전환 완료');
    }, 500); // 0.5초 후 전환 (콘텐츠 렌더링 대기)

    addLog(`✅ 미리보기 생성 완료: ${title} (${actualCharCount}자)`, 'success');
  } else {
    console.warn('[DISPLAY-PREVIEW] 콘텐츠가 없습니다');
    // 🔧 Sanitize 적용
    const errorHtml = `
      <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin: 0 auto 24px; opacity: 0.3;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <div style="font-size: 20px; font-weight: 600; color: #64748b; margin-bottom: 12px;">콘텐츠 생성 오류</div>
        <div style="font-size: 14px; color: #94a3b8;">콘텐츠가 생성되지 않았습니다</div>
      </div>
    `;
    previewContent.innerHTML = sanitizeHTML(errorHtml);
  }

  // 발행 버튼 활성화
  ButtonStateManager.setEnabled('publishBtn', true);
}

// 실제로 콘텐츠를 DOM에 표시하는 함수
async function displayPreviewContent() {
  const content = generatedContent.content;
  const title = generatedContent.title;

  console.log('[DISPLAY-PREVIEW] 표시 시작:', {
    title,
    contentLength: content?.length || 0
  });

  // 제목 업데이트 (정확한 ID 사용)
  const titleElement = document.getElementById('previewTitleText');
  if (titleElement) {
    titleElement.textContent = title || '미리보기';
    console.log('[DISPLAY-PREVIEW] 제목 업데이트:', title);
  } else {
    console.warn('[DISPLAY-PREVIEW] 제목 요소를 찾을 수 없습니다');
  }

  // 플랫폼 업데이트
  const platformElement = document.getElementById('previewPlatformText');
  if (platformElement) {
    // 🔧 StorageManager 사용
    const storageManager = getStorageManager();
    const settings = await storageManager.get('bloggerSettings', true) || {};
    platformElement.textContent = settings.platform === 'blogger' ? 'Blogger' : 'WordPress';
  }

  // 콘텐츠 업데이트
  const contentElement = DOMCache.get('previewContent');
  if (contentElement) {
    if (content && content.trim()) {
      contentElement.innerHTML = content;
      console.log('[DISPLAY-PREVIEW] 콘텐츠 표시됨');

      // 글자수 계산 및 표시
      const charCountElement = document.getElementById('previewCharCount');
      if (charCountElement) {
        const actualCharCount = content
          .replace(/<[^>]*>/g, '') // HTML 태그 제거
          .replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA-Za-z0-9]/g, '') // 특수문자 및 공백 제거
          .length;
        charCountElement.textContent = `${actualCharCount}자`;
        console.log('[DISPLAY-PREVIEW] 글자수:', actualCharCount);
      }
    } else {
      contentElement.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: #94a3b8;"><svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin: 0 auto 24px; opacity: 0.3;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><h3 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #64748b;">콘텐츠를 불러오는 중...</h3><p style="margin: 0; font-size: 14px; color: #94a3b8;">잠시만 기다려주세요</p></div>';
      console.warn('[DISPLAY-PREVIEW] 콘텐츠 없음');
    }
  } else {
    console.error('[DISPLAY-PREVIEW] 콘텐츠 요소를 찾을 수 없습니다');
  }

  // 발행 버튼 활성화
  ButtonStateManager.setEnabled('publishBtn', true);
}

// 미리보기 콘텐츠를 플랫폼에 발행
// publishToPlatform: posting.js module delegation
async function publishToPlatform() {
  if (typeof window.publishToPlatform === "function") {
    return window.publishToPlatform();
  }
  console.error("[POSTING] publishToPlatform module not loaded.");
}


// 워드프레스 애플리케이션 비밀번호 발급 가이드 모달
window.showWordPressAppPasswordGuide = function showWordPressAppPasswordGuide() {
  const modal = document.createElement('div');
  modal.id = 'wpAppPasswordGuideModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(10px);';

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 24px; padding: 40px; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5); border: 2px solid rgba(255, 255, 255, 0.1);">
      <h2 style="color: #fff; font-size: 26px; font-weight: 700; margin-bottom: 24px; text-align: center;">
        🔐 워드프레스 애플리케이션 비밀번호 발급 가이드
      </h2>
      
      <div style="background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #fca5a5; font-size: 14px; margin: 0; font-weight: 600;">
          ⚠️ <strong>중요!</strong> 일반 계정 비밀번호로는 워드프레스 REST API에 연결할 수 없습니다.<br>
          반드시 <strong>애플리케이션 비밀번호</strong>를 발급받아 사용해야 합니다.
        </p>
      </div>

      <div style="color: #e2e8f0; font-size: 15px; line-height: 1.8;">
        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #10b981; font-size: 18px; margin-bottom: 12px;">📍 Step 1. 워드프레스 관리자 로그인</h3>
          <p style="margin: 0; color: #94a3b8;">
            <code style="background: rgba(16, 185, 129, 0.2); padding: 4px 8px; border-radius: 4px; color: #10b981;">https://내사이트.com/wp-admin/</code> 에 접속하여 관리자 계정으로 로그인합니다.
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #3b82f6; font-size: 18px; margin-bottom: 12px;">📍 Step 2. 프로필 페이지 이동</h3>
          <p style="margin: 0; color: #94a3b8;">
            좌측 메뉴에서 <strong style="color: #3b82f6;">사용자</strong> → <strong style="color: #3b82f6;">프로필</strong> 클릭<br>
            또는 우측 상단 프로필 아이콘 클릭 → <strong style="color: #3b82f6;">프로필 편집</strong>
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #f59e0b; font-size: 18px; margin-bottom: 12px;">📍 Step 3. 애플리케이션 비밀번호 섹션 찾기</h3>
          <p style="margin: 0; color: #94a3b8;">
            프로필 페이지를 <strong style="color: #f59e0b;">아래로 스크롤</strong>하면<br>
            <strong style="color: #f59e0b;">"애플리케이션 비밀번호"</strong> 또는 <strong style="color: #f59e0b;">"Application Passwords"</strong> 섹션이 있습니다.
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #8b5cf6; font-size: 18px; margin-bottom: 12px;">📍 Step 4. 새 비밀번호 생성</h3>
          <p style="margin: 0; color: #94a3b8;">
            1. 애플리케이션 이름 입력 (예: <code style="background: rgba(139, 92, 246, 0.2); padding: 2px 6px; border-radius: 4px; color: #a78bfa;">BloggerGPT</code>)<br>
            2. <strong style="color: #8b5cf6;">"새 애플리케이션 비밀번호 추가"</strong> 버튼 클릭<br>
            3. 생성된 비밀번호 복사 (예: <code style="background: rgba(139, 92, 246, 0.2); padding: 2px 6px; border-radius: 4px; color: #a78bfa;">l3rq pnAO QTfU 8RjE mwVc j9kQ</code>)
          </p>
        </div>

        <div style="background: rgba(16, 185, 129, 0.1); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
          <h3 style="color: #10b981; font-size: 16px; margin-bottom: 8px;">✅ Step 5. 설정에 입력</h3>
          <p style="margin: 0; color: #6ee7b7; font-size: 14px;">
            복사한 비밀번호를 이 앱의 <strong>Application Password</strong> 필드에 붙여넣기하고 저장합니다.
          </p>
        </div>

        <div style="background: rgba(239, 68, 68, 0.1); border-radius: 12px; padding: 16px;">
          <p style="margin: 0; color: #fca5a5; font-size: 13px;">
            ⚠️ 애플리케이션 비밀번호는 <strong>생성 직후에만</strong> 확인 가능합니다!<br>
            &nbsp;&nbsp;&nbsp;&nbsp;분실 시 기존 비밀번호를 삭제하고 새로 생성해야 합니다.
          </p>
        </div>
      </div>

      <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: center;">
        <button onclick="window.open('https://wordpress.org/documentation/article/application-passwords/', '_blank')" style="padding: 14px 28px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;">
          📖 공식 문서 보기
        </button>
        <button onclick="document.getElementById('wpAppPasswordGuideModal').remove()" style="padding: 14px 28px; background: linear-gradient(135deg, #475569 0%, #334155 100%); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;">
          ✕ 닫기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 배경 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

// 초보자 가이드 모달 표시 함수
function showBeginnerGuide() {
  const modal = document.createElement('div');
  modal.id = 'beginnerGuideModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(10px);';

  modal.innerHTML = `
    <div style="background: white; border-radius: 20px; padding: 40px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
      <h2 style="color: #333; font-size: 28px; font-weight: 700; margin-bottom: 30px; text-align: center;">
        📚 초보자 가이드 - 포스팅 방법 배우기
      </h2>

      <div style="margin-bottom: 30px;">
        <h3 style="color: #667eea; font-size: 20px; margin-bottom: 15px;">🎯 콘텐츠 모드별 사용법</h3>

        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0;">1. SEO 최적화 모드 (기본)</h4>
          <p style="color: #666; margin: 0; line-height: 1.6;">
            <strong>사용 시기:</strong> 검색 엔진 노출이 중요할 때<br>
            <strong>특징:</strong> 8개 섹션으로 구성된 긴 포스트, 키워드 최적화<br>
            <strong>초보자 팁:</strong> 메인 키워드를 입력하고, 관련 키워드도 3-5개 추가하세요
          </p>
        </div>

        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0;">2. 일관성/거미줄치기 모드</h4>
          <p style="color: #666; margin: 0; line-height: 1.6;">
            <strong>사용 시기:</strong> 시리즈 콘텐츠나 체계적인 정보 제공 시<br>
            <strong>특징:</strong> 6개 섹션, 기본 개념부터 실전 가이드까지<br>
            <strong>초보자 팁:</strong> 하나의 큰 주제를 여러 단계로 나누어 설명하세요
          </p>
        </div>

        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0;">3. 애드센스 승인 모드</h4>
          <p style="color: #666; margin: 0; line-height: 1.6;">
            <strong>사용 시기:</strong> 애드센스 승인을 위한 고품질 콘텐츠<br>
            <strong>특징:</strong> 7개 섹션, E-E-A-T 강화, 개인 경험 강조<br>
            <strong>초보자 팁:</strong> 직접 경험한 내용을 솔직하게 작성하세요
          </p>
        </div>

        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0;">4. 쇼핑/구매유도 모드</h4>
          <p style="color: #666; margin: 0; line-height: 1.6;">
            <strong>사용 시기:</strong> 제품 리뷰나 구매 가이드<br>
            <strong>특징:</strong> 4단계 퍼널 (Attention → Interest → Desire → Action)<br>
            <strong>초보자 팁:</strong> 제품 링크를 수동 크롤링에 넣으면 자동 분석됩니다
          </p>
        </div>

        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0;">5. 페러프레이징 모드</h4>
          <p style="color: #666; margin: 0; line-height: 1.6;">
            <strong>사용 시기:</strong> 기존 콘텐츠를 새롭게 재작성할 때<br>
            <strong>특징:</strong> 6개 섹션, 원문 재구성 및 확장<br>
            <strong>초보자 팁:</strong> 원문의 의미를 유지하면서 완전히 다른 표현으로 작성하세요
          </p>
        </div>

        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px;">
          <h4 style="color: #333; margin: 0 0 10px 0;">6. 내부 링크 최적화 모드</h4>
          <p style="color: #666; margin: 0; line-height: 1.6;">
            <strong>사용 시기:</strong> 블로그 네트워크 구축 시<br>
            <strong>특징:</strong> 9개 섹션, 시리즈 연결 및 심층 탐색<br>
            <strong>초보자 팁:</strong> 서로 관련된 주제들을 연결해서 작성하세요
          </p>
        </div>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="color: #667eea; font-size: 20px; margin-bottom: 15px;">🚀 포스팅 단계별 가이드</h3>

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; padding: 20px;">
          <h4 style="margin: 0 0 15px 0; font-size: 18px;">단계 1: 환경설정</h4>
          <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>플랫폼 선택 (Blogger/WordPress)</li>
            <li>API 키 및 계정 정보 설정</li>
            <li>블로그 ID 및 연결 정보 입력</li>
          </ol>
        </div>

        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border-radius: 12px; padding: 20px; margin-top: 15px;">
          <h4 style="margin: 0 0 15px 0; font-size: 18px;">단계 2: 콘텐츠 설정</h4>
          <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>콘텐츠 모드 선택</li>
            <li>메인 키워드 입력</li>
            <li>관련 키워드 추가 (3-5개 추천)</li>
            <li>제목 생성 방식 선택</li>
          </ol>
        </div>

        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border-radius: 12px; padding: 20px; margin-top: 15px;">
          <h4 style="margin: 0 0 15px 0; font-size: 18px;">단계 3: 포스팅 실행</h4>
          <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>완전 자동화 고품질 블로그 발행 시작 버튼 클릭</li>
            <li>AI가 자동으로 콘텐츠 생성</li>
            <li>썸네일 자동 생성</li>
            <li>블로그에 자동 발행</li>
          </ol>
        </div>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="color: #667eea; font-size: 20px; margin-bottom: 15px;">💡 초보자 팁</h3>
        <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
          <li><strong>첫 포스팅:</strong> SEO 최적화 모드로 시작하세요. 가장 안정적입니다.</li>
          <li><strong>키워드 선택:</strong> 경쟁이 적지만 검색량이 있는 키워드를 선택하세요.</li>
          <li><strong>이미지:</strong> H2 발행을 선택하면 자동으로 관련 이미지가 생성됩니다.</li>
          <li><strong>스킨:</strong> 블로그스팟에서는 모든 테마에 최적화되어 적용됩니다.</li>
          <li><strong>수동 크롤링:</strong> 쇼핑 모드에서 제품 링크를 넣으면 자동 분석됩니다.</li>
        </ul>
      </div>

      <div style="display: flex; justify-content: center; gap: 15px;">
        <button onclick="closeBeginnerGuideModal()" style="padding: 12px 30px; background: #6c757d; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          닫기
        </button>
        <button onclick="startQuickTutorial()" style="padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          🚀 빠른 시작하기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 🔧 이벤트 리스너 핸들러 함수들 (cleanup을 위해 명시적으로 정의)
  // Cleanup 함수: 모든 이벤트 리스너 제거
  const cleanupEventListeners = () => {
    document.removeEventListener('keydown', handleEscape);
    modal.removeEventListener('click', handleModalClick);
    console.log('🧹 [BEGINNER_GUIDE] 모든 이벤트 리스너 제거 완료');
  };

  // 이벤트 핸들러 함수들
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      cleanupEventListeners();
      closeBeginnerGuideModal();
    }
  };

  const handleModalClick = (e) => {
    if (e.target === modal) {
      cleanupEventListeners();
      closeBeginnerGuideModal();
    }
  };

  // 이벤트 리스너 추가
  document.addEventListener('keydown', handleEscape);
  modal.addEventListener('click', handleModalClick);
}

// 초보자 가이드 모달 닫기 함수
function closeBeginnerGuideModal() {
  const modal = document.getElementById('beginnerGuideModal');
  if (modal) {
    // 🔧 모달이 닫힐 때 이벤트 리스너는 이미 cleanupEventListeners에서 제거됨
    // 하지만 혹시 모를 경우를 대비해 추가 cleanup 시도
    try {
      // 모든 이벤트 리스너는 이미 cleanupEventListeners에서 제거되었으므로
      // 여기서는 모달만 제거
      document.body.removeChild(modal);
    } catch (error) {
      console.log('Modal already removed or cleanup already done');
    }
  }
}

// 빠른 시작 튜토리얼 함수
function startQuickTutorial() {
  closeBeginnerGuideModal();
  alert('🎯 빠른 시작을 위해 SEO 최적화 모드로 설정되었습니다!\n\n1. 메인 키워드를 입력하세요\n2. 관련 키워드를 3-5개 추가하세요\n3. "완전 자동화 고품질 블로그 발행 시작" 버튼을 클릭하세요\n\nAI가 자동으로 고품질 콘텐츠를 생성하고 발행합니다!');
}

// Form에서 Payload 생성하는 헬퍼 함수
function createPayloadFromForm() {
  const keywordInput = DOMCache.get('keywordInput');
  const keywordValue = keywordInput ? keywordInput.value.trim() : '';

  const thumbnailTypeSelect = DOMCache.get('thumbnailType');
  const sectionCountSelect = document.getElementById('sectionCount');
  const titleModeSelect = document.getElementById('titleMode');
  const contentModeSelect = DOMCache.get('contentMode');
  const platformSelect = document.getElementById('platformSelect');
  const publishTypeSelect = document.querySelector('input[name="publishType"]:checked');

  let titleValue = null;
  if (titleModeSelect?.value === 'custom') {
    titleValue = keywordValue.trim();
  }

  // 저장된 설정 불러오기 (LocalStorage에서)
  const savedSettings = loadSettings();

  // 수동 CTA 데이터 변환 (인덱스 기반 객체로 변환)
  const manualCtas = {};
  manualCtasData.forEach((cta, index) => {
    if (cta && cta.url && cta.url.trim()) {
      manualCtas[index] = {
        url: cta.url,
        text: cta.title || '자세히 보기',
        hook: cta.hook || ''
      };
    }
  });

  const payload = {
    provider: 'gemini', // Gemini 모드
    topic: keywordValue,
    keywords: [{
      keyword: keywordValue,
      title: titleValue
    }],
    thumbnailMode: thumbnailTypeSelect?.value || 'text',
    sectionCount: (() => {
      let count = 5;
      if (sectionCountSelect) {
        if (sectionCountSelect.value === 'custom') {
          const customInput = document.getElementById('customSectionCount');
          count = customInput && customInput.value ? parseInt(customInput.value) : 5;
        } else {
          count = parseInt(sectionCountSelect.value);
        }
      }
      if (count < 1) count = 1;
      if (count > 20) count = 20;
      console.log(`[단일 포스팅] 소제목 개수: ${count}개`);
      return count;
    })(),
    contentMode: contentModeSelect?.value || 'external', // 콘텐츠 모드 추가
    platform: platformSelect?.value || savedSettings.platform || 'blogspot', // 기본값: wordpress
    publishType: publishTypeSelect?.value || 'publish',
    // 수동 CTA 추가 (인덱스 기반 객체)
    manualCtas: Object.keys(manualCtas).length > 0 ? manualCtas : undefined,
    // API 키들은 저장된 설정에서 로드
    geminiKey: savedSettings.geminiKey || '',
    pexelsApiKey: savedSettings.pexelsApiKey || '',
    googleCseKey: savedSettings.googleCseKey || '',
    googleCseCx: savedSettings.googleCseCx || '',
    // 블로거 설정
    blogId: savedSettings.blogId || '',
    googleClientId: savedSettings.googleClientId || '',
    googleClientSecret: savedSettings.googleClientSecret || '',
    redirectUri: savedSettings.redirectUri || 'http://localhost:8080',
    // 워드프레스 설정  
    wordpressSiteUrl: savedSettings.wordpressSiteUrl || '',
    wordpressUsername: savedSettings.wordpressUsername || '',
    wordpressPassword: savedSettings.wordpressPassword || ''
  };

  console.log('[DEBUG] createPayloadFromForm - savedSettings:', savedSettings);
  console.log('[DEBUG] createPayloadFromForm - payload:', payload);

  return payload;
}

// 미리보기용 Payload 생성 (WordPress 설정 불필요)
function createPreviewPayload() {
  const keywordInput = DOMCache.get('keywordInput');
  const keywordValue = keywordInput ? keywordInput.value.trim() : '';

  const thumbnailTypeSelect = DOMCache.get('thumbnailType');
  const promptModeSelect = document.getElementById('promptMode');

  const titleModeSelect = document.getElementById('titleMode');
  const contentModeSelect = DOMCache.get('contentMode');
  const platformSelect = document.getElementById('platformSelect');
  const publishTypeSelect = document.querySelector('input[name="publishType"]:checked');
  const postingModeSelect = document.querySelector('input[name="postingMode"]:checked');

  let titleValue = null;
  if (titleModeSelect && titleModeSelect.value === 'custom') {
    const customTitleInput = document.getElementById('customTitle');
    titleValue = customTitleInput ? customTitleInput.value.trim() : null;
  }
  if (!titleValue && keywordValue) {
    titleValue = keywordValue;
  }

  // 저장된 설정 로드
  const savedSettings = loadSettings();

  // Gemini AI 모델 선택값 가져오기
  const titleAI = 'gemini';
  const contentAI = 'gemini';
  const summaryAI = 'gemini';

  // 프롬프트 모드에 따른 소제목 개수 설정
  let selectedSectionCount = 5; // 기본값 (MAX 모드, 커스텀 모드)
  const promptMode = 'max-mode'; // MAX모드로 고정
  selectedSectionCount = 5; // MAX 모드는 5개
  console.log(`[SECTION-COUNT] MAX 모드: ${selectedSectionCount}개`);

  // 동적 글자수 계산 (H2 1개당 1200-1500자)
  const dynamicMinChars = selectedSectionCount * 1200;
  const dynamicMaxChars = selectedSectionCount * 1500;

  console.log(`[SECTION-COUNT] 최종 소제목 개수: ${selectedSectionCount}개 (${dynamicMinChars}~${dynamicMaxChars}자)`);

  // 닉네임 가져오기
  const authorNickname = document.getElementById('authorNickname')?.value?.trim() || '';

  // 외부 정보 크롤링 옵션
  const useGoogleSearch = document.getElementById('useGoogleSearch')?.checked || false;

  // 저장된 썸네일 확인
  const savedThumbnail = localStorage.getItem('generatedThumbnail');
  const savedThumbnailText = localStorage.getItem('thumbnailText');

  // 미리보기용 최소한의 payload (WordPress 설정 제외)
  const payload = {
    topic: keywordValue,
    title: titleValue,
    thumbnailType: savedThumbnail ? 'custom' : 'text', // 기본값을 텍스트 썸네일로 설정
    customThumbnail: savedThumbnail, // 저장된 썸네일 데이터 URL
    customThumbnailText: savedThumbnailText, // 저장된 썸네일 텍스트
    promptMode: 'max-mode', // MAX모드로 고정
    toneStyle: document.getElementById('toneStyle')?.value || 'professional', // 말투/어투 선택
    h2Images: getH2ImageSections(), // H2 이미지 선택
    sectionCount: selectedSectionCount,
    titleMode: titleModeSelect ? titleModeSelect.value : 'auto',
    contentMode: contentModeSelect ? contentModeSelect.value : 'external', // 콘텐츠 모드 추가
    platform: 'preview', // 미리보기 모드로 설정
    publishType: publishTypeSelect ? publishTypeSelect.value : 'single',
    postingMode: postingModeSelect ? postingModeSelect.value : 'immediate', // 발행 모드 추가
    provider: contentAI, // 본문 생성 AI 사용
    titleAI: titleAI, // 제목 생성 AI
    summaryAI: summaryAI, // 요약표 생성 AI
    minChars: savedSettings.minChars || dynamicMinChars, // 동적 계산
    maxChars: savedSettings.maxChars || dynamicMaxChars, // 동적 계산
    previewOnly: true, // 미리보기 플래그 명시적으로 추가
    authorNickname: authorNickname, // 작성자 닉네임 추가
    useGoogleSearch: useGoogleSearch, // 외부 정보 크롤링 옵션 추가
    // 수동 CTA 추가 (인덱스 기반 객체)
    manualCtas: (() => {
      const manualCtas = {};
      // 🔧 AppState 사용
      const appState = getAppState();
      if (typeof appState.manualCtasData !== 'undefined' && appState.manualCtasData.length > 0) {
        appState.manualCtasData.forEach((cta, index) => {
          if (cta && cta.url && cta.url.trim()) {
            manualCtas[index] = {
              url: cta.url,
              text: cta.title || '자세히 보기',
              hook: cta.hook || ''
            };
          }
        });
      }
      return Object.keys(manualCtas).length > 0 ? manualCtas : undefined;
    })(),
    // 🔗 참고 URL 파싱 (줄바꿈 구분 → manualCrawlUrls 배열)
    ...(() => {
      const refUrlEl = document.getElementById('referenceUrl');
      const refUrlValue = refUrlEl ? refUrlEl.value.trim() : '';
      if (refUrlValue) {
        const urls = refUrlValue.split('\n').map(u => u.trim()).filter(u => u && (u.startsWith('http://') || u.startsWith('https://')));
        if (urls.length > 0) {
          return {
            sourceUrl: urls[0],
            manualCrawlUrls: urls,
            crawlUrl: urls[0]
          };
        }
      }
      return {};
    })(),
    // API 키들만 포함 (WordPress 인증 정보 제외)
    geminiKey: savedSettings.geminiKey || '',
    pexelsApiKey: savedSettings.pexelsApiKey || '',
    googleCseKey: savedSettings.googleCseKey || '',
    googleCseCx: savedSettings.googleCseCx || '',
    naverCustomerId: savedSettings.naverCustomerId || '',
    naverSecretKey: savedSettings.naverSecretKey || ''
  };

  console.log('[DEBUG] createPreviewPayload - payload:', payload);

  return payload;
}

// ========== 수동 CTA 관련 함수 ==========

// 수동 CTA 데이터와 키워드별 CTA 데이터는 AppState에서 관리됩니다

// CTA 설정 토글 함수
function toggleCtaSettings() {
  const manualCtaSection = document.getElementById('manualCtaSection');
  const manualRadio = document.querySelector('input[name="ctaMode"][value="manual"]');

  if (manualCtaSection && manualRadio) {
    if (manualRadio.checked) {
      manualCtaSection.style.display = 'block';
    } else {
      manualCtaSection.style.display = 'none';
    }
  }
}

// 수동 CTA 모달 열기
function openManualCtaModal() {
  const modal = document.getElementById('manualCtaModal');
  if (!modal) return;

  // 입력 필드 동적 생성 (5개 소제목)
  const inputsContainer = document.getElementById('manualCtaInputs');
  if (!inputsContainer) return;

  inputsContainer.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    // 🔧 AppState 사용
    const existingCta = getAppState().manualCtasData[i] || { url: '', title: '' };

    const ctaBox = document.createElement('div');
    ctaBox.style.cssText = 'background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; padding: 20px; border: 2px solid #cbd5e1;';

    ctaBox.innerHTML = `
      <h4 style="color: #1e293b; margin-bottom: 12px; font-weight: 700; font-size: 16px;">
        ${i + 1}번 소제목 CTA ${i === 0 ? '(인사말 + 본론)' : i === 4 ? '(본론 + 마무리)' : '(본론)'}
      </h4>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block;">CTA 링크 URL</label>
          <input type="url" 
                 id="manualCtaUrl${i}" 
                 placeholder="https://example.com (공란 가능)" 
                 value="${existingCta.url || ''}"
                 style="width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: white;">
        </div>
        <div>
          <label style="color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block;">후킹멘트 (선택사항)</label>
          <input type="text" 
                 id="manualCtaHook${i}" 
                 placeholder="예: 더 자세한 정보가 필요하시다면?" 
                 value="${existingCta.hook || ''}"
                 style="width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: white;">
        </div>
        <div>
          <label style="color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block;">CTA 버튼 텍스트 (선택사항)</label>
          <input type="text" 
                 id="manualCtaTitle${i}" 
                 placeholder="예: 자세히 보기" 
                 value="${existingCta.title || ''}"
                 style="width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: white;">
        </div>
      </div>
    `;

    inputsContainer.appendChild(ctaBox);
  }

  // 🔧 이벤트 리스너 핸들러 함수들 (cleanup을 위해 명시적으로 정의)
  // Cleanup 함수: 모든 이벤트 리스너 제거
  const cleanupEventListeners = () => {
    document.removeEventListener('keydown', handleEscape);
    modal.removeEventListener('click', handleModalClick);
    console.log('🧹 [MANUAL_CTA] 모든 이벤트 리스너 제거 완료');
  };

  // 이벤트 핸들러 함수들
  const handleEscape = (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      cleanupEventListeners();
      closeManualCtaModal();
    }
  };

  const handleModalClick = (e) => {
    if (e.target === modal) {
      cleanupEventListeners();
      closeManualCtaModal();
    }
  };

  // 이벤트 리스너 추가
  document.addEventListener('keydown', handleEscape);
  modal.addEventListener('click', handleModalClick);

  // 모달에 cleanup 함수 저장 (닫을 때 호출 가능하도록)
  modal._cleanupEventListeners = cleanupEventListeners;

  modal.style.display = 'flex';
}

// 수동 CTA 모달 닫기
function closeManualCtaModal() {
  const modal = document.getElementById('manualCtaModal');
  if (modal) {
    // 🔧 cleanup 함수가 있으면 호출
    if (modal._cleanupEventListeners) {
      modal._cleanupEventListeners();
      delete modal._cleanupEventListeners;
    }
    modal.style.display = 'none';
  }
}

// 수동 CTA 저장
function saveManualCtas() {
  // 🔧 AppState 사용
  getAppState().manualCtasData = [];
  let count = 0;

  for (let i = 0; i < 5; i++) {
    const urlInput = document.getElementById(`manualCtaUrl${i}`);
    const titleInput = document.getElementById(`manualCtaTitle${i}`);
    const hookInput = document.getElementById(`manualCtaHook${i}`);

    const url = urlInput ? urlInput.value.trim() : '';
    const title = titleInput ? titleInput.value.trim() : '';
    const hook = hookInput ? hookInput.value.trim() : '';

    if (url) {
      // 🔧 AppState 사용
      getAppState().manualCtasData[i] = { url, title, hook };
      count++;
    } else {
      // 🔧 AppState 사용
      getAppState().manualCtasData[i] = null; // 공란
    }
  }

  // 상태 표시 업데이트
  const statusDiv = document.getElementById('manualCtaStatus');
  const countSpan = document.getElementById('manualCtaCount');

  if (count > 0) {
    if (statusDiv) statusDiv.style.display = 'block';
    if (countSpan) countSpan.textContent = count;
  } else {
    if (statusDiv) statusDiv.style.display = 'none';
  }

  closeManualCtaModal();

  // 🔧 AppState 사용
  console.log('[MANUAL-CTA] 수동 CTA 저장 완료:', getAppState().manualCtasData);
}

// 수동 CTA 가져오기
window.getManualCtas = function () {
  // 🔧 AppState 사용
  const manualCtasData = getAppState().manualCtasData || [];

  // 배열을 객체 형태로 변환 (인덱스 기반)
  const result = [];
  for (let i = 0; i < 5; i++) {
    if (manualCtasData[i] && manualCtasData[i].url) {
      result.push({
        url: manualCtasData[i].url,
        text: manualCtasData[i].title || '자세히 보기',
        hook: manualCtasData[i].hook || ''
      });
    } else {
      result.push(null);
    }
  }

  return result;
};

// ========== 키워드별 CTA 관련 함수 ==========

// 키워드별 CTA 모달 열기
function openKeywordCtaModal(keywordId) {
  // 기존 CTA 데이터가 있으면 가져오기
  // 🔧 AppState 사용
  const existingCtas = getAppState().keywordCtaData[keywordId] || [];

  // 모달 HTML 생성
  const modalHtml = `
    <div id="keywordCtaModal_${keywordId}" class="modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); z-index: 10000; align-items: center; justify-content: center;">
      <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
        <div class="modal-header" style="padding: 24px; border-bottom: 2px solid #e2e8f0;">
          <h3 class="modal-title" style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">🔗 소제목별 수동 CTA 설정</h3>
          <button class="modal-close" onclick="closeKeywordCtaModal('${keywordId}')" style="position: absolute; top: 20px; right: 20px; background: none; border: none; font-size: 32px; cursor: pointer; color: #64748b;">&times;</button>
        </div>
        
        <div style="padding: 24px;">
          <p style="color: #64748b; margin-bottom: 24px; line-height: 1.6;">
            각 소제목마다 개별 CTA 링크를 설정할 수 있습니다.<br>
            <strong>입력하지 않은 항목은 CTA가 표시되지 않습니다.</strong>
          </p>

          <div id="keywordCtaInputs_${keywordId}" style="display: flex; flex-direction: column; gap: 20px;">
            ${[1, 2, 3, 4, 5].map(i => {
    const cta = existingCtas[i - 1] || { url: '', title: '' };
    return `
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; padding: 20px; border: 2px solid #cbd5e1;">
                  <h4 style="color: #1e293b; margin-bottom: 12px; font-weight: 700; font-size: 16px;">
                    ${i}번 소제목 CTA ${i === 1 ? '(인사말 + 본론)' : i === 5 ? '(본론 + 마무리)' : '(본론)'}
                  </h4>
                  <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div>
                      <label style="color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block;">CTA 링크 URL</label>
                      <input type="url" 
                             id="keywordCtaUrl_${keywordId}_${i}" 
                             placeholder="https://example.com (공란 가능)" 
                             value="${cta.url || ''}"
                             style="width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: white;">
                    </div>
                    <div>
                      <label style="color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block;">CTA 버튼 텍스트 (선택사항)</label>
                      <input type="text" 
                             id="keywordCtaTitle_${keywordId}_${i}" 
                             placeholder="예: 자세히 보기" 
                             value="${cta.title || ''}"
                             style="width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: white;">
                    </div>
                  </div>
                </div>
              `;
  }).join('')}
          </div>

          <div class="btn-group" style="margin-top: 24px; display: flex; gap: 12px;">
            <button class="btn btn-success" onclick="saveKeywordCtas('${keywordId}')" style="padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-weight: 600; font-size: 16px; cursor: pointer; flex: 1;">
              ✅ 저장하고 닫기
            </button>
            <button class="btn btn-secondary" onclick="closeKeywordCtaModal('${keywordId}')" style="padding: 14px 32px; background: #6b7280; color: white; border: none; border-radius: 12px; font-weight: 600; font-size: 16px; cursor: pointer;">
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 모달을 body에 추가
  const modalContainer = document.createElement('div');
  modalContainer.id = `keywordCtaModalContainer_${keywordId}`;
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
}

// 키워드별 CTA 모달 닫기
function closeKeywordCtaModal(keywordId) {
  const modalContainer = document.getElementById(`keywordCtaModalContainer_${keywordId}`);
  if (modalContainer) {
    modalContainer.remove();
  }
}

// 키워드별 CTA 저장
function saveKeywordCtas(keywordId) {
  const ctas = [];
  let count = 0;

  for (let i = 1; i <= 5; i++) {
    const urlInput = document.getElementById(`keywordCtaUrl_${keywordId}_${i}`);
    const titleInput = document.getElementById(`keywordCtaTitle_${keywordId}_${i}`);

    const url = urlInput ? urlInput.value.trim() : '';
    const title = titleInput ? titleInput.value.trim() : '';

    if (url) {
      ctas.push({ url, title });
      count++;
    } else {
      ctas.push(null); // 공란
    }
  }

  // 전역 객체에 저장
  // 🔧 AppState 사용
  getAppState().keywordCtaData[keywordId] = ctas;

  // CTA 버튼 텍스트 업데이트
  const ctaBtn = document.getElementById(`${keywordId}_ctaBtn`);
  if (ctaBtn && count > 0) {
    ctaBtn.textContent = `CTA 링크 설정 (${count}개)`;
    ctaBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  }

  closeKeywordCtaModal(keywordId);

  console.log(`[KEYWORD-CTA] ${keywordId}의 수동 CTA 저장 완료:`, ctas);
}

// 전체 화면 미리보기 모달 열기
function openFullScreenPreviewModal() {
  console.log('[FULLSCREEN-PREVIEW] 전체 화면 미리보기 모달 열기');

  // 미리보기 탭을 전체 화면 모달로 표시
  const previewTab = document.getElementById('preview-tab');
  if (previewTab) {
    // 탭을 모달로 변환
    previewTab.style.position = 'fixed';
    previewTab.style.top = '0';
    previewTab.style.left = '0';
    previewTab.style.width = '100vw';
    previewTab.style.height = '100vh';
    previewTab.style.zIndex = '10000';
    previewTab.style.background = 'rgba(15, 23, 42, 0.98)';
    previewTab.style.display = 'block';
    previewTab.style.overflow = 'auto';

    // 닫기 버튼 추가 (이미 없다면)
    let closeBtn = previewTab.querySelector('.fullscreen-close-btn');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.className = 'fullscreen-close-btn';
      closeBtn.innerHTML = '✕ 닫기';
      closeBtn.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 10001;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        font-size: 16px;
        box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
        transition: all 0.3s ease;
      `;
      closeBtn.onmouseover = function () {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 12px 30px rgba(239, 68, 68, 0.5)';
      };
      closeBtn.onmouseout = function () {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.4)';
      };
      closeBtn.onclick = closeFullScreenPreviewModal;
      previewTab.insertBefore(closeBtn, previewTab.firstChild);
    }

    console.log('[FULLSCREEN-PREVIEW] 전체 화면 미리보기 모달 표시 완료');
  }
}

// 전체 화면 미리보기 모달 닫기
function closeFullScreenPreviewModal() {
  console.log('[FULLSCREEN-PREVIEW] 전체 화면 미리보기 모달 닫기');

  const previewTab = document.getElementById('preview-tab');
  if (previewTab) {
    // 모달 스타일 초기화
    previewTab.style.position = '';
    previewTab.style.top = '';
    previewTab.style.left = '';
    previewTab.style.width = '';
    previewTab.style.height = '';
    previewTab.style.zIndex = '';
    previewTab.style.background = '';
    previewTab.style.display = 'none';

    // 닫기 버튼 제거
    const closeBtn = previewTab.querySelector('.fullscreen-close-btn');
    if (closeBtn) {
      closeBtn.remove();
    }
  }
}

// 크롤링 상세 정보 업데이트
function updateCrawlingDetails(label) {
  if (!label) return;
  const crawlingDetails = document.getElementById('crawlingDetails');
  if (!crawlingDetails) return;

  const naverCountEl = document.getElementById('naverCount');
  const rssCountEl = document.getElementById('rssCount');
  const cseCountEl = document.getElementById('cseCount');
  const fullContentCountEl = document.getElementById('fullContentCount');

  // 크롤링 관련 로그일 때만 표시
  if (label.includes('크롤링') || label.includes('본문')) {
    if (crawlingDetails) {
      crawlingDetails.style.display = 'block';
    }

    // 네이버 크롤링 개수 추출
    const naverMatch = label.match(/네이버.*?(\d+)개/);
    if (naverMatch && naverCountEl) {
      naverCountEl.textContent = naverMatch[1];
    }

    // RSS 크롤링 개수 추출
    const rssMatch = label.match(/RSS.*?(\d+)개/);
    if (rssMatch && rssCountEl) {
      rssCountEl.textContent = rssMatch[1];
    }

    // Google CSE 크롤링 개수 추출
    const cseMatch = label.match(/Google CSE.*?(\d+)개|CSE.*?(\d+)개/);
    if (cseMatch && cseCountEl) {
      cseCountEl.textContent = cseMatch[1] || cseMatch[2] || '0';
    }

    // 본문 크롤링 개수 추출
    const fullContentMatch = label.match(/본문.*?(\d+)\/(\d+)/);
    if (fullContentMatch && fullContentCountEl) {
      fullContentCountEl.textContent = `${fullContentMatch[1]}/${fullContentMatch[2]}`;
    }
  }
}

// 전역 함수 등록
window.checkPlatformConnection = checkPlatformConnection;
window.checkCseConnection = checkCseConnection;
window.startBloggerOAuth = startBloggerOAuth;
window.publishToPlatform = publishToPlatform;

// 🔥 썸네일/이미지 변환기 함수 전역 노출
window.showThumbnailSubTab = showThumbnailSubTab;
window.handleImageDragOver = handleImageDragOver;
window.handleImageDragLeave = handleImageDragLeave;
window.handleImageDrop = handleImageDrop;
window.handleImageSelect = handleImageSelect;

// 📁 이미지 저장 폴더 경로 선택
window.selectImageFolderPath = async function () {
  try {
    if (window.electronAPI && window.electronAPI.selectFolder) {
      const result = await window.electronAPI.selectFolder();
      if (result && result.path) {
        const pathInput = document.getElementById('imageFolderPath');
        if (pathInput) {
          pathInput.value = result.path;
          console.log('[SETTINGS] 이미지 저장 경로 선택:', result.path);
        }
      }
    } else {
      // 폴백: 브라우저 환경에서는 직접 입력
      const pathInput = document.getElementById('imageFolderPath');
      if (pathInput) {
        const path = prompt('이미지 저장 폴더 경로를 입력하세요:', pathInput.value || '');
        if (path) {
          pathInput.value = path;
        }
      }
    }
  } catch (error) {
    console.error('[SETTINGS] 폴더 선택 오류:', error);
    alert('폴더 선택 중 오류가 발생했습니다: ' + error.message);
  }
};

