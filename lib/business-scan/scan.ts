import crypto from "node:crypto";

import { auditUrl } from "@/lib/siteops/audit";
import {
  computeBusinessVisibilityScore,
  getIncludedScoredPages,
} from "@/lib/business-scan/scoring";
import { buildFixFirstRecommendations } from "@/lib/business-scan/recommendations";
import type {
  BusinessPageAudit,
  BusinessScanDashboard,
  BusinessScanPage,
  BusinessScanProject,
  BusinessScanRun,
} from "@/lib/business-scan/types";

export async function runBusinessAwareScan(
  project: BusinessScanProject,
): Promise<BusinessScanDashboard> {
  const includedPages = getIncludedScoredPages(project.pages);
  if (!includedPages.length) {
    throw new Error("Include at least one page to run a Business-Aware Scan.");
  }

  const auditedPages = await auditIncludedPages(includedPages);
  const pageById = new Map(project.pages.map((page) => [page.id, page]));

  for (const audit of auditedPages) {
    const existing = pageById.get(audit.page.id);
    if (!existing) continue;
    pageById.set(audit.page.id, {
      ...existing,
      score: audit.report.scores.composite,
      contentSummary: summarizeReport(audit.report.scores.composite),
      lastCheckedAt: audit.report.timestamp,
    });
  }

  const updatedPages = project.pages.map((page) => pageById.get(page.id) ?? page);
  const scoreResult = computeBusinessVisibilityScore(updatedPages);
  const recommendations = buildFixFirstRecommendations({
    audits: auditedPages,
    pageContributions: scoreResult.pageContributions,
  });
  const recoverableProjectImpactPoints = recommendations
    .slice(0, 5)
    .reduce((sum, recommendation) => sum + recommendation.expectedScoreGain, 0);
  const potentialScore = roundScore(
    Math.min(100, scoreResult.currentScore + recoverableProjectImpactPoints),
  );
  const lostOpportunityScore = roundScore(potentialScore - scoreResult.currentScore);

  const run: BusinessScanRun = {
    id: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    currentScore: scoreResult.currentScore,
    potentialScore,
    lostOpportunityScore,
    categoryScores: scoreResult.scoringMix,
    pageScores: scoreResult.pageContributions,
    recommendations,
    auditedPages: auditedPages.length,
  };

  const updatedProject: BusinessScanProject = {
    ...project,
    pages: updatedPages,
    discoveredUrls: updatedPages.map((page) => page.url),
    scanHistory: [run, ...project.scanHistory].slice(0, 20),
    latestScore: run.currentScore,
    potentialScore: run.potentialScore,
    lostOpportunityScore: run.lostOpportunityScore,
    updatedAt: run.scannedAt,
  };

  return {
    run,
    project: updatedProject,
  };
}

async function auditIncludedPages(pages: BusinessScanPage[]) {
  const results: BusinessPageAudit[] = [];
  const queue = [...pages];

  while (queue.length) {
    const batch = queue.splice(0, 4);
    const audits = await Promise.all(
      batch.map(async (page) => {
        try {
          const report = await auditUrl(page.url);
          return { page, report } satisfies BusinessPageAudit;
        } catch {
          return null;
        }
      }),
    );

    results.push(
      ...audits.filter((audit): audit is BusinessPageAudit => Boolean(audit)),
    );
  }

  return results;
}

function summarizeReport(score: number) {
  if (score >= 85) return "Strong AI visibility signals detected.";
  if (score >= 70) return "Good foundation with visible improvement gaps.";
  if (score >= 50) return "Several gaps may limit AI understanding.";
  return "High-priority visibility gaps detected.";
}

function roundScore(score: number) {
  return Math.round(score * 10) / 10;
}
