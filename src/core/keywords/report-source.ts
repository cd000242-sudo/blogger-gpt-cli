/**
 * 📂 리포트 파일 찾기 — 폴더를 보고 **새로 생긴 것**을 집는다 (v3.8.631)
 *
 * ## 왜 시각이 아니라 파일을 보나
 * 사장님: "클로드코드 할당량이 다되면 자연스럽게 막히거든 다시 할당량
 *         초기화되면 다시 생성되니까 자동으로 생성되는걸감지해서 가져오게끔"
 *
 * 리포트가 몇 시에 만들어질지 모른다. 할당량이 막히면 몇 시간 뒤에 만들어진다.
 * 그래서 "매일 아침 9시에 읽는다" 같은 방식은 못 쓴다.
 * **폴더에 새 파일이 나타났는가**만 본다.
 *
 * ## 사생활 — 이 코드에는 아무 흔적이 없다
 * 사장님: "이걸 사용자가 다볼수있게하고싶지는않아 이건 내꺼라서"
 *
 * 폴더 경로를 여기 적지 않는다. 계정도, 폴더 ID 도 없다. 경로는 **로컬 설정에만**
 * 있고, 설정이 없으면 이 기능은 아예 켜지지 않는다.
 * 실행파일(asar)은 누구나 열 수 있으므로, 코드에 적으면 그 순간 공개된다.
 *
 * 이 파일이 아는 것은 "폴더를 받으면 그 안에서 제일 새 리포트를 찾는다" 뿐이다.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseCpcReport, type CpcReport } from './cpc-report';

/** 리포트로 볼 파일 이름 — 날짜가 앞에 오고 확장자가 문서 계열인 것 */
const REPORT_NAME = /(\d{4}-\d{2}-\d{2}).*\.(?:md|markdown|txt)$/i;

export interface FoundReport {
  filePath: string;
  fileName: string;
  /** 파일 이름에서 읽은 날짜 */
  date: string;
  /** 파일이 마지막으로 바뀐 시각 (밀리초) */
  mtimeMs: number;
}

/**
 * 폴더에서 제일 최근 리포트를 찾는다.
 *
 * 이름의 날짜를 1순위로 본다 — 파일을 나중에 복사하면 mtime 이 뒤집히기 때문이다.
 * 날짜가 같으면 mtime 이 늦은 쪽을 쓴다(같은 날 다시 만든 경우).
 */
export function findLatestReport(dir: string): FoundReport | null {
  const folder = String(dir || '').trim();
  if (!folder) return null;

  let names: string[];
  try {
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return null;
    names = fs.readdirSync(folder);
  } catch {
    return null;   // 못 읽는 폴더는 없는 것으로 본다 — 발행을 막지 않는다
  }

  const found: FoundReport[] = [];
  for (const name of names) {
    const m = name.match(REPORT_NAME);
    if (!m) continue;
    const filePath = path.join(folder, name);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;
      found.push({ filePath, fileName: name, date: m[1]!, mtimeMs: stat.mtimeMs });
    } catch { /* 사라진 파일은 건너뛴다 */ }
  }

  if (found.length === 0) return null;
  found.sort((a, b) => (a.date === b.date ? b.mtimeMs - a.mtimeMs : (a.date < b.date ? 1 : -1)));
  return found[0]!;
}

/** 마지막으로 가져온 리포트 — 같은 것을 두 번 쓰지 않기 위해 남긴다 */
export interface ImportState {
  fileName: string;
  mtimeMs: number;
  importedAt: string;
}

/** 이 리포트가 지난번에 가져온 것과 다른가 */
export function isNewReport(found: FoundReport | null, state: ImportState | null): boolean {
  if (!found) return false;
  if (!state) return true;
  if (found.fileName !== state.fileName) return true;
  // 같은 이름이라도 내용이 갱신됐으면 새 것으로 본다 (같은 날 다시 만든 경우)
  return found.mtimeMs > state.mtimeMs;
}

export function readImportState(statePath: string): ImportState | null {
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.fileName !== 'string') return null;
    return { fileName: parsed.fileName, mtimeMs: Number(parsed.mtimeMs) || 0, importedAt: String(parsed.importedAt || '') };
  } catch {
    return null;   // 기록이 없거나 깨졌으면 "처음" 으로 본다
  }
}

export function writeImportState(statePath: string, found: FoundReport): void {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(
      statePath,
      JSON.stringify({ fileName: found.fileName, mtimeMs: found.mtimeMs, importedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    );
  } catch { /* 기록 실패가 발행을 막지는 않는다 */ }
}

export interface LoadResult {
  /** 설정이 없거나 파일이 없으면 null — 기능이 꺼진 상태다 */
  report: CpcReport | null;
  found: FoundReport | null;
  /** 지난번과 다른 리포트인가 */
  isNew: boolean;
  /** 사람이 읽을 한 줄 */
  note: string;
}

/**
 * 폴더에서 리포트를 읽어 파싱까지 한다.
 * 어떤 실패도 예외로 던지지 않는다 — 리포트가 없어도 앱은 평소대로 돌아야 한다.
 */
export function loadLatestReport(dir: string, statePath: string): LoadResult {
  const found = findLatestReport(dir);
  if (!found) {
    return { report: null, found: null, isNew: false, note: '리포트 폴더에 읽을 파일이 없습니다' };
  }

  let markdown = '';
  try {
    markdown = fs.readFileSync(found.filePath, 'utf-8');
  } catch (error: any) {
    return { report: null, found, isNew: false, note: `리포트를 못 읽었습니다: ${String(error?.message || error).slice(0, 60)}` };
  }

  let report: CpcReport | null = null;
  try {
    report = parseCpcReport(markdown);
  } catch (error: any) {
    return { report: null, found, isNew: false, note: `리포트 형식을 못 알아봤습니다: ${String(error?.message || error).slice(0, 60)}` };
  }

  const state = readImportState(statePath);
  const isNew = isNewReport(found, state);
  const usable = report.slots.filter((s) => !s.empty && (s.keyword || s.title)).length;
  return {
    report,
    found,
    isNew,
    note: `${found.date} 리포트 — 쓸 수 있는 슬롯 ${usable}개${isNew ? ' (새 리포트)' : ' (이미 가져온 것)'}`,
  };
}
