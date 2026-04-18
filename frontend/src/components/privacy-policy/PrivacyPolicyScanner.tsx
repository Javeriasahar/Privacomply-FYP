import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileSearch, CheckCircle2, XCircle, AlertCircle, Loader2, Upload,
  ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/cn';
import type { RagComplianceResult, RagCategoryResult, RagLabelResult } from '@/store/privacyPolicyScanStore';

// ── Types ─────────────────────────────────────────────────────────────────────

type StoredCheck =
  | { status: 'scanning'; url: string; regulation: string; timestamp: number }
  | { status: 'complete'; url: string; regulation: string; result: RagComplianceResult; timestamp: number }
  | { status: 'error';    url: string; regulation: string; error: string; timestamp: number }
  | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const severityBadge = (severity: RagCategoryResult['severity']) => {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-0';
    case 'HIGH':     return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-0';
    case 'MEDIUM':   return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-0';
    default:         return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0';
  }
};

const LabelRow = ({ label }: { label: RagLabelResult }) => {
  const [open, setOpen] = useState(false);
  const hasDetail = !label.compliant && (label.explanation || label.recommendation);

  return (
    <div className="border border-gray-100 dark:border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors"
        onClick={() => hasDetail && setOpen(o => !o)}
        disabled={!hasDetail}
      >
        <div className="flex-shrink-0 mt-0.5">
          {label.compliant
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : label.violation
              ? <XCircle className="w-4 h-4 text-red-500" />
              : <AlertCircle className="w-4 h-4 text-amber-500" />
          }
        </div>
        <span className="flex-1 text-xs text-gray-700 dark:text-foreground leading-snug">
          {label.label}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant="outline" className={cn(
            'text-[10px] px-1.5 py-0 rounded border-0',
            label.priority === 'Critical' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' :
            label.priority === 'High'     ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' :
                                            'bg-gray-100 text-gray-500 dark:bg-muted dark:text-muted-foreground'
          )}>
            {label.priority}
          </Badge>
          {hasDetail && (open
            ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      </button>

      {open && hasDetail && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/30">
          {label.explanation && (
            <p className="text-xs text-gray-600 dark:text-muted-foreground pt-2 leading-relaxed">
              {label.explanation}
            </p>
          )}
          {label.recommendation && (
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-md border border-amber-100 dark:border-amber-500/20">
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <span className="font-semibold">Recommendation: </span>{label.recommendation}
              </p>
            </div>
          )}
          {label.legal_basis && (
            <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
              {label.legal_basis}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const CategorySection = ({ cat }: { cat: RagCategoryResult }) => {
  const [open, setOpen] = useState(cat.severity !== 'COMPLIANT');
  const isCompliant = cat.severity === 'COMPLIANT';

  return (
    <div className="border border-gray-200 dark:border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          isCompliant ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'
        )}>
          {isCompliant
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            : <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-foreground">{cat.name}</p>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">
            {cat.labels.filter(l => l.compliant).length}/{cat.labels.length} checks passed
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={cn('text-xs rounded-lg', severityBadge(cat.severity))}>
            {cat.severity === 'COMPLIANT' ? 'Compliant' : cat.severity}
          </Badge>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-3 border-t border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/30 space-y-2">
          {cat.labels.map((label, i) => (
            <LabelRow key={i} label={label} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── PDF Export ────────────────────────────────────────────────────────────────

const regulationLabel = (reg: string): { badge: string; full: string } => {
  const r = (reg || '').toLowerCase();
  if (r === 'gdpr') return { badge: 'GDPR', full: 'General Data Protection Regulation (EU)' };
  if (r === 'pdpa') return { badge: 'PDPA', full: 'Personal Data Protection Act (PK)' };
  if (r === 'both' || (r.includes('gdpr') && r.includes('pdpa')))
    return { badge: 'GDPR & PDPA', full: 'General Data Protection Regulation & Personal Data Protection Act' };
  return { badge: reg.toUpperCase(), full: reg.toUpperCase() };
};

const downloadPDF = async (result: RagComplianceResult, timestamp: number) => {
  const { jsPDF } = await import('jspdf');

  // ── Page setup ──────────────────────────────────────────────────────────────
  const doc    = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();   // 210
  const pageH  = doc.internal.pageSize.getHeight();  // 297
  const M      = 18;           // left/right margin
  const CW     = pageW - M * 2; // 174 mm content width
  const FOOTER = 13;
  const LINE   = 6;            // standard body line-height (mm) for 10 pt
  let y        = 0;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const newPageIfNeeded = (need: number) => {
    if (y + need > pageH - FOOTER - 4) { doc.addPage(); y = M; }
  };

  // wrap MUST receive the font/size that will be used to render the text,
  // because jsPDF uses the current font metrics to calculate line breaks.
  const wrap = (text: string, innerW: number, size: number, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    return doc.splitTextToSize(text, innerW);
  };

  // ── Load extension icon ──────────────────────────────────────────────────
  let iconDataUrl: string | null = null;
  try {
    const url = typeof chrome !== 'undefined' && chrome.runtime
      ? chrome.runtime.getURL('icons/icon48.png') : null;
    if (url) {
      const blob = await fetch(url).then(r => r.blob());
      iconDataUrl = await new Promise<string>(res => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.readAsDataURL(blob);
      });
    }
  } catch { /* icon is optional */ }

  const reg        = regulationLabel(result.regulation);
  const displayUrl = (result.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

  // ── HEADER ──────────────────────────────────────────────────────────────────
  const HDR_H = 40;
  doc.setFillColor(10, 18, 30);
  doc.rect(0, 0, pageW, HDR_H, 'F');
  doc.setFillColor(16, 185, 129);          // emerald accent line
  doc.rect(0, HDR_H, pageW, 1.8, 'F');

  // Logo square
  const IC = 18;
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(M, 11, IC, IC, 4, 4, 'F');
  if (iconDataUrl)
    doc.addImage(iconDataUrl, 'PNG', M + 3, 14, IC - 6, IC - 6);

  // Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('Privacomply', M + IC + 6, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Privacy Policy Compliance Report', M + IC + 6, 29);

  // Report date (right)
  const rDate = new Date(timestamp).toLocaleDateString('en-GB',
    { day: '2-digit', month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(rDate,        pageW - M, 22, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Report Date', pageW - M, 29, { align: 'right' });

  y = HDR_H + 8;

  // ── META CARD ───────────────────────────────────────────────────────────────
  // Three equal columns
  const META_H  = 42;
  const colW    = CW / 3;
  const c1 = M;
  const c2 = M + colW;
  const c3 = M + colW * 2;
  const PAD = 6;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, y, CW, META_H, 4, 4, 'FD');

  // Vertical dividers
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(c2, y + 6, c2, y + META_H - 6);
  doc.line(c3, y + 6, c3, y + META_H - 6);

  // col 1 — Website
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('WEBSITE', c1 + PAD, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const urlW     = colW - PAD * 2;
  const urlLines = wrap(displayUrl, urlW, 10, 'bold');
  doc.text(urlLines.slice(0, 2), c1 + PAD, y + 18);

  // col 2 — Compliance Standard
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('COMPLIANCE STANDARD', c2 + PAD, y + 10);

  // Pill badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const pillTxt = reg.badge;
  const pillTw  = doc.getTextWidth(pillTxt) + 10;
  doc.setFillColor(209, 250, 229);
  doc.setDrawColor(52, 211, 153);
  doc.roundedRect(c2 + PAD, y + 13, pillTw, 8, 2, 2, 'FD');
  doc.setTextColor(6, 95, 70);
  doc.text(pillTxt, c2 + PAD + 5, y + 19);

  // Full name below badge
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const fullLines = wrap(reg.full, colW - PAD * 2, 8);
  doc.text(fullLines.slice(0, 2), c2 + PAD, y + 27);

  // col 3 — Scan Date & Time
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SCAN DATE & TIME', c3 + PAD, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(new Date(timestamp).toLocaleDateString('en-GB'), c3 + PAD, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(new Date(timestamp).toLocaleTimeString(), c3 + PAD, y + 26);

  y += META_H + 7;

  // ── STATS ROW ───────────────────────────────────────────────────────────────
  const passed    = result.categories.filter(c => c.severity === 'COMPLIANT').length;
  const STAT_GAP  = 5;
  const STAT_W    = (CW - STAT_GAP * 3) / 4;
  const STAT_H    = 28;

  const statsData = [
    { label: 'Critical Violations', value: result.total_critical_violations,
      fg: [185,28,28]   as [number,number,number],
      bg: [254,242,242] as [number,number,number],
      bd: [252,165,165] as [number,number,number] },
    { label: 'High Violations',     value: result.total_high_violations,
      fg: [194,65,12]   as [number,number,number],
      bg: [255,247,237] as [number,number,number],
      bd: [253,186,116] as [number,number,number] },
    { label: 'Categories Passed',   value: passed,
      fg: [6,95,70]     as [number,number,number],
      bg: [209,250,229] as [number,number,number],
      bd: [52,211,153]  as [number,number,number] },
    { label: 'Total Categories',    value: result.categories.length,
      fg: [51,65,85]    as [number,number,number],
      bg: [241,245,249] as [number,number,number],
      bd: [203,213,225] as [number,number,number] },
  ];

  statsData.forEach((s, i) => {
    const bx = M + i * (STAT_W + STAT_GAP);
    doc.setFillColor(...s.bg);
    doc.setDrawColor(...s.bd);
    doc.roundedRect(bx, y, STAT_W, STAT_H, 3, 3, 'FD');

    // Left colour strip
    doc.setFillColor(...s.fg);
    doc.roundedRect(bx, y, 3, STAT_H, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...s.fg);
    doc.text(String(s.value), bx + 7, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(s.label, bx + 7, y + 23);
  });

  y += STAT_H + 8;

  // ── EXECUTIVE SUMMARY ───────────────────────────────────────────────────────
  if (result.summary) {
    newPageIfNeeded(30);
    // text starts at x = M + 13, available inner width = CW - 13 - 8
    const sumInnerW = CW - 21;
    const sumLines  = wrap(result.summary, sumInnerW, 10);
    const BOX_H     = sumLines.length * LINE + 22;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(147, 197, 253);
    doc.roundedRect(M, y, CW, BOX_H, 4, 4, 'FD');
    // Accent bar
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(M + 4, y + 5, 3, BOX_H - 10, 1.5, 1.5, 'F');
    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 138);
    doc.text('Executive Summary', M + 13, y + 11);
    // Body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text(sumLines, M + 13, y + 18);
    y += BOX_H + 8;
  }

  // ── CATEGORY BREAKDOWN ──────────────────────────────────────────────────────
  newPageIfNeeded(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Category Breakdown', M, y + 8);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(M, y + 11, M + CW, y + 11);
  y += 16;

  const SEV: Record<string, { fg:[number,number,number]; bg:[number,number,number]; bd:[number,number,number] }> = {
    CRITICAL: { fg:[185,28,28],  bg:[254,242,242], bd:[252,165,165] },
    HIGH:     { fg:[194,65,12],  bg:[255,247,237], bd:[253,186,116] },
    MEDIUM:   { fg:[161,98,7],   bg:[254,249,195], bd:[253,224,71]  },
    COMPLIANT:{ fg:[6,95,70],    bg:[209,250,229], bd:[52,211,153]  },
  };

  result.categories.forEach((cat) => {
    const sev       = SEV[cat.severity] ?? { fg:[71,85,105], bg:[241,245,249], bd:[203,213,225] };
    const catPassed = cat.labels.filter(l => l.compliant).length;
    const CAT_H     = 22;
    newPageIfNeeded(CAT_H + 4);

    // Category header row
    doc.setFillColor(...sev.bg);
    doc.setDrawColor(...sev.bd);
    doc.roundedRect(M, y, CW, CAT_H, 3, 3, 'FD');
    doc.setFillColor(...sev.fg);
    doc.roundedRect(M, y, 4, CAT_H, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(cat.name, M + 9, y + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`${catPassed} of ${cat.labels.length} checks passed`, M + 9, y + 17);

    // Severity pill
    const sevTxt  = cat.severity === 'COMPLIANT' ? 'Compliant' : cat.severity;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const sevTw   = doc.getTextWidth(sevTxt) + 10;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...sev.bd);
    doc.roundedRect(pageW - M - sevTw, y + 7, sevTw, 9, 2, 2, 'FD');
    doc.setTextColor(...sev.fg);
    doc.text(sevTxt, pageW - M - sevTw + 5, y + 13.5);

    y += CAT_H + 4;

    // Non-compliant label items
    cat.labels.filter(l => !l.compliant).forEach((label) => {
      // inner width: box starts at M+8, text at M+17, right pad 10
      const lblInnerW = CW - 19;
      const lblLines  = wrap(label.label, lblInnerW, 9.5);
      const LBL_H     = lblLines.length * LINE + 10;
      newPageIfNeeded(LBL_H + 3);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(M + 8, y, CW - 8, LBL_H, 2, 2, 'FD');
      doc.setFillColor(...sev.fg);
      doc.circle(M + 14, y + 6, 1.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(lblLines, M + 18, y + 7);

      y += LBL_H + 2;

      if (label.recommendation) {
        const recInnerW = CW - 25;
        const recLines  = wrap(label.recommendation, recInnerW, 9);
        const REC_H     = recLines.length * LINE + 12;
        newPageIfNeeded(REC_H + 2);
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(253, 230, 138);
        doc.roundedRect(M + 8, y, CW - 8, REC_H, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(146, 64, 14);
        doc.text('Recommendation:', M + 13, y + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(recLines, M + 13, y + 13);
        y += REC_H + 3;
      }
    });
    y += 4;
  });

  // ── FOOTER on every page ────────────────────────────────────────────────────
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageH - FOOTER, pageW, FOOTER, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(0, pageH - FOOTER, pageW, pageH - FOOTER);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129);
    doc.text('Privacomply', M, pageH - 4);
    const bW = doc.getTextWidth('Privacomply');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(` · Privacy Policy Compliance Report · ${reg.badge}`, M + bW, pageH - 4);

    doc.setFontSize(8);
    doc.text(`Page ${p} of ${totalPages}`, pageW - M, pageH - 4, { align: 'right' });
  }

  const safeName = displayUrl.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
  doc.save(`privacomply_${safeName}_${result.regulation}.pdf`);
};

// ── Dummy Mode ────────────────────────────────────────────────────────────────
// Set to true to skip the backend and render with mock data immediately
const DUMMY_MODE = true;

const DUMMY_RESULT: RagComplianceResult = {
  url: 'https://www.facebook.com/privacy/policy/',
  regulation: 'gdpr',
  timestamp: new Date().toISOString(),
  overall_score: 52,
  risk_level: 'HIGH',
  total_critical_violations: 3,
  total_high_violations: 5,
  summary: 'The privacy policy demonstrates partial GDPR compliance but contains critical gaps in lawful basis documentation, data retention schedules, and cross-border transfer safeguards. Immediate remediation is required in Data Collection, Cross-Border Transfers, and Automated Decisions categories.',
  categories: [
    {
      id: 1, name: 'Data Collection', severity: 'CRITICAL', score: 33, critical_violations: 2, high_violations: 0,
      labels: [
        { label: 'Lawful basis clearly stated for each processing activity', compliant: false, violation: true, missing: false, priority: 'Critical', explanation: 'The policy does not specify a lawful basis (Art. 6) for each distinct processing purpose.', recommendation: 'Explicitly map each processing activity to a lawful basis under GDPR Art. 6.', legal_basis: 'GDPR Art. 6(1)', policy_excerpt: '' },
        { label: 'Data minimisation principle applied', compliant: true, violation: false, missing: false, priority: 'High', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 5(1)(c)', policy_excerpt: '' },
        { label: 'Special category data identified and protected', compliant: false, violation: true, missing: false, priority: 'Critical', explanation: 'No explicit mention of protections for sensitive data categories.', recommendation: 'Add explicit processing conditions for special category data per Art. 9.', legal_basis: 'GDPR Art. 9', policy_excerpt: '' },
      ],
    },
    {
      id: 2, name: 'User Rights & Control', severity: 'HIGH', score: 67, critical_violations: 0, high_violations: 1,
      labels: [
        { label: 'Right to erasure (right to be forgotten) explained', compliant: true, violation: false, missing: false, priority: 'High', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 17', policy_excerpt: '' },
        { label: 'Right to data portability provided', compliant: false, violation: true, missing: false, priority: 'High', explanation: 'No mechanism described for users to export their data in a machine-readable format.', recommendation: 'Provide a data export feature and document it in the policy.', legal_basis: 'GDPR Art. 20', policy_excerpt: '' },
        { label: 'Right to object to processing explained', compliant: true, violation: false, missing: false, priority: 'Medium', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 21', policy_excerpt: '' },
      ],
    },
    {
      id: 3, name: 'Data Retention', severity: 'HIGH', score: 25, critical_violations: 0, high_violations: 2,
      labels: [
        { label: 'Retention periods specified per data category', compliant: false, violation: true, missing: false, priority: 'High', explanation: 'Policy uses vague language ("as long as necessary") without concrete timeframes.', recommendation: 'Define specific retention periods for each category of personal data.', legal_basis: 'GDPR Art. 5(1)(e)', policy_excerpt: '' },
        { label: 'Deletion procedures documented', compliant: false, violation: false, missing: true, priority: 'Medium', explanation: 'Deletion is mentioned but no procedure or timeline is specified.', recommendation: 'Document the deletion procedure and timelines.', legal_basis: 'GDPR Art. 17', policy_excerpt: '' },
      ],
    },
    {
      id: 4, name: 'Cross-Border Transfers', severity: 'CRITICAL', score: 50, critical_violations: 1, high_violations: 0,
      labels: [
        { label: 'Transfer mechanisms identified (SCCs, adequacy decision)', compliant: false, violation: true, missing: false, priority: 'Critical', explanation: 'Transfers to third countries are mentioned but no transfer mechanism is specified.', recommendation: 'Identify and document transfer mechanisms (SCCs, adequacy decisions, BCRs).', legal_basis: 'GDPR Art. 46', policy_excerpt: '' },
        { label: 'Recipient countries listed', compliant: true, violation: false, missing: false, priority: 'Medium', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 13(1)(f)', policy_excerpt: '' },
      ],
    },
    {
      id: 5, name: 'Transparency', severity: 'COMPLIANT', score: 100, critical_violations: 0, high_violations: 0,
      labels: [
        { label: 'Identity of data controller provided', compliant: true, violation: false, missing: false, priority: 'High', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 13(1)(a)', policy_excerpt: '' },
        { label: 'Contact details of DPO provided', compliant: true, violation: false, missing: false, priority: 'Medium', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 13(1)(b)', policy_excerpt: '' },
        { label: 'Policy written in plain language', compliant: true, violation: false, missing: false, priority: 'Medium', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 12(1)', policy_excerpt: '' },
      ],
    },
    {
      id: 6, name: 'Automated Decisions', severity: 'MEDIUM', score: 50, critical_violations: 0, high_violations: 0,
      labels: [
        { label: 'Automated decision-making disclosed', compliant: false, violation: false, missing: true, priority: 'High', explanation: 'The policy does not clearly state whether automated decision-making including profiling takes place.', recommendation: 'Disclose any automated decision-making and its logic under Art. 22.', legal_basis: 'GDPR Art. 22', policy_excerpt: '' },
        { label: 'Right to human review mentioned', compliant: true, violation: false, missing: false, priority: 'Medium', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 22(3)', policy_excerpt: '' },
      ],
    },
  ],
};

// ── Main Component ────────────────────────────────────────────────────────────

export const PrivacyPolicyScanner = () => {
  const { t } = useTranslation();
  const [inputUrl, setInputUrl] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stored result from the popup's compliance check
  const [storedCheck, setStoredCheck] = useState<StoredCheck>(null);

  // Load stored result on mount
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.local.get('compliance_check', (data) => {
      const val = data['compliance_check'] as StoredCheck;
      if (val) setStoredCheck(val);
    });
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if ('compliance_check' in changes) {
        setStoredCheck(changes['compliance_check'].newValue as StoredCheck);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleManualScan = async () => {
    if (!inputUrl.trim()) return;
    let url = inputUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    if (DUMMY_MODE) {
      setStoredCheck({ status: 'scanning', url, regulation: 'gdpr', timestamp: Date.now() });
      setTimeout(() => {
        setStoredCheck({ status: 'complete', url, regulation: 'gdpr', result: { ...DUMMY_RESULT, url }, timestamp: Date.now() });
      }, 1500);
      setManualMode(false);
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.storage.local.set({
        compliance_check: { status: 'scanning', url, regulation: 'gdpr', timestamp: Date.now() },
      });
      chrome.runtime.sendMessage({ type: 'START_COMPLIANCE_CHECK', url, regulation: 'gdpr' });
      setManualMode(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setInputUrl(event.target?.result as string);
    reader.readAsText(file);
  };

  const isScanning = storedCheck?.status === 'scanning';
  const isError    = storedCheck?.status === 'error';
  const isDone     = storedCheck?.status === 'complete';
  const ragResult  = isDone ? (storedCheck as Extract<StoredCheck, { status: 'complete' }>).result : null;

  // ── Show detailed report if we have a stored result ────────────────────────
  if (isScanning) {
    return (
      <div className="p-8 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Analysing privacy policy…</p>
        <p className="text-xs text-emerald-600 dark:text-emerald-500">This may take a minute. You can close the popup — this page will update automatically.</p>
      </div>
    );
  }

  if (isError) {
    const errMsg = (storedCheck as Extract<StoredCheck, { status: 'error' }>).error;
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/30">
          <div className="flex gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-400">Compliance check failed</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">{errMsg}</p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setManualMode(true); setStoredCheck(null); chrome.storage.local.remove('compliance_check'); }}
        >
          Try another URL
        </Button>
      </div>
    );
  }

  const storedTimestamp = storedCheck && 'timestamp' in storedCheck ? storedCheck.timestamp : Date.now();

  if (isDone && ragResult && !manualMode) {
    return (
      <div className="space-y-4">
        {/* Report header */}
        <div className="p-4 bg-gray-50 dark:bg-muted rounded-xl flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-muted-foreground">Analysed URL</p>
            <p className="text-sm font-medium text-gray-900 dark:text-foreground truncate">
              {(ragResult.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </p>
            <p className="text-xs text-gray-400 dark:text-muted-foreground mt-0.5">
              {ragResult.regulation.toUpperCase()} · {new Date(storedTimestamp).toLocaleString()}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="flex-shrink-0 h-8 px-3 bg-white dark:bg-secondary border-gray-200 dark:border-border hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            onClick={() => downloadPDF(ragResult, storedTimestamp)}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-xl">
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{ragResult.total_critical_violations}</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Critical</p>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl">
            <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{ragResult.total_high_violations}</p>
            <p className="text-xs text-orange-600 dark:text-orange-500 mt-0.5">High</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {ragResult.categories.filter(c => c.severity === 'COMPLIANT').length}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Passed</p>
          </div>
        </div>

        {/* Executive summary */}
        {ragResult.summary && (
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Summary</p>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">{ragResult.summary}</p>
          </div>
        )}

        {/* Category breakdown — scrollable */}
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-foreground mb-3">
            Category Breakdown
          </p>
          <ScrollArea className="h-[420px] pr-4">
            <div className="space-y-3 pb-2">
              {ragResult.categories.map((cat) => (
                <CategorySection key={cat.id} cat={cat} />
              ))}
            </div>
          </ScrollArea>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => { setManualMode(true); }}
        >
          <FileSearch className="w-4 h-4 mr-2" />
          Scan a different URL
        </Button>
      </div>
    );
  }

  // ── Manual scan input (initial / manual mode) ─────────────────────────────
  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 dark:bg-muted rounded-xl">
        <Label className="text-sm font-medium mb-3 block">{t('privacyScanner.urlInput.label')}</Label>
        <div className="space-y-3">
          <Textarea
            placeholder={t('privacyScanner.urlInput.placeholder')}
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="min-h-[100px] bg-white dark:bg-secondary dark:border-border resize-y"
          />
          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="bg-white dark:bg-secondary border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t('privacyScanner.uploadButton')}
            </Button>
            <Button
              onClick={handleManualScan}
              disabled={!inputUrl.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1"
            >
              <FileSearch className="w-4 h-4 mr-2" />
              {t('privacyScanner.scanButton')}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
          {t('privacyScanner.urlInput.hint')}
        </p>
      </div>

      {/* Prompt if there's a recent result they can go back to */}
      {manualMode && isDone && ragResult && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setManualMode(false)}>
          ← Back to last report ({ragResult.url})
        </Button>
      )}

      {!storedCheck && (
        <div className="p-8 bg-gray-50 dark:bg-muted rounded-xl text-center border-2 border-dashed border-gray-200 dark:border-border">
          <FileSearch className="w-12 h-12 text-gray-400 dark:text-muted-foreground mx-auto mb-3" />
          <h4 className="text-sm font-medium text-gray-700 dark:text-foreground mb-1">
            {t('privacyScanner.initial.title')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-muted-foreground">
            {t('privacyScanner.initial.message')}
          </p>
        </div>
      )}
    </div>
  );
};
