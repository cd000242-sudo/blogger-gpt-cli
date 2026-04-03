/**
 * 🚀 블로그 지수 API 서버
 * 네이버 블로그 지수를 API로 제공하는 서비스
 */

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AdvancedBlogIndexExtractor } from '../utils/blog-index-extractor-advanced';
import { BlogAnalyzer } from '../utils/naver-blog-analyzer';
import { EnvironmentManager } from '../utils/environment-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const app = express();
app.use(helmet());
app.use(express.json());

// 레이트 리밋: 일반 API 분당 60회, 관리자 분당 10회
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { success: false, error: '요청 한도 초과. 1분 후 다시 시도하세요.' } });
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { success: false, error: '관리자 요청 한도 초과.' } });
app.use('/api/blog', apiLimiter);
app.use('/api/admin', adminLimiter);

// 타입 정의
interface ApiKey {
  key: string;
  name: string;
  createdAt: Date;
  lastUsed?: Date;
  requestCount: number;
  dailyLimit: number;
  enabled: boolean;
}

interface BlogIndexCache {
  blogId: string;
  blogIndex?: number;
  estimatedIndex?: number;
  confidence: number;
  source: 'puppeteer' | 'rss' | 'fusion' | 'estimated';
  timestamp: Date;
  expiresAt: Date;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    cached?: boolean;
    source?: string;
    confidence?: number;
  };
}

// 설정
const CONFIG = {
  port: process.env['API_PORT'] ? parseInt(process.env['API_PORT']) : 3000,
  cacheDir: path.join(process.cwd(), 'data', 'blog-index-cache'),
  apiKeysFile: path.join(process.cwd(), 'data', 'api-keys.json'),
  cacheExpireHours: 24, // 캐시 만료 시간 (시간)
  rateLimit: {
    perMinute: 60,
    perDay: 1000
  }
};

// 디렉토리 생성
if (!fs.existsSync(CONFIG.cacheDir)) {
  fs.mkdirSync(CONFIG.cacheDir, { recursive: true });
}

// API 키 관리
function loadApiKeys(): Map<string, ApiKey> {
  const keys = new Map<string, ApiKey>();
  
  if (fs.existsSync(CONFIG.apiKeysFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG.apiKeysFile, 'utf-8'));
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        keys.set(key, {
          ...value,
          createdAt: new Date(value.createdAt),
          lastUsed: value.lastUsed ? new Date(value.lastUsed) : undefined
        });
      });
    } catch (error) {
      console.error('[API] API 키 로드 실패:', error);
    }
  }
  
  return keys;
}

function saveApiKeys(keys: Map<string, ApiKey>): void {
  const data: Record<string, any> = {};
  keys.forEach((value, key) => {
    data[key] = value;
  });
  fs.writeFileSync(CONFIG.apiKeysFile, JSON.stringify(data, null, 2), 'utf-8');
}

const apiKeys = loadApiKeys();

// API 키 인증 미들웨어
function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({
      success: false,
      error: 'API 키가 필요합니다. X-API-Key 헤더나 apiKey 쿼리 파라미터를 제공하세요.'
    });
    return;
  }
  
  const keyData = apiKeys.get(apiKey);
  
  if (!keyData || !keyData.enabled) {
    res.status(401).json({
      success: false,
      error: '유효하지 않거나 비활성화된 API 키입니다.'
    });
    return;
  }
  
  // 일일 사용량 체크
  if (keyData.requestCount >= keyData.dailyLimit) {
    res.status(429).json({
      success: false,
      error: '일일 사용량 한도를 초과했습니다.'
    });
    return;
  }
  
  // 사용량 업데이트
  keyData.requestCount++;
  keyData.lastUsed = new Date();
  saveApiKeys(apiKeys);
  
  // 요청에 API 키 정보 추가
  (req as any).apiKeyData = keyData;
  next();
}

// 캐시 관리
function getCacheFilePath(blogId: string): string {
  const hash = crypto.createHash('sha256').update(blogId).digest('hex').slice(0, 32);
  return path.join(CONFIG.cacheDir, `${hash}.json`);
}

function loadCache(blogId: string): BlogIndexCache | null {
  const filePath = getCacheFilePath(blogId);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const cache: BlogIndexCache = {
      ...data,
      timestamp: new Date(data.timestamp),
      expiresAt: new Date(data.expiresAt)
    };
    
    // 만료 체크
    if (cache.expiresAt < new Date()) {
      fs.unlinkSync(filePath);
      return null;
    }
    
    return cache;
  } catch (error) {
    return null;
  }
}

