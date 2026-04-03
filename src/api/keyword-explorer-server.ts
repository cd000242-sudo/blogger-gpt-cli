/**
 * 🔍 황금키워드 탐색기 — 로컬 웹서버
 * 
 * Express 기반 로컬 서버. Electron 메인 프로세스에서 시작되며,
 * 브라우저 탭에서 대시보드 UI를 제공한다.
 * 
 * 핵심:
 * - SSE (Server-Sent Events)로 실시간 스캔 진행률 스트리밍
 * - 단일 스캔 뮤텍스 (동시 실행 방지)
 * - localhost 전용 (인증 불필요)
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as path from 'path';
import * as http from 'http';
import {
    scanNicheKeywords,
    exportKeywordsToCSV,
    getCachedKeywordsByCategory,
    type ScanOptions,
    type ScanResult,
    type NicheKeyword,
} from '../utils/niche-keyword-engine';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ScanState {
    id: string;
    status: 'scanning' | 'complete' | 'error';
    startedAt: number;
    progress: number;
    message: string;
    result: ScanResult | null;
    error: string | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Server State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEFAULT_PORT = 3847;
let serverInstance: http.Server | null = null;
let currentScan: ScanState | null = null;
let lastResult: ScanResult | null = null;
const sseClients: Set<Response> = new Set();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Express App
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const app = express();
app.use(express.json());

// 레이트 리밋: 분당 30회
app.use(rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: '요청 한도 초과' } }));

// CORS — localhost 전용 (정확한 매칭)
const ALLOWED_ORIGINS = new Set<string>();
for (const host of ['localhost', '127.0.0.1']) {
    for (const port of ['', ':3000', ':3001', ':5173', ':8080']) {
        ALLOWED_ORIGINS.add(`http://${host}${port}`);
    }
}
app.use((_req, res, next) => {
    const origin = _req.headers.origin || '';
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
        res.header('Access-Control-Allow-Origin', origin || 'http://localhost');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

// ─────────────────────────────────────────────
// Dashboard HTML
// ─────────────────────────────────────────────

app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'keyword-explorer.html'));
});

// ─────────────────────────────────────────────
// SSE Helpers
// ─────────────────────────────────────────────

function broadcastSSE(event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch {
            sseClients.delete(client);
        }
    }
}

// ─────────────────────────────────────────────
// API: Health Check
// ─────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        success: true,
        status: 'healthy',
        scanning: currentScan?.status === 'scanning',
        timestamp: new Date().toISOString(),
    });
});

// ─────────────────────────────────────────────
// API: Start Scan
// ─────────────────────────────────────────────

app.post('/api/scan', async (req: Request, res: Response) => {
    // Mutex: 동시 스캔 방지
    if (currentScan?.status === 'scanning') {
        res.status(409).json({
            success: false,
            error: '이미 스캔이 진행 중입니다.',
            scanId: currentScan.id,
        });
        return;
    }

    const {
        platform = 'adpost',
        maxKeywords = 50,
        maxRecursionCalls = 80,
        maxRecursionDepth = 5,
        enableKinCrawling = true,
        categoryFilter = 'all',
    } = req.body || {};

    const scanId = `scan_${Date.now()}`;
    currentScan = {
        id: scanId,
        status: 'scanning',
        startedAt: Date.now(),
        progress: 0,
        message: '🚀 스캔 시작...',
        result: null,
        error: null,
    };

    // 즉시 응답 반환 (비동기 스캔)
    res.json({
        success: true,
        scanId,
        message: '스캔이 시작되었습니다. /api/scan/events로 진행률을 확인하세요.',
    });

    // 비동기 스캔 실행
    const options: ScanOptions = {
        platform,
        maxKeywords,
        maxRecursionCalls,
        maxRecursionDepth,
        enableKinCrawling,
        categoryFilter,
    };

    try {
        broadcastSSE('scan_start', { scanId, platform, startedAt: currentScan.startedAt });

        const result = await scanNicheKeywords(options, (msg: string, pct: number) => {
            if (currentScan) {
                currentScan.progress = pct;
                currentScan.message = msg;
            }
            broadcastSSE('progress', { message: msg, percent: pct });
        });

        currentScan.status = 'complete';
        currentScan.result = result;
        currentScan.progress = 100;
        currentScan.message = '✅ 스캔 완료!';
        lastResult = result;

        broadcastSSE('complete', {
            scanId,
            totalKeywords: result.keywords.length,
            totalScanned: result.totalScanned,
            topKeyword: result.keywords[0]?.keyword || '-',
            topGrade: result.keywords[0]?.goldenGrade || '-',
            duration: Date.now() - currentScan.startedAt,
        });

    } catch (error: any) {
        if (currentScan) {
            currentScan.status = 'error';
            currentScan.error = error.message || '스캔 실패';
            currentScan.message = `❌ ${error.message || '스캔 실패'}`;
        }
        broadcastSSE('error', { message: error.message || '스캔 실패' });
        console.error('[KeywordExplorer] 스캔 실패:', error);
    }
});

// ─────────────────────────────────────────────
// API: SSE Event Stream
// ─────────────────────────────────────────────

app.get('/api/scan/events', (req: Request, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    // 초기 연결 이벤트
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

    // 현재 스캔 상태가 있으면 전송
    if (currentScan) {
        res.write(`event: status\ndata: ${JSON.stringify({
            scanId: currentScan.id,
            status: currentScan.status,
            progress: currentScan.progress,
            message: currentScan.message,
        })}\n\n`);
    }

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

// ─────────────────────────────────────────────
// API: Scan Status
// ─────────────────────────────────────────────

app.get('/api/scan/status', (_req: Request, res: Response) => {
    if (!currentScan) {
        res.json({ success: true, status: 'idle', scanning: false });
        return;
    }

    res.json({
        success: true,
        scanId: currentScan.id,
        status: currentScan.status,
        scanning: currentScan.status === 'scanning',
        progress: currentScan.progress,
        message: currentScan.message,
        startedAt: currentScan.startedAt,
        duration: Date.now() - currentScan.startedAt,
        resultCount: currentScan.result?.keywords.length || 0,
    });
});

// ─────────────────────────────────────────────
// API: Get Keywords (cached or last scan)
// ─────────────────────────────────────────────

app.get('/api/keywords', (req: Request, res: Response) => {
    const grade = req.query['grade'] as string | undefined;
    const category = req.query['category'] as string | undefined;
    const sort = req.query['sort'] as string || 'goldenScore';
    const order = req.query['order'] as string || 'desc';

    let keywords: NicheKeyword[] = [];

    // 최근 스캔 결과 우선, 없으면 캐시
    if (lastResult) {
        keywords = [...lastResult.keywords];
    } else {
        const cached = getCachedKeywordsByCategory();
        keywords = Object.values(cached).flat();
    }

    // 필터
    if (grade) {
        keywords = keywords.filter(k => k.goldenGrade === grade.toUpperCase());
    }
    if (category && category !== 'all') {
        keywords = keywords.filter(k => k.category === category);
    }

    // 정렬
    keywords.sort((a, b) => {
        const aVal = (a as any)[sort] ?? 0;
        const bVal = (b as any)[sort] ?? 0;
        return order === 'asc' ? aVal - bVal : bVal - aVal;
    });

    res.json({
        success: true,
        data: keywords,
        meta: {
            total: keywords.length,
            scannedAt: lastResult?.scannedAt || null,
        },
    });
});

// ─────────────────────────────────────────────
// API: CSV Export
// ─────────────────────────────────────────────

app.get('/api/keywords/csv', (_req: Request, res: Response) => {
    let keywords: NicheKeyword[] = [];

    if (lastResult) {
        keywords = lastResult.keywords;
    } else {
        const cached = getCachedKeywordsByCategory();
        keywords = Object.values(cached).flat();
    }

    if (keywords.length === 0) {
        res.status(404).json({ success: false, error: '키워드 데이터가 없습니다.' });
        return;
    }

    const csv = exportKeywordsToCSV(keywords);
    const filename = `keywords_${new Date().toISOString().slice(0, 10)}.csv`;

    // BOM for Excel 한글 호환
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(bom + csv);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Server Lifecycle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function startKeywordExplorerServer(port?: number): Promise<number> {
    return new Promise((resolve, reject) => {
        const targetPort = port || DEFAULT_PORT;

        if (serverInstance) {
            console.log('[KeywordExplorer] ⚠️ 서버가 이미 실행 중');
            resolve(targetPort);
            return;
        }

        serverInstance = app.listen(targetPort, '127.0.0.1', () => {
            console.log(`[KeywordExplorer] 🚀 서버 시작: http://localhost:${targetPort}`);
            resolve(targetPort);
        });

        serverInstance.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`[KeywordExplorer] ⚠️ 포트 ${targetPort} 사용 중, ${targetPort + 1} 시도...`);
                serverInstance = null;
                startKeywordExplorerServer(targetPort + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
}

export function stopKeywordExplorerServer(): void {
    if (serverInstance) {
        // SSE 클라이언트 정리
        for (const client of sseClients) {
            try { client.end(); } catch { /* ignore */ }
        }
        sseClients.clear();

        serverInstance.close();
        serverInstance = null;
        console.log('[KeywordExplorer] 🛑 서버 종료');
    }
}

export function getKeywordExplorerPort(): number {
    return DEFAULT_PORT;
}
