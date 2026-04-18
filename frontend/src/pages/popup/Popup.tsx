import React, { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Scan, ShieldCheck, ChevronRight, Cookie, BarChart3, Megaphone,
  Shield, FileSearch, Loader2, CheckCircle2, XCircle, Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { ScanProgress } from '@/components/scan/ScanProgress';
import { useScanStore } from '@/store/scanStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import type { RagComplianceResult, RagCategoryResult } from '@/store/privacyPolicyScanStore';

// ── Compliance state read from chrome.storage.local ─────────────────────────
type ComplianceCheckState =
  | { status: 'scanning'; url: string; regulation: string; timestamp: number }
  | { status: 'complete'; url: string; regulation: string; result: RagComplianceResult; timestamp: number }
  | { status: 'error'; url: string; regulation: string; error: string; timestamp: number }
  | null;

// Which popup "view" is active
type ActiveView = 'initial' | 'cookie' | 'compliance';


const CategoryRow = ({ cat }: { cat: RagCategoryResult }) => {
  const isCompliant = cat.severity === 'COMPLIANT';
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-muted rounded-xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          isCompliant ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'
        )}>
          {isCompliant
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            : <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          }
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-foreground leading-tight">
          {cat.name}
        </span>
      </div>
      <Badge
        variant="secondary"
        className={cn(
          'text-xs rounded-lg border-0 flex-shrink-0',
          isCompliant
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
        )}
      >
        {isCompliant ? 'Compliant' : 'Issues'}
      </Badge>
    </div>
  );
};


// ── Component ─────────────────────────────────────────────────────────────────