function saveCache(blogId: string, cache: BlogIndexCache): void {
  const filePath = getCacheFilePath(blogId);
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8');
}

// 블로그 지수 추출기 초기화
let extractor: AdvancedBlogIndexExtractor | null = null;
let analyzer: BlogAnalyzer | null = null;

async function initExtractors(): Promise<void> {
  if (!extractor) {
    const envManager = EnvironmentManager.getInstance();
    const config = envManager.getConfig();
    
    const naverClientId = config.naverClientId || process.env['NAVER_CLIENT_ID'];
    const naverClientSecret = config.naverClientSecret || process.env['NAVER_CLIENT_SECRET'];
    
    if (!naverClientId || !naverClientSecret) {
      throw new Error('네이버 API 키가 설정되지 않았습니다.');
    }
    
    extractor = new AdvancedBlogIndexExtractor();
    analyzer = new BlogAnalyzer({
      clientId: naverClientId,
      clientSecret: naverClientSecret
    });
  }
}

// API 엔드포인트

/**
 * GET /api/blog-index/:blogId
 * 특정 블로그의 지수 조회
 */
app.get('/api/blog-index/:blogId', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    await initExtractors();
    
    const { blogId } = req.params;
    
    if (!blogId || blogId.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: '블로그 ID가 필요합니다.'
      });
      return;
    }
    
    // 캐시 확인
    const cached = loadCache(blogId);
    if (cached) {
      res.json({
        success: true,
        data: {
          blogId,
          blogIndex: cached.blogIndex,
          estimatedIndex: cached.estimatedIndex,
          confidence: cached.confidence,
          source: cached.source
        },
        meta: {
          cached: true,
          source: cached.source,
          confidence: cached.confidence
        }
      });
      return;
    }
    
    // 실제 추출 (검색 순위는 999로 설정 - 알 수 없는 경우)
    const result = await extractor!.extractBlogIndex(blogId, 999);
    
    // 캐시 저장
    const cache: BlogIndexCache = {
      blogId,
      ...(result.blogIndex !== undefined && { blogIndex: result.blogIndex }),
      ...(result.estimatedIndex !== undefined && { estimatedIndex: result.estimatedIndex }),
      confidence: result.confidence,
      source: result.source,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + CONFIG.cacheExpireHours * 60 * 60 * 1000)
    };
    saveCache(blogId, cache);
    
    res.json({
      success: true,
      data: {
        blogId,
        blogIndex: result.blogIndex,
        estimatedIndex: result.estimatedIndex,
        confidence: result.confidence,
        source: result.source
      },
      meta: {
        cached: false,
        source: result.source,
        confidence: result.confidence
      }
    });
    
  } catch (error: any) {
    console.error('[API] 블로그 지수 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message || '블로그 지수 조회 실패'
    });
  }
});

/**
 * POST /api/blog-index/batch
 * 여러 블로그 지수 일괄 조회
 */
app.post('/api/blog-index/batch', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    await initExtractors();
    
    const { blogIds } = req.body;
    
    if (!Array.isArray(blogIds) || blogIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'blogIds 배열이 필요합니다.'
      });
      return;
    }
    
    if (blogIds.length > 100) {
      res.status(400).json({
        success: false,
        error: '한 번에 최대 100개까지만 조회 가능합니다.'
      });
      return;
    }
    
    const results: any[] = [];
    
    for (const blogId of blogIds) {
      try {
        // 캐시 확인
        const cached = loadCache(blogId);
        if (cached) {
          results.push({
            blogId,
            blogIndex: cached.blogIndex,
            estimatedIndex: cached.estimatedIndex,
            confidence: cached.confidence,
            source: cached.source,
            cached: true
          });
          continue;
        }
        
        // 실제 추출
        const result = await extractor!.extractBlogIndex(blogId, 999);
        
        // 캐시 저장
        const cache: BlogIndexCache = {
          blogId,
          ...(result.blogIndex !== undefined && { blogIndex: result.blogIndex }),
          ...(result.estimatedIndex !== undefined && { estimatedIndex: result.estimatedIndex }),
          confidence: result.confidence,
          source: result.source,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + CONFIG.cacheExpireHours * 60 * 60 * 1000)
        };
        saveCache(blogId, cache);
        
        results.push({
          blogId,
          blogIndex: result.blogIndex,
          estimatedIndex: result.estimatedIndex,
          confidence: result.confidence,
          source: result.source,
          cached: false
        });
        
        // API 호출 간격 조절
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        results.push({
          blogId,
          error: error.message || '조회 실패'
        });
      }
    }
    
    res.json({
      success: true,
      data: results,
      meta: {
        total: results.length,
        cached: results.filter(r => r.cached).length,
        new: results.filter(r => !r.cached).length
      }
    });
    
  } catch (error: any) {
    console.error('[API] 일괄 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message || '일괄 조회 실패'
    });
  }
});

