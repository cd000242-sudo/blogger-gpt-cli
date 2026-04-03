import { promises as fs } from 'fs';
import * as path from 'path';

export interface SectionInspectionReport {
  index: number;
  title: string;
  sampleParagraphs: string[];
  factCheckCandidates: string[];
  potentialAiTonePhrases: string[];
}

export interface InspectionReportSummary {
  totalSections: number;
  totalFactChecks: number;
  flaggedSections: number;
}

export interface InspectionReport {
  topic: string;
  generatedAt: string;
  summary: InspectionReportSummary;
  sections: SectionInspectionReport[];
}

export function htmlToParagraphs(html: string): string[] {
  if (!html) return [];
  return html
    .replace(/\r/g, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .split('\n')
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .filter(paragraph => paragraph.length > 0);
}

export function extractSampleParagraphs(html: string, maxParagraphs: number = 2): string[] {
  const paragraphs = htmlToParagraphs(html);
  return paragraphs.slice(0, maxParagraphs);
}

export function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[\.?!])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
}

export function detectFactCheckCandidates(paragraphs: string[]): string[] {
  const sentences = paragraphs.flatMap(splitIntoSentences);
  const numberRegex = /\d+/;
  const metricRegex = /(퍼센트|비율|%|원|달러|만원|kg|킬로|km|시간|일|개월|년|단계|차수)/i;
  return sentences
    .filter(sentence => numberRegex.test(sentence) || metricRegex.test(sentence))
    .slice(0, 5);
}

const AI_TONE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /이 글에서는/gi, label: '“이 글에서는” 표현' },
  { regex: /이번 글에서는/gi, label: '“이번 글에서는” 표현' },
  { regex: /이번 포스트에서는/gi, label: '“이번 포스트에서는” 표현' },
  { regex: /여러분께/gi, label: '“여러분께” 표현' },
  { regex: /정리해 드리겠습니다/gi, label: '정리해 드리겠습니다' },
  { regex: /살펴보겠습니다/gi, label: '살펴보겠습니다' },
  { regex: /알아보겠습니다/gi, label: '알아보겠습니다' },
  { regex: /확인해볼까요/gi, label: '확인해볼까요?' },
];

export function detectAiTonePhrases(paragraphs: string[]): string[] {
  const findings = new Set<string>();
  for (const paragraph of paragraphs) {
    for (const pattern of AI_TONE_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(paragraph)) {
        findings.add(pattern.label);
      }
    }
  }
  return Array.from(findings);
}

export function extractSectionTitleFromHtml(sectionHtml: string, fallback: string, index: number): string {
  const match = sectionHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (match && match[1]) {
    return htmlToParagraphs(match[1])[0] || fallback || `섹션 ${index + 1}`;
  }
  return fallback || `섹션 ${index + 1}`;
}

export function buildInspectionReport(topic: string, sections: string[], subtopics: string[]): InspectionReport {
  const entries: SectionInspectionReport[] = [];
  let factTotal = 0;
  let flaggedSections = 0;

  sections.forEach((sectionHtml, index) => {
    const title = extractSectionTitleFromHtml(sectionHtml, subtopics[index] || '', index);
    const sampleParagraphs = extractSampleParagraphs(sectionHtml);
    const factCheckCandidates = detectFactCheckCandidates(sampleParagraphs);
    const aiToneFindings = detectAiTonePhrases(sampleParagraphs);

    if (sampleParagraphs.length === 0 && factCheckCandidates.length === 0 && aiToneFindings.length === 0) {
      return;
    }

    factTotal += factCheckCandidates.length;
    if (aiToneFindings.length > 0) {
      flaggedSections += 1;
    }

    entries.push({
      index: index + 1,
      title,
      sampleParagraphs,
      factCheckCandidates,
      potentialAiTonePhrases: aiToneFindings,
    });
  });

  return {
    topic,
    generatedAt: new Date().toISOString(),
    summary: {
      totalSections: sections.length,
      totalFactChecks: factTotal,
      flaggedSections,
    },
    sections: entries,
  };
}

export async function writeInspectionReportToFile(report: InspectionReport, filePath: string): Promise<void> {
  if (!filePath) return;
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const dir = path.dirname(resolvedPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolvedPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`🗂️ [INSPECTION] 보고서 저장: ${resolvedPath}`);
}

export const __TESTING__ = {
  htmlToParagraphs,
  extractSampleParagraphs,
  splitIntoSentences,
  detectFactCheckCandidates,
  detectAiTonePhrases,
  extractSectionTitleFromHtml,
  buildInspectionReport,
};


