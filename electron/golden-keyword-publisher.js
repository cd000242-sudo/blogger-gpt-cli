"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasGoldenToken = hasGoldenToken;
exports.saveGoldenToken = saveGoldenToken;
exports.publishGoldenKeyword = publishGoldenKeyword;
/**
 * 황금키워드 배포 — 관리자가 저장하면 그 자리에서 GitHub 에 올린다.
 *
 * 관리자는 개발 PC 로 열 때도 있고 설치된 앱으로 열 때도 있어서, 환경을 보고 경로를 고른다.
 *   1) 레포가 있으면  → data/golden-keyword.json 을 쓰고 git commit + push (기존 git 인증 사용)
 *   2) 레포가 없으면  → GitHub Contents API 로 직접 커밋 (관리자 PC 에 저장한 토큰 사용)
 *
 * 어느 쪽이든 결과는 같다: 사용자 앱들이 raw URL 로 읽어가는 파일 하나가 갱신된다.
 * 토큰은 관리자 PC 의 userData 에만 두고 앱에 하드코딩하지 않는다 — 배포본에는 들어가지 않는다.
 */
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/** 사용자 앱이 읽는 raw URL 의 브랜치/경로와 반드시 같아야 한다 (index.html GOLDEN_KEYWORD_REMOTE_URL) */
const REPO_BRANCH = 'master';
const REPO_REL_PATH = 'data/golden-keyword.json';
function tokenPath() {
    return path.join(electron_1.app.getPath('userData'), 'golden-keyword-token.json');
}
/** 토큰 값 자체는 절대 렌더러로 돌려주지 않는다 — 있는지 여부만 알려준다 */
function hasGoldenToken() {
    try {
        return Boolean(readGoldenToken());
    }
    catch {
        return false;
    }
}
function readGoldenToken() {
    try {
        const raw = fs.readFileSync(tokenPath(), 'utf-8');
        return String(JSON.parse(raw)?.token || '').trim();
    }
    catch {
        return '';
    }
}
function saveGoldenToken(token) {
    const trimmed = String(token || '').trim();
    if (!trimmed)
        return { ok: false, error: '토큰이 비어 있습니다.' };
    try {
        fs.writeFileSync(tokenPath(), JSON.stringify({ token: trimmed }, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '토큰 저장 실패' };
    }
}
/** 레포 안에서 돌고 있는가 — 개발 PC 판별 */
function findRepoRoot() {
    const root = path.join(__dirname, '..');
    return fs.existsSync(path.join(root, '.git')) ? root : null;
}
/** 릴리스 설정과 같은 곳에서 읽어 배포 대상이 어긋나지 않게 한다 */
function getRepoTarget() {
    try {
        const pkg = require('../package.json');
        const cfg = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build?.publish;
        return { owner: cfg?.owner || 'cd000242-sudo', repo: cfg?.repo || 'blogger-gpt-cli' };
    }
    catch {
        return { owner: 'cd000242-sudo', repo: 'blogger-gpt-cli' };
    }
}
/** 배포본에는 화면에 필요한 값만 담는다 (savedAt 등 로컬 전용 필드는 제외) */
function buildContent(payload) {
    return `${JSON.stringify({
        reportDate: String(payload.reportDate || ''),
        updatedAt: Number(payload.updatedAt) || Date.now(),
        items: payload.items,
    }, null, 2)}\n`;
}
function buildMessage(payload) {
    return `chore: 황금키워드 ${payload.reportDate || '갱신'} (${payload.items.length}건)`;
}
/** 레포가 있는 개발 PC — 파일을 쓰고 그 파일만 커밋+푸시한다 */
async function publishViaGit(root, payload) {
    const filePath = path.join(root, ...REPO_REL_PATH.split('/'));
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, buildContent(payload), 'utf-8');
    const git = (args) => execFileAsync('git', args, { cwd: root });
    try {
        await git(['add', '--', REPO_REL_PATH]);
        try {
            // 경로를 명시해 커밋한다 — 작업 중인 다른 변경이 딸려 올라가지 않는다
            await git(['commit', '-m', buildMessage(payload), '--', REPO_REL_PATH]);
        }
        catch (commitError) {
            const out = `${commitError?.stdout || ''}${commitError?.stderr || ''}`;
            // 내용이 같아 커밋할 게 없는 경우 — 이미 올라가 있다는 뜻이라 실패가 아니다
            if (!/nothing to commit|no changes added/i.test(out))
                throw commitError;
            return { ok: true, method: 'git', detail: '변경 사항이 없어 이미 최신입니다.' };
        }
        const { stdout } = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
        const branch = String(stdout).trim() || REPO_BRANCH;
        await git(['push', 'origin', branch]);
        console.log(`[GOLDEN] git 배포 완료 (${branch}, ${payload.items.length}건)`);
        return { ok: true, method: 'git', detail: `${branch} 브랜치에 커밋하고 푸시했습니다.` };
    }
    catch (error) {
        const stderr = String(error?.stderr || '').trim();
        return {
            ok: false,
            method: 'git',
            error: `git 배포 실패: ${stderr || error?.message || String(error)}`,
        };
    }
}
/** 설치된 앱 — GitHub Contents API 로 직접 커밋한다 */
async function publishViaApi(payload, token) {
    const { owner, repo } = getRepoTarget();
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${REPO_REL_PATH}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'LEADERNAM-Orbit',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    try {
        // 덮어쓰려면 현재 파일의 sha 가 필요하다 (없으면 새로 만드는 것으로 처리)
        let sha;
        const current = await fetch(`${url}?ref=${REPO_BRANCH}`, { headers });
        if (current.ok) {
            sha = (await current.json())?.sha;
        }
        else if (current.status === 401 || current.status === 403) {
            return { ok: false, method: 'api', needsToken: true, error: '토큰이 거부되었습니다. 권한(Contents: write)과 만료를 확인해주세요.' };
        }
        else if (current.status !== 404) {
            return { ok: false, method: 'api', error: `현재 파일 조회 실패 (HTTP ${current.status})` };
        }
        const res = await fetch(url, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: buildMessage(payload),
                content: Buffer.from(buildContent(payload), 'utf-8').toString('base64'),
                branch: REPO_BRANCH,
                ...(sha ? { sha } : {}),
            }),
        });
        if (res.status === 401 || res.status === 403) {
            return { ok: false, method: 'api', needsToken: true, error: '토큰이 거부되었습니다. 권한(Contents: write)과 만료를 확인해주세요.' };
        }
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            return { ok: false, method: 'api', error: `GitHub 배포 실패 (HTTP ${res.status}) ${body.slice(0, 200)}` };
        }
        console.log(`[GOLDEN] GitHub API 배포 완료 (${payload.items.length}건)`);
        return { ok: true, method: 'api', detail: `GitHub(${owner}/${repo})에 직접 커밋했습니다.` };
    }
    catch (error) {
        return { ok: false, method: 'api', error: `GitHub 연결 실패: ${error instanceof Error ? error.message : String(error)}` };
    }
}
/** 환경을 보고 경로를 골라 배포한다 */
async function publishGoldenKeyword(payload) {
    if (!payload || !Array.isArray(payload.items)) {
        return { ok: false, error: '키워드 데이터 형식이 올바르지 않습니다.' };
    }
    // 빈 목록을 올리면 모든 사용자 화면이 통째로 비어버린다
    if (payload.items.length === 0) {
        return { ok: false, error: '키워드가 0건입니다. 빈 목록은 배포하지 않습니다.' };
    }
    const root = findRepoRoot();
    if (root)
        return publishViaGit(root, payload);
    const token = readGoldenToken();
    if (!token) {
        return {
            ok: false,
            needsToken: true,
            error: '이 PC 에는 레포가 없어 GitHub 토큰이 필요합니다.',
        };
    }
    return publishViaApi(payload, token);
}