/**
 * GET /api/stats
 * API 사용 통계 조회
 */
app.get('/api/stats', authenticateApiKey, (req: Request, res: Response) => {
  const keyData = (req as any).apiKeyData;
  
  res.json({
    success: true,
    data: {
      apiKey: keyData.key.substring(0, 8) + '...',
      name: keyData.name,
      requestCount: keyData.requestCount,
      dailyLimit: keyData.dailyLimit,
      remaining: keyData.dailyLimit - keyData.requestCount,
      lastUsed: keyData.lastUsed
    }
  });
});

/**
 * GET /api/health
 * 헬스 체크
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/admin/create-key
 * API 키 생성 (관리자용)
 */
app.post('/api/admin/create-key', (req: Request, res: Response) => {
  // 관리자 인증은 환경 변수로 확인 (실제 운영 시 더 강력한 인증 필요)
  const adminKey = req.headers['x-admin-key'] as string | undefined;
  const expectedAdminKey = process.env['ADMIN_KEY'];
  if (!expectedAdminKey) {
    res.status(500).json({ success: false, error: 'ADMIN_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }
  
  if (adminKey !== expectedAdminKey) {
    res.status(401).json({
      success: false,
      error: '관리자 권한이 필요합니다.'
    });
    return;
  }
  
  const { name, dailyLimit = 1000 } = req.body;
  
  if (!name) {
    res.status(400).json({
      success: false,
      error: '키 이름이 필요합니다.'
    });
    return;
  }
  
  // API 키 생성
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const keyData: ApiKey = {
    key: apiKey,
    name,
    createdAt: new Date(),
    requestCount: 0,
    dailyLimit,
    enabled: true
  };
  
  apiKeys.set(apiKey, keyData);
  saveApiKeys(apiKeys);
  
  res.json({
    success: true,
    data: {
      apiKey,
      name,
      dailyLimit,
      createdAt: keyData.createdAt
    }
  });
});

/**
 * GET /api/admin/keys
 * API 키 목록 조회 (관리자용)
 */
app.get('/api/admin/keys', (req: Request, res: Response) => {
  const adminKey = req.headers['x-admin-key'] as string | undefined;
  const expectedAdminKey = process.env['ADMIN_KEY'];
  if (!expectedAdminKey) {
    res.status(500).json({ success: false, error: 'ADMIN_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }
  
  if (adminKey !== expectedAdminKey) {
    res.status(401).json({
      success: false,
      error: '관리자 권한이 필요합니다.'
    });
    return;
  }
  
  const keys = Array.from(apiKeys.values()).map(k => ({
    key: k.key.substring(0, 8) + '...',
    name: k.name,
    requestCount: k.requestCount,
    dailyLimit: k.dailyLimit,
    enabled: k.enabled,
    createdAt: k.createdAt,
    lastUsed: k.lastUsed
  }));
  
  res.json({
    success: true,
    data: keys
  });
});

// 서버 시작
export function startApiServer(port?: number): void {
  const serverPort = port || CONFIG.port;
  
  app.listen(serverPort, () => {
    console.log(`🚀 블로그 지수 API 서버 시작: http://localhost:${serverPort}`);
    console.log(`📚 API 문서:`);
    console.log(`   GET  /api/blog-index/:blogId - 블로그 지수 조회`);
    console.log(`   POST /api/blog-index/batch   - 일괄 조회`);
    console.log(`   GET  /api/stats              - 사용 통계`);
    console.log(`   GET  /api/health             - 헬스 체크`);
    console.log(`   POST /api/admin/create-key   - API 키 생성 (관리자)`);
    console.log(`   GET  /api/admin/keys         - API 키 목록 (관리자)`);
  });
}

// 직접 실행 시
if (require.main === module) {
  startApiServer();
}


