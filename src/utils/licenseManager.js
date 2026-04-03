"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceId = getDeviceId;
exports.loadLicense = loadLicense;
exports.saveLicense = saveLicense;
exports.clearLicense = clearLicense;
exports.getCachedLicense = getCachedLicense;
exports.validateLicenseFormat = validateLicenseFormat;
exports.isLicenseExpired = isLicenseExpired;
exports.verifyLicense = verifyLicense;
exports.revalidateLicense = revalidateLicense;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const LICENSE_FILE = 'license.json';

// Google Apps Script 서버 URL (admin-panel과 동일)
const DEFAULT_LICENSE_SERVER_URL = 'https://script.google.com/macros/s/AKfycbxBOGkjVj4p-6XZ4SEFYKhW3FBmo5gt7Fv6djWhB1TljnDDmx_qlfZ4YdlJNohzIZ8NJw/exec';

let licenseDir = null;
let licensePath = null;
let cachedLicense = null;

async function ensureLicenseDir() {
    if (licenseDir) {
        return licenseDir;
    }
    if (!electron_1.app.isReady()) {
        await electron_1.app.whenReady();
    }
    licenseDir = path_1.default.join(electron_1.app.getPath('userData'), 'license');
    await promises_1.default.mkdir(licenseDir, { recursive: true });
    licensePath = path_1.default.join(licenseDir, LICENSE_FILE);
    return licenseDir;
}

function generateDeviceId() {
    const platform = process.platform;
    const hostname = require('os').hostname();
    const userInfo = require('os').userInfo();
    const uniqueString = `${platform}-${hostname}-${userInfo.username}`;
    return crypto_1.default.createHash('sha256').update(uniqueString).digest('hex').substring(0, 32);
}

async function getDeviceId() {
    const dir = await ensureLicenseDir();
    const deviceIdPath = path_1.default.join(dir, 'device.id');
    try {
        const deviceId = await promises_1.default.readFile(deviceIdPath, 'utf-8');
        if (deviceId && deviceId.length >= 16) {
            return deviceId.trim();
        }
    }
    catch {
        // 파일이 없으면 새로 생성
    }
    const newDeviceId = generateDeviceId();
    await promises_1.default.writeFile(deviceIdPath, newDeviceId, 'utf-8');
    return newDeviceId;
}

async function loadLicense() {
    const filePath = await ensureLicenseDir();
    const licenseFile = path_1.default.join(filePath, LICENSE_FILE);
    try {
        const raw = await promises_1.default.readFile(licenseFile, 'utf-8');
        const license = JSON.parse(raw);
        cachedLicense = license;
        return license;
    }
    catch {
        cachedLicense = null;
        return null;
    }
}

async function saveLicense(license) {
    const filePath = await ensureLicenseDir();
    const licenseFile = path_1.default.join(filePath, LICENSE_FILE);
    cachedLicense = license;
    await promises_1.default.writeFile(licenseFile, JSON.stringify(license, null, 2), 'utf-8');
}

async function clearLicense() {
    const filePath = await ensureLicenseDir();
    const licenseFile = path_1.default.join(filePath, LICENSE_FILE);
    try {
        await promises_1.default.unlink(licenseFile);
    }
    catch {
        // 파일이 없어도 무시
    }
    cachedLicense = null;
}

function getCachedLicense() {
    return cachedLicense;
}

/**
 * 라이선스 코드 형식 검증 (예: XXXX-XXXX-XXXX-XXXX)
 */
function validateLicenseFormat(licenseCode) {
    const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(licenseCode);
}

/**
 * 라이선스 만료 여부 확인
 */
function isLicenseExpired(license) {
    if (!license.expiresAt) {
        return false; // 만료일이 없으면 영구 라이선스
    }
    const expiresAt = new Date(license.expiresAt);
    return new Date() > expiresAt;
}

/**
 * 앱 식별자 가져오기 (블로거 앱)
 */
function getAppId() {
    return process.env.APP_ID || 'com.ridernam.blogger.automation';
}

/**
 * 라이선스 검증 (Google Apps Script 서버 연동)
 */
