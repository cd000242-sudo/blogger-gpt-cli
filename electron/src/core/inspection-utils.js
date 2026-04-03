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
exports.__TESTING__ = void 0;
exports.htmlToParagraphs = htmlToParagraphs;
exports.extractSampleParagraphs = extractSampleParagraphs;
exports.splitIntoSentences = splitIntoSentences;
exports.detectFactCheckCandidates = detectFactCheckCandidates;
exports.detectAiTonePhrases = detectAiTonePhrases;
exports.extractSectionTitleFromHtml = extractSectionTitleFromHtml;
exports.buildInspectionReport = buildInspectionReport;
exports.writeInspectionReportToFile = writeInspectionReportToFile;
var fs_1 = require("fs");
var path = require("path");
function htmlToParagraphs(html) {
    if (!html)
        return [];
    return html
        .replace(/\r/g, '')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, '\n')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .split('\n')
        .map(function (paragraph) { return paragraph.replace(/\s+/g, ' ').trim(); })
        .filter(function (paragraph) { return paragraph.length > 0; });
}
function extractSampleParagraphs(html, maxParagraphs) {
    if (maxParagraphs === void 0) { maxParagraphs = 2; }
    var paragraphs = htmlToParagraphs(html);
    return paragraphs.slice(0, maxParagraphs);
}
function splitIntoSentences(text) {
    if (!text)
        return [];
    return text
        .split(/(?<=[\.?!])\s+/)
        .map(function (sentence) { return sentence.trim(); })
        .filter(function (sentence) { return sentence.length > 0; });
}
function detectFactCheckCandidates(paragraphs) {
    var sentences = paragraphs.flatMap(splitIntoSentences);
    var numberRegex = /\d+/;
    var metricRegex = /(퍼센트|비율|%|원|달러|만원|kg|킬로|km|시간|일|개월|년|단계|차수)/i;
    return sentences
        .filter(function (sentence) { return numberRegex.test(sentence) || metricRegex.test(sentence); })
        .slice(0, 5);
}
var AI_TONE_PATTERNS = [
    { regex: /이 글에서는/gi, label: '“이 글에서는” 표현' },
    { regex: /이번 글에서는/gi, label: '“이번 글에서는” 표현' },
    { regex: /이번 포스트에서는/gi, label: '“이번 포스트에서는” 표현' },
    { regex: /여러분께/gi, label: '“여러분께” 표현' },
    { regex: /정리해 드리겠습니다/gi, label: '정리해 드리겠습니다' },
    { regex: /살펴보겠습니다/gi, label: '살펴보겠습니다' },
    { regex: /알아보겠습니다/gi, label: '알아보겠습니다' },
    { regex: /확인해볼까요/gi, label: '확인해볼까요?' },
];
function detectAiTonePhrases(paragraphs) {
    var findings = new Set();
    for (var _i = 0, paragraphs_1 = paragraphs; _i < paragraphs_1.length; _i++) {
        var paragraph = paragraphs_1[_i];
        for (var _a = 0, AI_TONE_PATTERNS_1 = AI_TONE_PATTERNS; _a < AI_TONE_PATTERNS_1.length; _a++) {
            var pattern = AI_TONE_PATTERNS_1[_a];
            pattern.regex.lastIndex = 0;
            if (pattern.regex.test(paragraph)) {
                findings.add(pattern.label);
            }
        }
    }
    return Array.from(findings);
}
function extractSectionTitleFromHtml(sectionHtml, fallback, index) {
    var match = sectionHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (match && match[1]) {
        return htmlToParagraphs(match[1])[0] || fallback || "\uC139\uC158 ".concat(index + 1);
    }
    return fallback || "\uC139\uC158 ".concat(index + 1);
}
function buildInspectionReport(topic, sections, subtopics) {
    var entries = [];
    var factTotal = 0;
    var flaggedSections = 0;
    sections.forEach(function (sectionHtml, index) {
        var title = extractSectionTitleFromHtml(sectionHtml, subtopics[index] || '', index);
        var sampleParagraphs = extractSampleParagraphs(sectionHtml);
        var factCheckCandidates = detectFactCheckCandidates(sampleParagraphs);
        var aiToneFindings = detectAiTonePhrases(sampleParagraphs);
        if (sampleParagraphs.length === 0 && factCheckCandidates.length === 0 && aiToneFindings.length === 0) {
            return;
        }
        factTotal += factCheckCandidates.length;
        if (aiToneFindings.length > 0) {
            flaggedSections += 1;
        }
        entries.push({
            index: index + 1,
            title: title,
            sampleParagraphs: sampleParagraphs,
            factCheckCandidates: factCheckCandidates,
            potentialAiTonePhrases: aiToneFindings,
        });
    });
    return {
        topic: topic,
        generatedAt: new Date().toISOString(),
        summary: {
            totalSections: sections.length,
            totalFactChecks: factTotal,
            flaggedSections: flaggedSections,
        },
        sections: entries,
    };
}
function writeInspectionReportToFile(report, filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var resolvedPath, dir;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!filePath)
                        return [2 /*return*/];
                    resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
                    dir = path.dirname(resolvedPath);
                    return [4 /*yield*/, fs_1.promises.mkdir(dir, { recursive: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, fs_1.promises.writeFile(resolvedPath, JSON.stringify(report, null, 2), 'utf8')];
                case 2:
                    _a.sent();
                    console.log("\uD83D\uDDC2\uFE0F [INSPECTION] \uBCF4\uACE0\uC11C \uC800\uC7A5: ".concat(resolvedPath));
                    return [2 /*return*/];
            }
        });
    });
}
exports.__TESTING__ = {
    htmlToParagraphs: htmlToParagraphs,
    extractSampleParagraphs: extractSampleParagraphs,
    splitIntoSentences: splitIntoSentences,
    detectFactCheckCandidates: detectFactCheckCandidates,
    detectAiTonePhrases: detectAiTonePhrases,
    extractSectionTitleFromHtml: extractSectionTitleFromHtml,
    buildInspectionReport: buildInspectionReport,
};
