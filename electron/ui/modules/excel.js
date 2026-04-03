// 🔧 엑셀 배치 처리 관련 함수들
import { addLog, debugLog, getErrorHandler } from './core.js';
import { runExcelBatch as callExcelBatch, downloadExcelResults as callDownloadExcelResults } from './api.js';

// 엑셀 파일 선택 핸들러
export function handleExcelFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleExcelFile(file);
  }
}

// 엑셀 파일 처리
export function handleExcelFile(file) {
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    addLog('❌ .xlsx 또는 .xls 파일만 업로드 가능합니다.', 'error');
    return;
  }
  
  addLog(`📄 엑셀 파일 선택됨: ${file.name}`, 'info');
  
  // 파일 정보 표시
  const fileInfo = document.getElementById('excelFileInfo');
  if (fileInfo) {
    fileInfo.textContent = `선택된 파일: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
  }
}

// 엑셀 템플릿 다운로드
export function downloadExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    alert('❌ XLSX 라이브러리가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
    return;
  }
  
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const example1 = new Date(kstNow.getTime() + (60 * 60 * 1000));
  const example2 = new Date(kstNow.getTime() + (24 * 60 * 60 * 1000));
  
  const formatKSTDateTime = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes} (KST)`;
  };
  
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
    const ws = XLSX.utils.json_to_sheet(templateData);
    const colWidths = [
      { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '포스팅 템플릿');
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `블로그_포스팅_템플릿_${timestamp}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    
    console.log('✅ 엑셀 템플릿 다운로드 완료:', filename);
    
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

// 엑셀 배치 처리 실행
export async function runExcelBatch() {
  const fileInput = document.getElementById('excelFile');
  if (!fileInput.files || fileInput.files.length === 0) {
    addLog('❌ 먼저 엑셀 파일을 선택해주세요.', 'error');
    return;
  }
  
  const file = fileInput.files[0];
  addLog(`🚀 엑셀 배치 처리 시작: ${file.name}`, 'info');
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = e.target.result;
      
      addLog('📤 백엔드에 엑셀 데이터 전송 중...', 'info');
      
      const result = await callExcelBatch({
        fileName: file.name,
        fileData: data,
        settings: {
          platform: document.querySelector('input[name="platform"]:checked')?.value || 'wordpress',
          contentMode: document.getElementById('contentMode')?.value || 'external',
          promptMode: 'max-mode',
          h2Images: getH2ImageSections(),
          toneStyle: document.getElementById('toneStyle')?.value || 'professional'
        }
      });
      
      if (result.ok) {
        addLog(`✅ 배치 처리 완료! 총 ${result.processedCount || 0}개 포스팅 처리됨`, 'success');
        
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
    } catch (error) {
      getErrorHandler().handle(error, { function: 'runExcelBatch' });
    }
  };
  
  reader.readAsArrayBuffer(file);
}

// 엑셀 결과 다운로드
export async function downloadExcelResults() {
  try {
    addLog('📥 결과 파일 다운로드 중...', 'info');
    
    const result = await callDownloadExcelResults();
    
    if (result.ok) {
      addLog('✅ 결과 파일 다운로드 완료!', 'success');
      
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
  } catch (error) {
    getErrorHandler().handle(error, { function: 'downloadExcelResults' });
  }
}

// 엑셀 결과 지우기
export function clearExcelResults() {
  const resultsDiv = document.getElementById('excelResults');
  if (resultsDiv) {
    resultsDiv.innerHTML = '';
  }
  addLog('🗑️ 엑셀 결과가 지워졌습니다.', 'info');
}

// 엑셀 드롭존 설정
export function setupExcelDropZone() {
  const dropZone = document.getElementById('excelDropZone');
  const fileInput = document.getElementById('excelFile');
  
  if (!dropZone || !fileInput) return;
  
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#4ade80';
    dropZone.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    dropZone.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    dropZone.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        fileInput.files = files;
        handleExcelFile(file);
      } else {
        addLog('❌ .xlsx 또는 .xls 파일만 업로드 가능합니다.', 'error');
      }
    }
  });
}

// 헬퍼 함수
function getH2ImageSections() {
  const selectedSections = Array.from(document.querySelectorAll('input[name="h2Sections"]:checked'))
    .map(input => parseInt(input.value));
  return selectedSections;
}




