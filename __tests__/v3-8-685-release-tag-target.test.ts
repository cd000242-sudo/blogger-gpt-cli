/**
 * v3.8.685 — 릴리스 태그는 이 커밋에 찍는다 (2026-09-06 자동 업데이트 사고 재발 방지)
 *
 * 사고: master 를 푸시하지 않은 채 gh 가 릴리스를 만들자 태그가 원격 master(옛 커밋, 3.8.620)에 찍혔다.
 * 그 태그를 체크아웃하는 맥 워크플로가 package.json 3.8.620 을 읽어 "v3.8.620" 릴리스를 새로 만들었고,
 * 깃허브 latest 는 마지막에 published 된 것이라 620 이 최신이 됐다 → 설치된 앱(668)이 업데이트를 멈췄다.
 *
 * 이 테스트는 스크립트 본문의 순서를 잠근다: 푸시 → 태그 대상 명시 → 릴리스 생성.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const script = read('scripts/publish-release.js');
const macWorkflow = read('.github/workflows/mac-release.yml');

describe('v3.8.685 publish-release — 태그 대상 커밋', () => {
  it('릴리스를 만지기 전에 master 를 밀어 올린다', () => {
    const pushAt = script.indexOf("git push origin HEAD:master");
    const viewAt = script.indexOf('gh release view');
    expect(pushAt).toBeGreaterThan(0);
    expect(viewAt).toBeGreaterThan(pushAt);
  });

  it('gh 로 태그를 만들 땐 HEAD 커밋을 --target 으로 명시한다', () => {
    expect(script).toContain("headSha = execSync('git rev-parse HEAD'");
    expect(script).toContain('const targetArg = headSha ? ` --target ${headSha}` : \'\'');
    expect(script).toContain('--repo ${owner}/${repo}${targetArg}');
  });

  it('푸시가 실패해도 릴리스는 이어가되 경고를 남긴다 (조용한 실패 금지)', () => {
    expect(script).toContain('master 푸시 실패');
  });

  it('맥 워크플로가 릴리스 태그를 체크아웃한다 — 태그가 옛 커밋이면 옛 버전을 낸다 (결합 기록)', () => {
    expect(macWorkflow).toContain('github.event.release.tag_name');
  });
});
