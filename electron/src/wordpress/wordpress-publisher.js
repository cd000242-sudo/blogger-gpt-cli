"use strict";
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
exports.WordPressPublisher = void 0;
exports.publishToWordPress = publishToWordPress;
var wordpress_api_1 = require("./wordpress-api");
var WordPressPublisher = /** @class */ (function () {
    function WordPressPublisher(config) {
        this.wpApi = new wordpress_api_1.WordPressAPI(config);
    }
    // 새로운 간소화된 publish 메서드
    WordPressPublisher.prototype.publish = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var isConnected, postData, createdPost, seoResult, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, this.wpApi.testConnection()];
                    case 1:
                        isConnected = _a.sent();
                        if (!isConnected) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: '워드프레스 사이트에 연결할 수 없습니다.'
                                }];
                        }
                        postData = {
                            title: options.title,
                            content: options.content,
                            excerpt: options.excerpt || this.extractExcerpt(options.content),
                            status: 'draft'
                        };
                        return [4 /*yield*/, this.wpApi.createPost(postData)];
                    case 2:
                        createdPost = _a.sent();
                        if (!createdPost.id) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.wpApi.updateSeoMeta(createdPost.id, {
                                title: options.title,
                                description: options.metaDescription || this.generateMetaDescription(options.content),
                                focusKeyword: this.extractFocusKeyword(options.title, options.content)
                            })];
                    case 3:
                        seoResult = _a.sent();
                        if (seoResult.success) {
                            console.log("[SEO] \uD3EC\uC2A4\uD2B8 ".concat(createdPost.id, " SEO \uBA54\uD0C0 \uD544\uB4DC \uC5C5\uB370\uC774\uD2B8 \uC644\uB8CC"));
                        }
                        _a.label = 4;
                    case 4: return [2 /*return*/, {
                            success: true,
                            url: "".concat(this.wpApi['config'].siteUrl, "/wp-admin/post.php?post=").concat(createdPost.id, "&action=edit")
                        }];
                    case 5:
                        error_1 = _a.sent();
                        console.error('워드프레스 포스트 발행 실패:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                error: error_1 instanceof Error ? error_1.message : '알 수 없는 오류가 발생했습니다.'
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    WordPressPublisher.prototype.publishPost = function (_options) {
        return __awaiter(this, void 0, void 0, function () {
            var isConnected, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.wpApi.testConnection()];
                    case 1:
                        isConnected = _a.sent();
                        if (!isConnected) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: '워드프레스 사이트에 연결할 수 없습니다. URL과 인증 정보를 확인해주세요.'
                                }];
                        }
                        // 2. AI로 콘텐츠 생성
                        // 이 함수는 더 이상 사용되지 않습니다.
                        // runPost를 통해 콘텐츠를 생성하세요.
                        return [2 /*return*/, {
                                success: false,
                                error: '이 함수는 더 이상 사용되지 않습니다. runPost를 사용하세요.'
                            }];
                    case 2:
                        error_2 = _a.sent();
                        console.error('워드프레스 포스트 발행 실패:', error_2);
                        return [2 /*return*/, {
                                success: false,
                                error: error_2 instanceof Error ? error_2.message : '알 수 없는 오류가 발생했습니다.'
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    WordPressPublisher.prototype.resolveCategories = function (categoryNames) {
        return __awaiter(this, void 0, void 0, function () {
            var existingCategories, categoryIds, _loop_1, this_1, _i, categoryNames_1, categoryName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (categoryNames.length === 0)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, this.wpApi.getCategories()];
                    case 1:
                        existingCategories = _a.sent();
                        categoryIds = [];
                        _loop_1 = function (categoryName) {
                            var category, error_3;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        category = existingCategories.find(function (cat) {
                                            return cat.name.toLowerCase() === categoryName.toLowerCase();
                                        });
                                        if (!!category) return [3 /*break*/, 4];
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, this_1.wpApi.createCategory(categoryName)];
                                    case 2:
                                        category = _b.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_3 = _b.sent();
                                        console.warn("\uCE74\uD14C\uACE0\uB9AC \"".concat(categoryName, "\" \uC0DD\uC131 \uC2E4\uD328:"), error_3);
                                        return [2 /*return*/, "continue"];
                                    case 4:
                                        if (category) {
                                            categoryIds.push(category.id);
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, categoryNames_1 = categoryNames;
                        _a.label = 2;
                    case 2:
                        if (!(_i < categoryNames_1.length)) return [3 /*break*/, 5];
                        categoryName = categoryNames_1[_i];
                        return [5 /*yield**/, _loop_1(categoryName)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, categoryIds];
                }
            });
        });
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    WordPressPublisher.prototype.resolveTags = function (tagNames) {
        return __awaiter(this, void 0, void 0, function () {
            var existingTags, tagIds, _loop_2, this_2, _i, tagNames_1, tagName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (tagNames.length === 0)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, this.wpApi.getTags()];
                    case 1:
                        existingTags = _a.sent();
                        tagIds = [];
                        _loop_2 = function (tagName) {
                            var tag, error_4;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        tag = existingTags.find(function (t) {
                                            return t.name.toLowerCase() === tagName.toLowerCase();
                                        });
                                        if (!!tag) return [3 /*break*/, 4];
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, this_2.wpApi.createTag(tagName)];
                                    case 2:
                                        tag = _b.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_4 = _b.sent();
                                        console.warn("\uD0DC\uADF8 \"".concat(tagName, "\" \uC0DD\uC131 \uC2E4\uD328:"), error_4);
                                        return [2 /*return*/, "continue"];
                                    case 4:
                                        if (tag) {
                                            tagIds.push(tag.id);
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        _i = 0, tagNames_1 = tagNames;
                        _a.label = 2;
                    case 2:
                        if (!(_i < tagNames_1.length)) return [3 /*break*/, 5];
                        tagName = tagNames_1[_i];
                        return [5 /*yield**/, _loop_2(tagName)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, tagIds];
                }
            });
        });
    };
    WordPressPublisher.prototype.extractExcerpt = function (content, maxLength) {
        if (maxLength === void 0) { maxLength = 160; }
        // HTML 태그 제거
        var textContent = content.replace(/<[^>]*>/g, '');
        // 공백 정리
        var cleanText = textContent.replace(/\s+/g, ' ').trim();
        if (cleanText.length <= maxLength) {
            return cleanText;
        }
        return cleanText.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    WordPressPublisher.prototype.downloadImage = function (imageUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var response, arrayBuffer, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch(imageUrl)];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("\uC774\uBBF8\uC9C0 \uB2E4\uC6B4\uB85C\uB4DC \uC2E4\uD328: ".concat(response.status));
                        }
                        return [4 /*yield*/, response.arrayBuffer()];
                    case 2:
                        arrayBuffer = _a.sent();
                        return [2 /*return*/, arrayBuffer];
                    case 3:
                        error_5 = _a.sent();
                        throw new Error("\uC774\uBBF8\uC9C0 \uB2E4\uC6B4\uB85C\uB4DC \uC911 \uC624\uB958: ".concat(error_5 instanceof Error ? error_5.message : '알 수 없는 오류'));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // 배치 발행 (엑셀 파일에서 여러 포스트 발행)
    WordPressPublisher.prototype.publishBatch = function (posts) {
        return __awaiter(this, void 0, void 0, function () {
            var results, i, post, result, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < posts.length)) return [3 /*break*/, 8];
                        console.log("\uD3EC\uC2A4\uD2B8 ".concat(i + 1, "/").concat(posts.length, " \uBC1C\uD589 \uC911..."));
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 6, , 7]);
                        post = posts[i];
                        if (!post) {
                            results.push({
                                success: false,
                                error: "\uD3EC\uC2A4\uD2B8 ".concat(i + 1, " \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")
                            });
                            return [3 /*break*/, 7];
                        }
                        return [4 /*yield*/, this.publishPost(post)];
                    case 3:
                        result = _a.sent();
                        results.push(result);
                        if (!(i < posts.length - 1)) return [3 /*break*/, 5];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_6 = _a.sent();
                        results.push({
                            success: false,
                            error: "\uD3EC\uC2A4\uD2B8 ".concat(i + 1, " \uBC1C\uD589 \uC2E4\uD328: ").concat(error_6 instanceof Error ? error_6.message : '알 수 없는 오류')
                        });
                        return [3 /*break*/, 7];
                    case 7:
                        i++;
                        return [3 /*break*/, 1];
                    case 8: return [2 /*return*/, results];
                }
            });
        });
    };
    // 초점 키프레이즈 추출 함수 (제목에서 핵심 키워드 추출)
    WordPressPublisher.prototype.extractFocusKeyword = function (title, _content) {
        try {
            // 제목 정리 (특수문자 제거)
            var cleanTitle = title
                .replace(/[`~!@#$%^&*()_|+\-=?;:'"<>.,{[}\\]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            // 제목에서 핵심 키워드 추출 (2-4단어 조합)
            var words = cleanTitle.split(' ')
                .filter(function (word) {
                return word.length > 1 &&
                    !isNaN(Number(word)) === false && // 숫자가 아닌 단어
                    !['년', '월', '일', '시', '분', '초'].includes(word);
            } // 시간 관련 중복 제거
            );
            // 가장 핵심적인 키워드 조합 선택 (우선순위 기반)
            if (words.length >= 4) {
                // 앞의 3-4개 단어가 핵심일 가능성이 높음
                return words.slice(0, 3).join(' ');
            }
            else if (words.length >= 2) {
                // 모두 포함하지만 너무 길지 않게
                return words.slice(0, Math.min(words.length, 4)).join(' ');
            }
            else if (words.length === 1) {
                // 단일 키워드 그대로 반환
                return words[0] || '';
            }
            // 폴백: 제목의 처음 15자
            return cleanTitle.substring(0, 15).trim();
        }
        catch (error) {
            console.error('초점 키프레이즈 추출 실패:', error);
            return title.substring(0, 10); // 기본값
        }
    };
    // 메타 설명 생성 함수 (콘텐츠 기반 자동 생성)
    WordPressPublisher.prototype.generateMetaDescription = function (content, limit) {
        if (limit === void 0) { limit = 155; }
        try {
            // HTML 태그 제거
            var cleanContent = content
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            // 첫 번째 문단이나 문장 추출 (150자 이내)
            var combinedSentence = cleanContent.replace(/。/g, '.').replace(/！/g, '!').replace(/？/g, '?');
            var sentences = combinedSentence.split(/[.!?]/);
            for (var _i = 0, sentences_1 = sentences; _i < sentences_1.length; _i++) {
                var sentence = sentences_1[_i];
                if (sentence.trim().length >= 20 && sentence.trim().length <= limit) {
                    return sentence.trim();
                }
            }
            // 적절한 길이의 문장이 없으면 컨텐츠 앞부분을 자름
            var description = cleanContent.substring(0, limit).trim();
            // 단어 중간에서 자르지 않도록 마지막 공백에서 자름
            var lastSpaceIndex = description.lastIndexOf(' ');
            if (lastSpaceIndex > limit * 0.8) { // 80% 이상 지점에서 공백이 있으면
                description = description.substring(0, lastSpaceIndex);
            }
            return description + '...';
        }
        catch (error) {
            console.error('메타 설명 생성 실패:', error);
            return content.substring(0, 100);
        }
    };
    return WordPressPublisher;
}());
exports.WordPressPublisher = WordPressPublisher;
/**
 * WordPress 발행 헬퍼 함수 (간편한 인터페이스)
 */
function publishToWordPress(options, onLog) {
    return __awaiter(this, void 0, void 0, function () {
        var wpApi, isConnected, post, postUrl, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    onLog === null || onLog === void 0 ? void 0 : onLog('[WP] WordPress 발행 시작...');
                    wpApi = new wordpress_api_1.WordPressAPI({
                        siteUrl: options.siteUrl,
                        username: options.username,
                        password: options.password
                    });
                    // 연결 테스트
                    onLog === null || onLog === void 0 ? void 0 : onLog('[WP] WordPress 연결 확인 중...');
                    return [4 /*yield*/, wpApi.testConnection()];
                case 1:
                    isConnected = _a.sent();
                    if (!isConnected) {
                        throw new Error('WordPress 사이트에 연결할 수 없습니다. URL과 인증 정보를 확인해주세요.');
                    }
                    onLog === null || onLog === void 0 ? void 0 : onLog('✅ WordPress 연결 확인 완료');
                    // 포스트 생성
                    onLog === null || onLog === void 0 ? void 0 : onLog('[WP] 포스트 생성 중...');
                    return [4 /*yield*/, wpApi.createPost({
                            title: options.title,
                            content: options.content,
                            status: options.status || 'draft',
                            categories: options.categories || []
                        })];
                case 2:
                    post = _a.sent();
                    if (post && post.id) {
                        postUrl = "".concat(options.siteUrl, "/wp-admin/post.php?post=").concat(post.id, "&action=edit");
                        onLog === null || onLog === void 0 ? void 0 : onLog("\u2705 WordPress \uD3EC\uC2A4\uD2B8 \uC0DD\uC131 \uC644\uB8CC: ".concat(postUrl));
                        return [2 /*return*/, {
                                ok: true,
                                url: postUrl,
                                id: post.id
                            }];
                    }
                    else {
                        throw new Error('포스트 생성 응답이 올바르지 않습니다.');
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_7 = _a.sent();
                    onLog === null || onLog === void 0 ? void 0 : onLog("\u274C WordPress \uBC1C\uD589 \uC2E4\uD328: ".concat(error_7.message));
                    return [2 /*return*/, {
                            ok: false,
                            error: error_7.message
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