const Popup = () => {
  const { t } = useTranslation();
  const { isScanning, scanResults, startScan, currentUrl } = useScanStore();
  const { complianceStandards } = useSettingsStore();

  useTheme();

  const [activeTabUrl, setActiveTabUrl] = React.useState('');
  const [fullTabUrl, setFullTabUrl] = React.useState('');
  const [activeView, setActiveView] = React.useState<ActiveView>('initial');
  const [complianceState, setComplianceState] = React.useState<ComplianceCheckState>(null);

  const [regulation, setRegulation] = React.useState<'gdpr' | 'pdpa' | 'both'>(() => {
    const s = complianceStandards;
    if (s.includes('gdpr') && s.includes('pdpa')) return 'both';
    if (s.includes('pdpa')) return 'pdpa';
    return 'gdpr';
  });

  // ── Get current tab URLs on mount ────────────────────────────────────────
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          setFullTabUrl(tabs[0].url);
          setActiveTabUrl(new URL(tabs[0].url).hostname);
        }
      });
    } else {
      setFullTabUrl('https://example.com');
      setActiveTabUrl('example.com');
    }
  }, []);

  // ── Restore in-progress or completed compliance state on mount ───────────
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    chrome.storage.local.get('compliance_check', (data) => {
      const saved = data['compliance_check'] as ComplianceCheckState;
      if (!saved) return;

      // Only restore if it's recent (last 5 min) — avoids stale state
      const age = Date.now() - (saved?.timestamp ?? 0);
      if (age < 5 * 60 * 1000) {
        setComplianceState(saved);
        setActiveView('compliance');
      }
    });
  }, []);

  // ── Listen to storage changes so popup updates when background finishes ──
  const handleStorageChange = useCallback(
    (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if ('compliance_check' in changes) {
        const newValue = changes['compliance_check'].newValue as ComplianceCheckState;
        setComplianceState(newValue);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [handleStorageChange]);

  // ── Cookie protection scan ────────────────────────────────────────────────
  const handleScan = () => {
    startScan(activeTabUrl);
    setActiveView('cookie');
  };

  // ── Privacy policy compliance check via RAG backend ──────────────────────
  const DUMMY_MODE = true; // set false to use real backend

  const handleCheckCompliance = () => {
    const url = fullTabUrl || activeTabUrl;
    if (!url) return;

    if (DUMMY_MODE) {
      setComplianceState({ status: 'scanning', url, regulation, timestamp: Date.now() });
      setActiveView('compliance');
      setTimeout(() => {
        const dummyResult = {
          url, regulation, timestamp: new Date().toISOString(),
          overall_score: 52, risk_level: 'HIGH',
          total_critical_violations: 3, total_high_violations: 5,
          summary: 'The privacy policy demonstrates partial GDPR compliance but contains critical gaps in lawful basis documentation, data retention schedules, and cross-border transfer safeguards.',
          categories: [
            { id: 1, name: 'Data Collection', severity: 'CRITICAL' as const, score: 33, critical_violations: 2, high_violations: 0, labels: [
              { label: 'Lawful basis clearly stated', compliant: false, violation: true, missing: false, priority: 'Critical', explanation: 'No lawful basis specified per Art. 6.', recommendation: 'Map each purpose to a lawful basis.', legal_basis: 'GDPR Art. 6(1)', policy_excerpt: '' },
              { label: 'Data minimisation applied', compliant: true, violation: false, missing: false, priority: 'High', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 5(1)(c)', policy_excerpt: '' },
            ]},
            { id: 2, name: 'User Rights & Control', severity: 'HIGH' as const, score: 67, critical_violations: 0, high_violations: 1, labels: [
              { label: 'Right to erasure explained', compliant: true, violation: false, missing: false, priority: 'High', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 17', policy_excerpt: '' },
              { label: 'Right to data portability provided', compliant: false, violation: true, missing: false, priority: 'High', explanation: 'No data export mechanism described.', recommendation: 'Provide a machine-readable export feature.', legal_basis: 'GDPR Art. 20', policy_excerpt: '' },
            ]},
            { id: 3, name: 'Cross-Border Transfers', severity: 'CRITICAL' as const, score: 50, critical_violations: 1, high_violations: 0, labels: [
              { label: 'Transfer mechanisms identified', compliant: false, violation: true, missing: false, priority: 'Critical', explanation: 'No SCCs or adequacy decision referenced.', recommendation: 'Document transfer mechanisms per Art. 46.', legal_basis: 'GDPR Art. 46', policy_excerpt: '' },
              { label: 'Recipient countries listed', compliant: true, violation: false, missing: false, priority: 'Medium', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 13(1)(f)', policy_excerpt: '' },
            ]},
            { id: 4, name: 'Transparency', severity: 'COMPLIANT' as const, score: 100, critical_violations: 0, high_violations: 0, labels: [
              { label: 'Identity of data controller provided', compliant: true, violation: false, missing: false, priority: 'High', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 13(1)(a)', policy_excerpt: '' },
              { label: 'Policy written in plain language', compliant: true, violation: false, missing: false, priority: 'Medium', explanation: '', recommendation: '', legal_basis: 'GDPR Art. 12(1)', policy_excerpt: '' },
            ]},
          ],
        };
        if (typeof chrome !== 'undefined') {
          chrome.storage.local.set({ compliance_check: { status: 'complete', url, regulation, result: dummyResult, timestamp: Date.now() } });
        }
        setComplianceState({ status: 'complete', url, regulation, result: dummyResult, timestamp: Date.now() });
      }, 1500);
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'CLEAR_COMPLIANCE_RESULT' });
    }
    setComplianceState({ status: 'scanning', url, regulation, timestamp: Date.now() });
    setActiveView('compliance');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'START_COMPLIANCE_CHECK', url, regulation });
    }
  };

  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.openOptionsPage();
    }
  };

  const openSidePanel = () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) console.log('Open side panel for tab', tabs[0].id);
      });
    }
  };

  const openTrackerMap = () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ options_active_tab: 'trackers' }, () => {
        chrome.runtime.openOptionsPage();
      });
    }
  };

  // ── Cookie scan derived values ────────────────────────────────────────────
  const isCompliant = scanResults ? scanResults.summary.blocked === 0 : false;
  const totalCookies = scanResults ? scanResults.summary.total : 0;
  const categoryData = scanResults ? [
    { name: 'Necessary',   count: scanResults.summary.necessary,  icon: Shield,    color: 'emerald' },
    { name: 'Functional',  count: scanResults.summary.functional,  icon: Cookie,    color: 'blue' },
    { name: 'Analytics',   count: scanResults.summary.analytics,   icon: BarChart3, color: 'amber' },
    { name: 'Advertising', count: scanResults.summary.advertising, icon: Megaphone, color: 'red' },
  ] : [];

  // ── Compliance state aliases ──────────────────────────────────────────────
  const isComplianceScanning = complianceState?.status === 'scanning';
  const isComplianceError    = complianceState?.status === 'error';
  const isComplianceDone     = complianceState?.status === 'complete';
  const ragResult = isComplianceDone ? (complianceState as Extract<ComplianceCheckState, { status: 'complete' }>).result : null;
  const complianceError = isComplianceError ? (complianceState as Extract<ComplianceCheckState, { status: 'error' }>).error : '';

  return (
    <div className="w-[400px] h-[600px] flex flex-col bg-white dark:bg-background overflow-hidden font-sans rounded-xl shadow-2xl border border-gray-200 dark:border-border transition-colors duration-200">
      <Header url={currentUrl || activeTabUrl || 'Loading...'} onSettingsClick={openOptions} />

      <main className="flex-1 overflow-hidden relative p-6 flex flex-col bg-white dark:bg-background">

        {/* ── INITIAL STATE ── */}
        {activeView === 'initial' && (
          <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center shadow-sm">
              <Shield className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="w-full max-w-[280px] flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl h-[48px] px-6 text-[15px] font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30"
                onClick={handleScan}
              >
                <Shield className="w-4 h-4 mr-2" />
                {t('common.enforceCookieProtection', 'Enforce Cookie Protection')}
              </Button>
              {/* Regulation selector */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-border text-sm font-semibold">
                {(['gdpr', 'pdpa', 'both'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRegulation(r)}
                    className={cn(
                      'flex-1 py-2 transition-colors capitalize',
                      regulation === r
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white dark:bg-background text-gray-500 dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-muted'
                    )}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>

              <Button
                size="lg"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl h-[48px] px-6 text-[15px] font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30"
                onClick={handleCheckCompliance}
              >
                <FileSearch className="w-4 h-4 mr-2" />
                {t('common.scan', 'Check Compliance')}
              </Button>
              <Button
                size="lg"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl h-[48px] px-6 text-[15px] font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30"
                onClick={openTrackerMap}
              >
                <Network className="w-4 h-4 mr-2" />
                View Tracker Map
              </Button>
            </div>
          </div>
        )}

        {/* ── COOKIE SCAN: SCANNING ── */}
        {activeView === 'cookie' && isScanning && (
          <div className="flex-1 flex flex-col justify-center items-center space-y-6 animate-in slide-in-from-bottom-5 duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
              <Scan className="w-20 h-20 text-emerald-500 animate-pulse relative z-10" />
            </div>
            <ScanProgress />
          </div>
        )}

        {/* ── COOKIE SCAN: RESULTS ── */}
        {activeView === 'cookie' && !isScanning && scanResults && (
          <div className="flex-1 flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-muted p-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                {isCompliant ? (
                  <div className="w-11 h-11 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                ) : (
                  <div className="w-11 h-11 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                )}
                <div>
                  <h3 className={cn('font-semibold text-sm', isCompliant ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
                    {isCompliant ? 'All cookies allowed' : 'Blocking active'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{scanResults.summary.blocked} cookies blocked</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-gray-800 dark:text-foreground">{totalCookies}</span>
                <span className="text-xs text-gray-500 dark:text-muted-foreground block">Total</span>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground">Cookie Categories</h4>
                <Badge variant="outline" className="text-xs font-normal rounded-lg border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground">
                  {scanResults.summary.blocked} Blocked
                </Badge>
              </div>
              <ScrollArea className="flex-1 pr-3 -mr-3">
                <div className="space-y-2.5 pb-2">
                  {categoryData.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-muted rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg bg-${cat.color}-100 dark:bg-${cat.color}-500/20 flex items-center justify-center`}>
                          <cat.icon className={`w-4 h-4 text-${cat.color}-600 dark:text-${cat.color}-400`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-foreground">{cat.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-sm rounded-lg">{cat.count}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Button
              className="w-full mt-auto bg-[#1e2d3d] hover:bg-[#263a4d] text-white rounded-xl h-[44px] font-semibold text-sm transition-all duration-200 shadow-md"
              onClick={openSidePanel}
            >
              {t('popup.viewReport', 'View Details')}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ── ALL COMPLIANCE VIEWS share a wrapper with a top-right X button ── */}
        {activeView === 'compliance' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Close / back button — always visible */}
            <div className="flex justify-end flex-shrink-0 mb-2">
              <button
                onClick={() => setActiveView('initial')}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-muted hover:bg-gray-200 dark:hover:bg-muted/80 text-gray-500 dark:text-muted-foreground transition-colors"
                aria-label="Back to main"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* SCANNING */}
            {isComplianceScanning && (
              <div className="flex-1 flex flex-col justify-center items-center space-y-6 animate-in slide-in-from-bottom-5 duration-500">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                  <FileSearch className="w-20 h-20 text-emerald-500 animate-pulse relative z-10" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-gray-700 dark:text-foreground">Checking compliance…</p>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">Fetching &amp; analysing privacy policy</p>
                </div>
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              </div>
            )}

            {/* ERROR */}
            {isComplianceError && (
              <div className="flex-1 flex flex-col justify-center items-center gap-4 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Compliance check failed</p>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground px-4 break-words">{complianceError}</p>
                </div>
              </div>
            )}

            {/* RESULTS */}
            {isComplianceDone && ragResult && (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                {/* Header row */}
                <div className="flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground">Compliance Categories</h4>
                    <Badge variant="secondary" className="text-xs rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                      {ragResult.regulation?.toUpperCase() ?? complianceState?.regulation?.toUpperCase()}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs font-normal rounded-lg border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground">
                    {ragResult.categories.filter(c => c.severity !== 'COMPLIANT').length} issues
                  </Badge>
                </div>

                {/* Scrollable list */}
                <ScrollArea className="flex-1 min-h-0 pr-2 -mr-2">
                  <div className="space-y-2 pb-2">
                    {ragResult.categories.map((cat) => (
                      <CategoryRow key={cat.id} cat={cat} />
                    ))}
                  </div>
                </ScrollArea>

              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default Popup;
