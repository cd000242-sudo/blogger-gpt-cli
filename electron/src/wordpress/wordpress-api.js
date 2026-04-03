"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordPressAPI = void 0;
var WordPressAPI = /** @class */ (function () {
    function WordPressAPI(config) {
        this.config = __assign({ apiVersion: 'v2' }, config);
        // URL에 프로토콜이 없으면 https:// 추가
        var siteUrl = this.config.siteUrl.trim();
        if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
            siteUrl = "https://".concat(siteUrl);
        }
        this.baseUrl = "".concat(siteUrl.replace(/\/$/, ''), "/wp-json/wp/v2");
    }
    WordPressAPI.prototype.request = function (endpoint_1) {
        return __awaiter(this, arguments, void 0, function (endpoint, method, data) {
            var url, authHeader, auth, auth, options, headers, response, errorText, error_1;
            if (method === void 0) { method = 'GET'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.baseUrl).concat(endpoint);
                        authHeader = '';
                        if (this.config.jwtToken) {
                            authHeader = "Bearer ".concat(this.config.jwtToken);
                        }
                        else if (this.config.username && this.config.password) {
                            auth = btoa("".concat(this.config.username, ":").concat(this.config.password));
                            authHeader = "Basic ".concat(auth);
                        }
                        else if (this.config.clientId && this.config.clientSecret) {
                            auth = btoa("".concat(this.config.clientId, ":").concat(this.config.clientSecret));
                            authHeader = "Basic ".concat(auth);
                        }
                        options = {
                            method: method,
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'WordPress-Auto-Blogger/1.0'
                            }
                        };
                        if (authHeader) {
                            headers = options.headers;
                            headers['Authorization'] = authHeader;
                            options.headers = headers;
                        }
                        if (data && (method === 'POST' || method === 'PUT')) {
                            options.body = JSON.stringify(data);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, fetch(url, options)];
                    case 2:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.text()];
                    case 3:
                        errorText = _a.sent();
                        throw new Error("WordPress API Error: ".concat(response.status, " - ").concat(errorText));
                    case 4: return [4 /*yield*/, response.json()];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6:
                        error_1 = _a.sent();
                        console.error('WordPress API Request Error:', error_1);
                        throw error_1;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // 포스트 생성/수정
    WordPressAPI.prototype.createPost = function (post) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('/posts', 'POST', post)];
            });
        });
    };
    WordPressAPI.prototype.updatePost = function (id, post) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/posts/".concat(id), 'PUT', post)];
            });
        });
    };
    WordPressAPI.prototype.getPost = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/posts/".concat(id))];
            });
        });
    };
    WordPressAPI.prototype.deletePost = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/posts/".concat(id), 'DELETE')];
            });
        });
    };
    // SEO 메타 필드 업데이트 (Yoast SEO 연동)
    WordPressAPI.prototype.updateSeoMeta = function (postId, seoData) {
        return __awaiter(this, void 0, void 0, function () {
            var metaData, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        metaData = {
                            meta: {
                                // Yoast SEO 플러그인 메타 필드
                                '_yoast_wpseo_title': seoData.title || '',
                                '_yoast_wpseo_metadesc': seoData.description || '',
                                '_yoast_wpseo_focuskw': seoData.focusKeyword || '',
                                // 다른 SEO 플러그인 지원
                                '_rank_math_title': seoData.title || '',
                                '_rank_math_description': seoData.description || '',
                                '_rank_math_focus_keyword': seoData.focusKeyword || '',
                                // All in One SEO Pack
                                '_aioseop_title': seoData.title || '',
                                '_aioseop_description': seoData.description || '',
                                '_aioseop_keywords': seoData.focusKeyword || '',
                            }
                        };
                        return [4 /*yield*/, this.request("/posts/".concat(postId), 'PUT', metaData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, { success: true }];
                    case 2:
                        error_2 = _a.sent();
                        console.error('SEO 메타 업데이트 실패:', error_2);
                        return [2 /*return*/, { success: false }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // 미디어 업로드
    WordPressAPI.prototype.uploadMedia = function (file, filename, altText) {
        return __awaiter(this, void 0, void 0, function () {
            var formData, blob, url, auth, response, errorText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        formData = new FormData();
                        blob = new Blob([file], { type: 'image/jpeg' });
                        formData.append('file', blob, filename);
                        formData.append('alt_text', altText || '');
                        url = "".concat(this.baseUrl, "/media");
                        auth = btoa("".concat(this.config.username, ":").concat(this.config.password));
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': "Basic ".concat(auth),
                                    'User-Agent': 'WordPress-Auto-Blogger/1.0'
                                },
                                body: formData
                            })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        errorText = _a.sent();
                        throw new Error("Media Upload Error: ".concat(response.status, " - ").concat(errorText));
                    case 3: return [4 /*yield*/, response.json()];
                    case 4: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // 카테고리 관리
    WordPressAPI.prototype.getCategories = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('/categories?per_page=100')];
            });
        });
    };
    WordPressAPI.prototype.getCategory = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/categories/".concat(id))];
            });
        });
    };
    WordPressAPI.prototype.createCategory = function (name, description) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('/categories', 'POST', {
                        name: name,
                        description: description || ''
                    })];
            });
        });
    };
    WordPressAPI.prototype.updateCategory = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/categories/".concat(id), 'PUT', data)];
            });
        });
    };
    WordPressAPI.prototype.deleteCategory = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/categories/".concat(id), 'DELETE')];
            });
        });
    };
    // 태그 관리
    WordPressAPI.prototype.getTags = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('/tags?per_page=100')];
            });
        });
    };
    WordPressAPI.prototype.createTag = function (name, description) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('/tags', 'POST', {
                        name: name,
                        description: description || ''
                    })];
            });
        });
    };
    // 사이트 정보 확인
    WordPressAPI.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.request('/posts?per_page=1')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_3 = _a.sent();
                        console.error('WordPress connection test failed:', error_3);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // 포스트 검색
    WordPressAPI.prototype.searchPosts = function (search_1) {
        return __awaiter(this, arguments, void 0, function (search, perPage) {
            if (perPage === void 0) { perPage = 10; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/posts?search=".concat(encodeURIComponent(search), "&per_page=").concat(perPage))];
            });
        });
    };
    // 최근 포스트 조회
    WordPressAPI.prototype.getRecentPosts = function () {
        return __awaiter(this, arguments, void 0, function (perPage) {
            if (perPage === void 0) { perPage = 10; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/posts?per_page=".concat(perPage, "&orderby=date&order=desc"))];
            });
        });
    };
    return WordPressAPI;
}());
exports.WordPressAPI = WordPressAPI;