async function verifyLicense(licenseCode, deviceId, serverUrl, userId, userPassword) {
    const appId = getAppId();
    const actualServerUrl = serverUrl || DEFAULT_LICENSE_SERVER_URL;
    
    // 서버 검증
    if (actualServerUrl) {
        try {
            // 1. 아이디/비밀번호만 있는 경우 (재로그인)
            if (userId && userPassword && !licenseCode) {
                console.log('[licenseManager] 아이디/비밀번호로 인증 시도:', { userId, appId });
                
                const response = await fetch(actualServerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'verify-credentials',
                        userId: userId,
                        userPassword: userPassword,
                        appId: appId,
                    }),
                });
                
                if (!response.ok) {
                    return {
                        valid: false,
                        message: `서버 검증 실패: ${response.status} ${response.statusText}`,
                    };
                }
                
                const result = await response.json();
                
                if (!result.ok || !result.valid) {
                    return {
                        valid: false,
                        message: result.error || result.message || '아이디 또는 비밀번호가 일치하지 않습니다.',
                    };
                }
                
                console.log('[licenseManager] ✅ verify-credentials 인증 성공!');
                
                const license = {
                    licenseCode: result.licenseCode,
                    deviceId,
                    verifiedAt: new Date().toISOString(),
                    expiresAt: result.expiresAt,
                    isValid: true,
                    licenseType: result.licenseType || 'standard',
                    userId: userId,
                    userPassword: userPassword,
                };
                await saveLicense(license);
                return { valid: true, license };
            }
            
            // 2. 라이선스 코드가 있는 경우 (초기 등록)
            if (licenseCode) {
                if (!validateLicenseFormat(licenseCode)) {
                    return {
                        valid: false,
                        message: '라이선스 코드 형식이 올바르지 않습니다. (예: XXXX-XXXX-XXXX-XXXX)',
                    };
                }
                
                if (!userId || !userPassword) {
                    return {
                        valid: false,
                        message: '아이디와 비밀번호를 입력해주세요.',
                    };
                }
                
                console.log('[licenseManager] 라이선스 등록 시작:', { licenseCode, userId, appId });
                
                // 429 에러 재시도 로직
                let retries = 3;
                for (let i = 0; i < retries; i++) {
                    try {
                        const response = await fetch(actualServerUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                action: 'register',
                                licenseCode: licenseCode,
                                userId: userId,
                                userPassword: userPassword,
                                appId: appId,
                            }),
                        });
                        
                        if (response.status === 429) {
                            console.warn(`[licenseManager] 429 에러 발생 (시도 ${i + 1}/${retries})`);
                            if (i < retries - 1) {
                                await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
                                continue;
                            }
                            return {
                                valid: false,
                                message: 'API 호출 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.',
                            };
                        }
                        
                        if (!response.ok) {
                            return {
                                valid: false,
                                message: `서버 검증 실패: ${response.status} ${response.statusText}`,
                            };
                        }
                        
                        const result = await response.json();
                        
                        if (!result.ok || !result.valid) {
                            return {
                                valid: false,
                                message: result.error || result.message || '라이선스 코드가 유효하지 않습니다.',
                            };
                        }
                        
                        console.log('[licenseManager] ✅ 라이선스 등록 성공!');
                        
                        const license = {
                            licenseCode,
                            deviceId,
                            verifiedAt: new Date().toISOString(),
                            expiresAt: result.expiresAt,
                            isValid: true,
                            licenseType: result.licenseType || 'standard',
                            userId: userId,
                            userPassword: userPassword,
                        };
                        await saveLicense(license);
                        return { valid: true, license };
                        
                    } catch (fetchError) {
                        if (i === retries - 1) {
                            return {
                                valid: false,
                                message: `서버 연결 실패: ${fetchError?.message || '알 수 없는 오류'}`,
                            };
                        }
                        await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
                    }
                }
            }
            
            return {
                valid: false,
                message: '라이선스 코드 또는 아이디/비밀번호를 입력해주세요.',
            };
        }
        catch (error) {
            return {
                valid: false,
                message: `서버 연결 실패: ${error.message}`,
            };
        }
    }
    
    // 오프라인 모드 - 저장된 라이선스 확인
    if (userId && userPassword && !licenseCode) {
        const savedLicense = await loadLicense();
        if (savedLicense && savedLicense.userId === userId && savedLicense.userPassword === userPassword) {
            if (isLicenseExpired(savedLicense)) {
                return {
                    valid: false,
                    message: '라이선스가 만료되었습니다. 새로운 코드를 등록해주세요.',
                };
            }
            return { valid: true, license: savedLicense };
        }
        return {
            valid: false,
            message: '아이디 또는 비밀번호가 일치하지 않습니다.',
        };
    }
    
    return {
        valid: false,
        message: '라이선스 코드, 또는 아이디/비밀번호를 입력해주세요.',
    };
}

/**
 * 저장된 라이선스 재검증
 */
async function revalidateLicense(serverUrl) {
    const license = await loadLicense();
    if (!license || !license.isValid) {
        return false;
    }
    
    if (isLicenseExpired(license)) {
        await clearLicense();
        return false;
    }
    
    // 아이디/비밀번호가 있으면 서버 재검증
    if (license.userId && license.userPassword) {
        const actualServerUrl = serverUrl || DEFAULT_LICENSE_SERVER_URL;
        
        try {
            const appId = getAppId();
            const response = await fetch(actualServerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'verify-credentials',
                    userId: license.userId,
                    userPassword: license.userPassword,
                    appId: appId,
                }),
            });
            
            if (!response.ok) {
                return false;
            }
            
            const result = await response.json();
            
            if (!result.ok || !result.valid) {
                await clearLicense();
                return false;
            }
            
            console.log('[licenseManager] ✅ 재검증 성공!');
            
            license.verifiedAt = new Date().toISOString();
            if (result.expiresAt) {
                license.expiresAt = result.expiresAt;
            }
            if (result.licenseCode) {
                license.licenseCode = result.licenseCode;
            }
            await saveLicense(license);
        }
        catch (error) {
            console.warn('[licenseManager] 서버 연결 실패 - 로컬 라이선스 유지');
        }
    }
    
    return true;
}
