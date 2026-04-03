import { ProductDetailSnapshot } from './types';
import { ResearchDatum } from '../core/types';

export function snapshotToResearch(snapshot: ProductDetailSnapshot): ResearchDatum[] {
  const research: ResearchDatum[] = [];

  snapshot.features.forEach((feature, index) => {
    const id = `feature-${index}`;
    research.push({
      id,
      title: feature.heading || `핵심 특징 ${index + 1}`,
      summary: feature.body,
      content: buildFeatureContent(feature),
      url: snapshot.officialUrl || snapshot.rawUrl,
      source: 'manual',
      capturedAt: snapshot.capturedAt,
      confidence: 0.85,
      metadata: {
        type: 'feature',
        benefit: feature.benefit,
        evidence: feature.evidence,
        sourceDomain: snapshot.sourceDomain
      }
    });
  });

  Object.entries(snapshot.specs).forEach(([name, value], index) => {
    research.push({
      id: `spec-${index}`,
      title: `제품 스펙 - ${name}`,
      summary: `${name}: ${value}`,
      content: `${name}: ${value}`,
      url: snapshot.officialUrl || snapshot.rawUrl,
      source: 'manual',
      capturedAt: snapshot.capturedAt,
      confidence: 0.75,
      metadata: {
        type: 'spec',
        sourceDomain: snapshot.sourceDomain
      }
    });
  });

  snapshot.reviews.forEach((review, index) => {
    research.push({
      id: `review-${index}`,
      title: '사용자 후기',
      summary: review.quote,
      content: review.quote,
      url: snapshot.officialUrl || snapshot.rawUrl,
      source: 'manual',
      capturedAt: snapshot.capturedAt,
      confidence: 0.7,
      metadata: {
        type: 'review',
        rating: review.rating,
        sourceDomain: review.source || snapshot.sourceDomain
      }
    });
  });

  if (snapshot.description) {
    research.unshift({
      id: 'product-overview',
      title: `${snapshot.title} 개요`,
      summary: snapshot.description,
      content: snapshot.description,
      url: snapshot.officialUrl || snapshot.rawUrl,
      source: 'manual',
      capturedAt: snapshot.capturedAt,
      confidence: 0.8,
      metadata: {
        type: 'overview',
        sourceDomain: snapshot.sourceDomain
      }
    });
  }

  return research;
}

function buildFeatureContent(feature: ProductDetailSnapshot['features'][number]): string {
  const lines = [feature.body];
  if (feature.benefit) {
    lines.push(`핵심 혜택: ${feature.benefit}`);
  }
  if (feature.evidence) {
    lines.push(`근거: ${feature.evidence}`);
  }
  return lines.filter(Boolean).join('\n');
}

