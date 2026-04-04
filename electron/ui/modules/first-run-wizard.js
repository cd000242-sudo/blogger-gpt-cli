// electron/ui/modules/first-run-wizard.js
// 첫 실행 세팅 위저드 — 3분 안에 첫 글 생성까지 안내

import { addLog } from './core.js';

const WIZARD_COMPLETE_KEY = 'leadernam_wizard_complete';

/**
 * 첫 실행 여부를 확인하고, 미완료 시 위저드를 표시한다.
 */
export function checkFirstRun() {
  const completed = localStorage.getItem(WIZARD_COMPLETE_KEY);
  if (completed === 'true') return;

  // 약간의 딜레이 후 위저드 표시 (앱 로딩 완료 대기)
  setTimeout(() => showFirstRunWizard(), 1500);
}

function showFirstRunWizard() {
  // 이미 위저드가 열려있으면 무시
  if (document.getElementById('first-run-wizard-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'first-run-wizard-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '처음 사용 설정 마법사');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 100000;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.3s ease;
  `;

  overlay.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      border-radius: 24px; padding: 0; width: 90%; max-width: 520px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5); overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
    ">
      <!-- 헤더 -->
      <div style="
        background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
        padding: 32px 32px 24px; text-align: center;
      ">
        <div style="font-size: 40px; margin-bottom: 8px;">🚀</div>
        <h2 style="color: white; font-size: 24px; font-weight: 800; margin: 0 0 8px 0;">
          LEADERNAM Orbit에 오신 걸 환영해요!
        </h2>
        <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">
          3분이면 첫 AI 블로그 글을 만들 수 있어요
        </p>
      </div>

      <!-- 스텝 컨텐츠 -->
      <div id="wizard-content" style="padding: 28px 32px;">
        <!-- Step 1: API 키 -->
        <div id="wizard-step-1" class="wizard-step">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <div style="
              background: linear-gradient(135deg, #6366f1, #a855f7);
              color: white; width: 32px; height: 32px; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-weight: 700; font-size: 14px; flex-shrink: 0;
            ">1</div>
            <div>
              <div style="color: white; font-weight: 700; font-size: 16px;">AI 엔진 연결</div>
              <div style="color: rgba(255,255,255,0.6); font-size: 12px;">Gemini API 키 하나만 있으면 돼요</div>
            </div>
          </div>
          <div style="margin-bottom: 16px;">
            <label for="wizard-gemini-key" style="color: rgba(255,255,255,0.8); font-size: 13px; display: block; margin-bottom: 6px;">
              Gemini API 키 <a href="https://aistudio.google.com/apikey" target="_blank" style="color: #818cf8; text-decoration: none; font-size: 12px;">(무료 발급받기 →)</a>
            </label>
            <input type="text" id="wizard-gemini-key"
              placeholder="AIza... 형태의 API 키를 붙여넣기"
              aria-label="Gemini API 키 입력"
              style="
                width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2); border-radius: 10px;
                color: white; font-size: 14px; outline: none; box-sizing: border-box;
                transition: border-color 0.2s;
              "
              onfocus="this.style.borderColor='#818cf8'"
              onblur="this.style.borderColor='rgba(255,255,255,0.2)'"
            />
          </div>
          <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0; line-height: 1.5;">
            💡 Google AI Studio에서 무료로 API 키를 받을 수 있어요. 30초면 됩니다!
          </p>
        </div>

        <!-- Step 2: 플랫폼 선택 -->
        <div id="wizard-step-2" class="wizard-step" style="display: none;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <div style="
              background: linear-gradient(135deg, #6366f1, #a855f7);
              color: white; width: 32px; height: 32px; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-weight: 700; font-size: 14px; flex-shrink: 0;
            ">2</div>
            <div>
              <div style="color: white; font-weight: 700; font-size: 16px;">블로그 플랫폼 선택</div>
              <div style="color: rgba(255,255,255,0.6); font-size: 12px;">어디에 글을 올릴 건가요?</div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <button id="wizard-platform-blogger" onclick="wizardSelectPlatform('blogspot')" style="
              padding: 20px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15);
              border-radius: 14px; cursor: pointer; text-align: center; transition: all 0.2s; color: white;
            " onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="if(!this.classList.contains('selected'))this.style.background='rgba(255,255,255,0.08)'">
              <div style="font-size: 32px; margin-bottom: 8px;">📝</div>
              <div style="font-weight: 700; font-size: 15px;">Blogger</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px;">구글 블로그스팟</div>
            </button>
            <button id="wizard-platform-wordpress" onclick="wizardSelectPlatform('wordpress')" style="
              padding: 20px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15);
              border-radius: 14px; cursor: pointer; text-align: center; transition: all 0.2s; color: white;
            " onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="if(!this.classList.contains('selected'))this.style.background='rgba(255,255,255,0.08)'">
              <div style="font-size: 32px; margin-bottom: 8px;">🌐</div>
              <div style="font-weight: 700; font-size: 15px;">WordPress</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px;">워드프레스 블로그</div>
            </button>
          </div>
        </div>

        <!-- Step 3: 완료 -->
        <div id="wizard-step-3" class="wizard-step" style="display: none;">
          <div style="text-align: center; padding: 16px 0;">
            <div style="font-size: 56px; margin-bottom: 12px;">🎉</div>
            <h3 style="color: white; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">
              설정 완료! 첫 글을 써볼까요?
            </h3>
            <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0 0 20px 0; line-height: 1.6;">
              메인 화면에서 키워드를 입력하면<br>AI가 자동으로 블로그 글을 작성해줘요.
            </p>
            <div style="
              background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3);
              border-radius: 12px; padding: 16px; text-align: left;
            ">
              <div style="color: #a5b4fc; font-weight: 600; font-size: 13px; margin-bottom: 8px;">💡 시작하는 법</div>
              <ol style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0; padding-left: 20px; line-height: 2;">
                <li>먼저 <strong style="color: #c4b5fd;">원클릭세팅</strong>으로 블로그를 설정</li>
                <li>메인 화면에서 <strong style="color: #c4b5fd;">키워드</strong>를 입력</li>
                <li><strong style="color: #c4b5fd;">AI 글 생성하기</strong> 버튼 클릭</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <!-- 진행 표시 + 버튼 -->
      <div style="padding: 0 32px 28px; display: flex; align-items: center; justify-content: space-between;">
        <div id="wizard-dots" style="display: flex; gap: 8px;">
          <div class="wizard-dot active" style="width: 24px; height: 6px; border-radius: 3px; background: #6366f1; transition: all 0.3s;"></div>
          <div class="wizard-dot" style="width: 12px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.2); transition: all 0.3s;"></div>
          <div class="wizard-dot" style="width: 12px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.2); transition: all 0.3s;"></div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="wizard-skip-btn" onclick="wizardComplete()" style="
            padding: 10px 16px; background: none; border: 1px solid rgba(255,255,255,0.2);
            border-radius: 10px; color: rgba(255,255,255,0.6); font-size: 13px;
            cursor: pointer; transition: all 0.2s;
          " onmouseover="this.style.borderColor='rgba(255,255,255,0.4)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.2)'">
            건너뛰기
          </button>
          <button id="wizard-next-btn" onclick="wizardNext()" style="
            padding: 10px 24px; background: linear-gradient(135deg, #6366f1, #a855f7);
            border: none; border-radius: 10px; color: white; font-size: 14px;
            font-weight: 600; cursor: pointer; transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(99,102,241,0.3);
          " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
            다음 →
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  addLog('[WIZARD] 첫 실행 세팅 위저드 표시');

  // Focus trap
  const firstInput = overlay.querySelector('input');
  if (firstInput) firstInput.focus();
}

let wizardStep = 1;
let wizardPlatform = '';

window.wizardSelectPlatform = function(platform) {
  wizardPlatform = platform;
  // Visual feedback
  const bloggerBtn = document.getElementById('wizard-platform-blogger');
  const wpBtn = document.getElementById('wizard-platform-wordpress');

  [bloggerBtn, wpBtn].forEach(btn => {
    if (btn) {
      btn.style.background = 'rgba(255,255,255,0.08)';
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
      btn.classList.remove('selected');
    }
  });

  const selected = platform === 'blogspot' ? bloggerBtn : wpBtn;
  if (selected) {
    selected.style.background = 'rgba(99,102,241,0.3)';
    selected.style.borderColor = '#6366f1';
    selected.classList.add('selected');
  }
};

window.wizardNext = function() {
  if (wizardStep === 1) {
    // Save Gemini key
    const keyInput = document.getElementById('wizard-gemini-key');
    const key = keyInput ? keyInput.value.trim() : '';
    if (key) {
      // Save to settings
      const geminiInput = document.getElementById('geminiKey');
      if (geminiInput) geminiInput.value = key;
      addLog(`[WIZARD] Gemini API 키 설정 완료`);
    }
    wizardStep = 2;
    showWizardStep(2);
  } else if (wizardStep === 2) {
    // Save platform
    if (wizardPlatform) {
      const platformRadio = document.querySelector(`input[name="platform"][value="${wizardPlatform}"]`);
      if (platformRadio) platformRadio.checked = true;
      addLog(`[WIZARD] 플랫폼 선택: ${wizardPlatform}`);
    }
    wizardStep = 3;
    showWizardStep(3);
    // Change button text
    const nextBtn = document.getElementById('wizard-next-btn');
    if (nextBtn) nextBtn.textContent = '원클릭세팅 시작 🚀';
    const skipBtn = document.getElementById('wizard-skip-btn');
    if (skipBtn) skipBtn.style.display = 'none';
  } else if (wizardStep === 3) {
    wizardComplete();
  }
};

function showWizardStep(step) {
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach(el => {
    el.style.display = 'none';
  });
  // Show target step
  const target = document.getElementById(`wizard-step-${step}`);
  if (target) target.style.display = 'block';

  // Update dots
  const dots = document.querySelectorAll('.wizard-dot');
  dots.forEach((dot, idx) => {
    if (idx < step) {
      dot.style.background = '#6366f1';
      dot.style.width = idx === step - 1 ? '24px' : '12px';
    } else {
      dot.style.background = 'rgba(255,255,255,0.2)';
      dot.style.width = '12px';
    }
  });
}

window.wizardComplete = function() {
  localStorage.setItem(WIZARD_COMPLETE_KEY, 'true');

  // Try to save settings
  try {
    const saveBtn = document.querySelector('[onclick*="saveSettings"]');
    if (saveBtn) saveBtn.click();
  } catch { /* ignore */ }

  // Remove overlay with animation
  const overlay = document.getElementById('first-run-wizard-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  }

  // 원클릭세팅 탭으로 안내
  setTimeout(() => {
    if (typeof showTab === 'function') {
      showTab('settings');
    }
    // 원클릭세팅 모달 열기 시도
    setTimeout(() => {
      const oneclickBtn = document.querySelector('[onclick*="oneclick"], [onclick*="oneclickSetup"]');
      if (oneclickBtn) oneclickBtn.click();
    }, 500);
  }, 500);

  addLog('[WIZARD] 첫 실행 세팅 완료!');
};

export function initFirstRunWizard() {
  checkFirstRun();
}
