/**
 * RAG compliance API types — shared between the popup and side panel.
 *
 * The actual fetch runs inside the background service worker so that long
 * LLM/scraping calls survive the popup being closed.  The popup communicates
 * via chrome.runtime.sendMessage and reads state from chrome.storage.local.
 */

export type ComplianceStatus = 'compliant' | 'non-compliant' | 'partial' | 'unknown';

export interface RagLabelResult {
  label: string;
  priority: string;
  compliant: boolean;
  violation: boolean;
  missing: boolean;
  explanation: string;
  policy_excerpt: string;
  legal_basis: string;
  recommendation: string;
}

export interface RagCategoryResult {
  id: number;
  name: string;
  score: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'COMPLIANT';
  critical_violations: number;
  high_violations: number;
  labels: RagLabelResult[];
}

export interface RagComplianceResult {
  url: string;
  regulation: string;
  timestamp: string;
  risk_level: string;
  overall_score: number;
  total_critical_violations: number;
  total_high_violations: number;
  summary: string;
  categories: RagCategoryResult[];
}
