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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchNaverImages = searchNaverImages;
exports.searchNaverShopping = searchNaverShopping;
exports.crawlShoppingUrl = crawlShoppingUrl;
exports.matchImagesToSubtopics = matchImagesToSubtopics;
exports.collectImagesByTitle = collectImagesByTitle;
exports.collectImagesFromShoppingUrl = collectImagesFromShoppingUrl;
exports.getImageFolders = getImageFolders;
exports.getImagesFromFolder = getImagesFromFolder;
exports.deleteImageFolder = deleteImageFolder;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const electron_1 = require("electron");
function getImageStoragePath() {
    let basePath;
    try {
        basePath = electron_1.app.getPath('userData');
    }
    catch {
        basePath = process.env['APPDATA'] || process.env['HOME'] || '.';
        basePath = path.join(basePath, 'blogger-gpt-cli');
    }
    const imagePath = path.join(basePath, 'collected-images');
    if (!fs.existsSync(imagePath)) {
        fs.mkdirSync(imagePath, { recursive: true });
    }
    return imagePath;
}
function createKeywordFolder(keyword) {
    const basePath = getImageStoragePath();
    const sanitizedKeyword = keyword.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    const timestamp = new Date().toISOString().split('T')[0];
    const folderName = `${timestamp}_${sanitizedKeyword}`;
    const folderPath = path.join(basePath, folderName);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    return folderPath;
}
async function downloadImage(url, folderPath, filename) {
    try {
        const response = await axios_1.default.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://search.naver.com/'
            }
        });
        const contentType = response.headers['content-type'] || '';
        let ext = '.jpg';
        if (contentType.includes('png'))
            ext = '.png';
        else if (contentType.includes('gif'))
            ext = '.gif';
        else if (contentType.includes('webp'))
            ext = '.webp';
        const sanitizedFilename = filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
        const filePath = path.join(folderPath, `${sanitizedFilename}${ext}`);
        fs.writeFileSync(filePath, response.data);
        console.log(`[IMAGE-COLLECTOR] ✅ 저장: ${filePath}`);
        return filePath;
    }
    catch (error) {
        console.error(`[IMAGE-COLLECTOR] ❌ 다운로드 실패: ${url}`, error.message);
        return null;
    }
}
async function searchNaverImages(keyword, clientId, clientSecret, options = {}) {
    const { display = 20, filter = 'large', sort = 'sim' } = options;
    try {
        console.log(`[IMAGE-COLLECTOR] 🔍 네이버 이미지 검색: ${keyword}`);
        const response = await axios_1.default.get('https://openapi.naver.com/v1/search/image', {
            params: {
                query: keyword,
                display,
                filter,
                sort
            },
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            },
            timeout: 10000
        });
        const items = response.data.items || [];
        console.log(`[IMAGE-COLLECTOR] ✅ ${items.length}개 이미지 발견`);
        return items.map((item, index) => ({
            url: item.link,
            title: item.title?.replace(/<[^>]*>/g, '') || `이미지_${index + 1}`,
            source: 'naver-image',
            keyword,
            width: item.sizewidth ? parseInt(item.sizewidth) : undefined,
            height: item.sizeheight ? parseInt(item.sizeheight) : undefined
        }));
    }
    catch (error) {
        console.error(`[IMAGE-COLLECTOR] ❌ 네이버 이미지 검색 실패:`, error.message);
        return [];
    }
}
async function searchNaverShopping(keyword, clientId, clientSecret, options = {}) {
    const { display = 20, sort = 'sim' } = options;
    try {
        console.log(`[IMAGE-COLLECTOR] 🛒 네이버 쇼핑 검색: ${keyword}`);
        const response = await axios_1.default.get('https://openapi.naver.com/v1/search/shop', {
            params: {
                query: keyword,
                display,
                sort
            },
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            },
            timeout: 10000
        });
        const items = response.data.items || [];
        console.log(`[IMAGE-COLLECTOR] ✅ ${items.length}개 상품 발견`);
        return items.map((item, index) => ({
            url: item.image,
            title: item.title?.replace(/<[^>]*>/g, '') || `상품_${index + 1}`,
            source: 'naver-shopping',
            keyword,
            relevanceScore: 100 - index * 2
        }));
    }
    catch (error) {
        console.error(`[IMAGE-COLLECTOR] ❌ 네이버 쇼핑 검색 실패:`, error.message);
        return [];
    }
}
async function crawlShoppingUrl(url) {
    try {
        console.log(`[IMAGE-COLLECTOR] 🌐 쇼핑몰 크롤링: ${url}`);
        const response = await axios_1.default.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });
        const $ = cheerio.load(response.data);
        const images = [];
        const seenUrls = new Set();
        let source = 'shopping-crawl';
        if (url.includes('coupang.com'))
            source = 'coupang';
        else if (url.includes('gmarket.co.kr'))
            source = 'gmarket';
        else if (url.includes('11st.co.kr'))
            source = '11st';
        let productTitle = $('title').text().trim() || '상품';
        const parts1 = productTitle.split('-');
        const parts2 = (parts1[0] || productTitle).split('|');
        productTitle = (parts2[0] || productTitle).trim();
        const imageSelectors = [
            'img[src*="product"]',
            'img[src*="goods"]',
            'img[src*="item"]',
            '.product-image img',
            '.goods-image img',
            '.item-image img',
            '.thumbnail img',
            '.prod-image img',
            '.prod-image__item img',
            '[data-image-source]',
            '.box__item-img img',
            '.box__image img',
            '.c_product_img img',
            '.img_full img',
            '#productImage img',
            '.detail-image img',
            '.main-image img',
            '[class*="product"] img',
            '[class*="goods"] img'
        ];
        imageSelectors.forEach(selector => {
            $(selector).each((_, el) => {
                let imgUrl = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original');
                if (!imgUrl)
                    return;
                if (imgUrl.startsWith('//')) {
                    imgUrl = 'https:' + imgUrl;
                }
                else if (imgUrl.startsWith('/')) {
                    const urlObj = new URL(url);
                    imgUrl = urlObj.origin + imgUrl;
                }
                if (!imgUrl.match(/\.(jpg|jpeg|png|gif|webp)/i))
                    return;
                if (imgUrl.includes('icon') || imgUrl.includes('logo') || imgUrl.includes('banner'))
                    return;
                if (seenUrls.has(imgUrl))
                    return;
                const width = parseInt($(el).attr('width') || '0');
                const height = parseInt($(el).attr('height') || '0');
                if (width > 0 && width < 100)
                    return;
                if (height > 0 && height < 100)
                    return;
                seenUrls.add(imgUrl);
                const imgData = {
                    url: imgUrl,
                    title: $(el).attr('alt') || productTitle,
                    source,
                    keyword: productTitle
                };
                if (width > 0)
                    imgData.width = width;
                if (height > 0)
                    imgData.height = height;
                images.push(imgData);
            });
        });
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage && !seenUrls.has(ogImage)) {
            images.unshift({
                url: ogImage,
                title: productTitle + ' (대표)',
                source,
                keyword: productTitle,
                relevanceScore: 100
            });
        }
        console.log(`[IMAGE-COLLECTOR] ✅ ${images.length}개 이미지 추출`);
        return images;
    }
    catch (error) {
        console.error(`[IMAGE-COLLECTOR] ❌ 쇼핑몰 크롤링 실패:`, error.message);
        return [];
    }
}
function matchImagesToSubtopics(subtopics, images) {
    console.log(`[IMAGE-COLLECTOR] 🎯 ${subtopics.length}개 소제목에 이미지 매칭 중...`);
    return subtopics.map(subtopic => {
        const keywords = subtopic
            .replace(/[^가-힣a-zA-Z0-9\s]/g, '')
            .split(/\s+/)
            .filter(k => k.length >= 2);
        const scoredImages = images.map(img => {
            let score = img.relevanceScore || 50;
            keywords.forEach(keyword => {
                if (img.title.includes(keyword))
                    score += 20;
                if (img.keyword.includes(keyword))
                    score += 15;
            });
            if (img.width && img.width >= 800)
                score += 10;
            if (img.height && img.height >= 600)
                score += 10;
            if (img.source === 'naver-shopping')
                score += 5;
            if (img.source === 'coupang')
                score += 5;
            return { ...img, relevanceScore: score };
        });
        scoredImages.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        const top5 = scoredImages.slice(0, 5);
        const firstImage = scoredImages[0];
        const result = {
            subtopic,
            images: top5,
            selectedImage: firstImage
        };
        return result;
    });
}
async function collectImagesByTitle(title, subtopics, naverClientId, naverClientSecret, options = {}) {
    const { saveToFolder = true, maxImagesPerSubtopic = 3, includeShoppingImages = true } = options;
    console.log(`[IMAGE-COLLECTOR] 🚀 AI 이미지 자동 수집 시작: ${title}`);
    console.log(`[IMAGE-COLLECTOR] 📋 소제목 ${subtopics.length}개`);
    const allImages = [];
    const folderPath = saveToFolder ? createKeywordFolder(title) : '';
    try {
        const mainImages = await searchNaverImages(title, naverClientId, naverClientSecret, {
            display: 30,
            filter: 'large'
        });
        allImages.push(...mainImages);
        if (includeShoppingImages) {
            const shoppingImages = await searchNaverShopping(title, naverClientId, naverClientSecret, {
                display: 20
            });
            allImages.push(...shoppingImages);
        }
        for (const subtopic of subtopics.slice(0, 5)) {
            const cleanSubtopic = subtopic.replace(/^\d+\.\s*/, '').replace(/[?!]/g, '');
            const subtopicImages = await searchNaverImages(cleanSubtopic, naverClientId, naverClientSecret, {
                display: 10,
                filter: 'large'
            });
            subtopicImages.forEach(img => {
                img.keyword = cleanSubtopic;
            });
            allImages.push(...subtopicImages);
            await new Promise(r => setTimeout(r, 200));
        }
        const uniqueImages = allImages.filter((img, index, self) => index === self.findIndex(i => i.url === img.url));
        console.log(`[IMAGE-COLLECTOR] 📸 총 ${uniqueImages.length}개 고유 이미지 수집`);
        const matches = matchImagesToSubtopics(subtopics, uniqueImages);
        if (saveToFolder && folderPath) {
            console.log(`[IMAGE-COLLECTOR] 💾 이미지 저장 시작: ${folderPath}`);
            let downloadCount = 0;
            for (const match of matches) {
                const imagesToSave = match.images.slice(0, maxImagesPerSubtopic);
                for (let i = 0; i < imagesToSave.length; i++) {
                    const img = imagesToSave[i];
                    if (!img)
                        continue;
                    const filename = `${match.subtopic.substring(0, 30)}_${i + 1}`;
                    const localPath = await downloadImage(img.url, folderPath, filename);
                    if (localPath) {
                        img.localPath = localPath;
                        downloadCount++;
                    }
                }
            }
            console.log(`[IMAGE-COLLECTOR] ✅ ${downloadCount}개 이미지 저장 완료`);
        }
        const selectedImages = matches
            .filter((m) => m.selectedImage !== undefined)
            .map(m => m.selectedImage);
        return {
            ok: true,
            images: selectedImages,
            folderPath
        };
    }
    catch (error) {
        console.error(`[IMAGE-COLLECTOR] ❌ 수집 실패:`, error.message);
        return {
            ok: false,
            images: [],
            folderPath,
            error: error.message
        };
    }
}
async function collectImagesFromShoppingUrl(shoppingUrl, subtopics, options = {}) {
    const { saveToFolder = true, maxImages = 20 } = options;
    console.log(`[IMAGE-COLLECTOR] 🛍️ 쇼핑몰 URL 이미지 수집: ${shoppingUrl}`);
    try {
        const crawledImages = await crawlShoppingUrl(shoppingUrl);
        if (crawledImages.length === 0) {
            return {
                ok: false,
                images: [],
                folderPath: '',
                error: '이미지를 찾을 수 없습니다'
            };
        }
        const selectedImages = crawledImages.slice(0, maxImages);
        const matches = matchImagesToSubtopics(subtopics, selectedImages);
        let folderPath = '';
        if (saveToFolder) {
            const productName = selectedImages[0]?.title || '상품이미지';
            folderPath = createKeywordFolder(productName);
            console.log(`[IMAGE-COLLECTOR] 💾 이미지 저장: ${folderPath}`);
            for (let i = 0; i < selectedImages.length; i++) {
                const img = selectedImages[i];
                if (!img)
                    continue;
                const filename = `상품_${i + 1}_${img.title.substring(0, 20)}`;
                const localPath = await downloadImage(img.url, folderPath, filename);
                if (localPath) {
                    img.localPath = localPath;
                }
            }
        }
        const matchedImages = matches
            .filter((m) => m.selectedImage !== undefined)
            .map(m => m.selectedImage);
        return {
            ok: true,
            images: matchedImages.length > 0 ? matchedImages : selectedImages,
            folderPath
        };
    }
    catch (error) {
        console.error(`[IMAGE-COLLECTOR] ❌ 쇼핑몰 수집 실패:`, error.message);
        return {
            ok: false,
            images: [],
            folderPath: '',
            error: error.message
        };
    }
}
function getImageFolders() {
    const basePath = getImageStoragePath();
    try {
        const folders = fs.readdirSync(basePath)
            .filter(f => fs.statSync(path.join(basePath, f)).isDirectory())
            .map(f => {
            const folderPath = path.join(basePath, f);
            const images = fs.readdirSync(folderPath)
                .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i));
            return {
                name: f,
                path: folderPath,
                imageCount: images.length
            };
        })
            .sort((a, b) => b.name.localeCompare(a.name));
        return folders;
    }
    catch {
        return [];
    }
}
function getImagesFromFolder(folderPath) {
    try {
        const images = fs.readdirSync(folderPath)
            .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i))
            .map(file => ({
            path: path.join(folderPath, file),
            name: file
        }));
        return images;
    }
    catch {
        return [];
    }
}
function deleteImageFolder(folderPath) {
    try {
        if (fs.existsSync(folderPath)) {
            fs.rmSync(folderPath, { recursive: true });
            return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=image-collector.js.map