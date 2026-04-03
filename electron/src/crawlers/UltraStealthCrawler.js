"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/crawlers/UltraStealthCrawler.ts
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const puppeteer_extra_plugin_adblocker_1 = __importDefault(require("puppeteer-extra-plugin-adblocker"));
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_adblocker_1.default)({ blockTrackers: true }));
class UltraStealthCrawler {
    constructor() {
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
        ];
    }
    async initBrowser() {
        const browser = await puppeteer_extra_1.default.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-infobars',
                '--window-size=1920,1080',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            ignoreHTTPSErrors: true
        });
        const page = await browser.newPage();
        // User-Agent 랜덤화
        await page.setUserAgent(this.getRandomUserAgent());
        // 헤더 설정
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        });
        // Timezone (한국)
        await page.emulateTimezone('Asia/Seoul');
        // Geolocation (서울)
        await page.setGeolocation({
            latitude: 37.5665,
            longitude: 126.9780,
            accuracy: 100
        });
        // JavaScript 레벨 우회 (15가지)
        await page.evaluateOnNewDocument(() => {
            // WebDriver 제거
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // Chrome 객체
            window.chrome = {
                runtime: {},
                loadTimes: function () { },
                csi: function () { },
                app: {}
            };
            // Plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', length: 1 },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', length: 1 }
                ]
            });
            // Languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['ko-KR', 'ko', 'en-US', 'en']
            });
            // Platform
            Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
            // HardwareConcurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            // DeviceMemory
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            // Permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters));
            // Canvas Fingerprinting 방지
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (type) {
                if (type === 'image/png' && this.width === 280 && this.height === 60) {
                    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
                }
                return originalToDataURL.apply(this, arguments);
            };
        });
        return { browser, page };
    }
    // 실제 사용자 행동 시뮬레이션
    async simulateHuman(page) {
        await this.moveMouseNaturally(page, Math.random() * 1920, Math.random() * 1080);
        await this.smoothScroll(page, Math.random() * 500);
        await this.randomDelay(2000, 5000);
        if (Math.random() < 0.1) {
            await page.mouse.click(Math.random() * 1920, Math.random() * 1080);
        }
    }
    async moveMouseNaturally(page, targetX, targetY) {
        const steps = 20 + Math.floor(Math.random() * 10);
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const easeProgress = this.easeInOutCubic(progress);
            const x = targetX * easeProgress;
            const y = targetY * easeProgress;
            await page.mouse.move(x, y);
            await this.randomDelay(10, 30);
        }
    }
    async smoothScroll(page, distance) {
        await page.evaluate((distance) => {
            const start = window.scrollY;
            const startTime = Date.now();
            const duration = 1000 + Math.random() * 1000;
            function easeInOutCubic(t) {
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }
            function scroll() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = easeInOutCubic(progress);
                window.scrollTo(0, start + distance * easeProgress);
                if (progress < 1)
                    requestAnimationFrame(scroll);
            }
            scroll();
        }, distance);
        await this.randomDelay(1000, 2000);
    }
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    randomDelay(min, max) {
        const delay = min + Math.random() * (max - min);
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }
}
exports.default = UltraStealthCrawler;
