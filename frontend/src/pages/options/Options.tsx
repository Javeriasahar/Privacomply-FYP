import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Cookie, Shield, Database, Save, RotateCcw, Moon, Sun, FileSearch, ExternalLink, Trash2, Clock, Loader2, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import { PrivacyPolicyScanner } from '@/components/privacy-policy/PrivacyPolicyScanner';
import { TrackerMap } from '@/components/trackers/TrackerMap';
import type { RagComplianceResult } from '@/store/privacyPolicyScanStore';

// ── Scan history types ────────────────────────────────────────────────────────
interface HistoryEntry {
  url: string;
  regulation: string;
  result: RagComplianceResult;
  timestamp: number;
}

// ── Scan History List component ───────────────────────────────────────────────
const ScanHistoryList = ({ onViewReport }: { onViewReport: (entry: HistoryEntry) => void }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    chrome.storage.local.get(['compliance_history'], (data) => {
      const raw = data['compliance_history'];
      setHistory(Array.isArray(raw) ? (raw as HistoryEntry[]) : []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();

    if (typeof chrome === 'undefined' || !chrome.storage) return;

    // Filter by area='local' so sync/session changes don't trigger a spurious update
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'local') return;
      if ('compliance_history' in changes) {
        const raw = changes['compliance_history'].newValue;
        setHistory(Array.isArray(raw) ? (raw as HistoryEntry[]) : []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const clearHistory = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'CLEAR_COMPLIANCE_HISTORY' }, () => {
        setHistory([]);
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-xs text-gray-400 dark:text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Clock className="w-12 h-12 text-gray-300 dark:text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-foreground">No scans yet</p>
          <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">
            Compliance checks from the popup will appear here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="mt-2">
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-muted-foreground">{history.length} scan{history.length !== 1 ? 's' : ''} stored</p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            className="h-8 px-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 h-8 px-3"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Clear All
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[480px] pr-2">
        <div className="space-y-2 pb-2">
          {history.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-white dark:bg-secondary rounded-xl border border-gray-200 dark:border-border hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-colors"
            >
              {/* URL + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate" title={entry.url}>
                  {entry.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400 dark:text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span className="text-gray-300 dark:text-border">·</span>
                  <span className="text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                    {entry.regulation}
                  </span>
                </div>
              </div>

              {/* View report button */}
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0 h-8 px-3 bg-white dark:bg-secondary border-gray-200 dark:border-border hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                onClick={() => onViewReport(entry)}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                View Report
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

const Options = () => {
    const { t, i18n } = useTranslation();
    const settings = useSettingsStore();
    const [activeTab, setActiveTab] = useState('general');

    // If opened from the popup's "View Detailed Report" button, jump straight
    // to the privacy scanner tab and clear the flag.
    // Uses both a mount read (fresh open) and an onChanged listener (page already open).
    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.storage) return;

        const applyActiveTab = (tab: string) => {
            setActiveTab(tab);
            chrome.storage.local.remove('options_active_tab');
        };

        // Handle case where options page is freshly opened
        chrome.storage.local.get('options_active_tab', (data) => {
            if (data['options_active_tab']) {
                applyActiveTab(data['options_active_tab'] as string);
            }
        });

        // Handle case where options page is already open when popup sets the flag
        const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area !== 'local') return;
            if ('options_active_tab' in changes && changes['options_active_tab'].newValue) {
                applyActiveTab(changes['options_active_tab'].newValue as string);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    // Load a history entry into the compliance_check slot and navigate to the scanner tab
    const handleViewHistoryReport = (entry: HistoryEntry) => {
        if (typeof chrome === 'undefined' || !chrome.storage) return;
        chrome.storage.local.set({
            compliance_check: {
                status: 'complete',
                url: entry.url,
                regulation: entry.regulation,
                result: entry.result,
                timestamp: entry.timestamp,
            },
        }, () => {
            setActiveTab('privacyScanner');
        });
    };

    // Apply theme to document
    useTheme();

    const handleSave = () => {
        // Settings are persisted automatically by Zustand middleware,
        // but we can show a toast or visual feedback here.
        const btn = document.getElementById('save-btn');
        if (btn) {
            btn.innerHTML = 'Saved';
            setTimeout(() => btn.innerHTML = t('common.save'), 2000);
        }
    };

    const handleLanguageChange = (val: string) => {
        settings.setLanguage(val as any);
        i18n.changeLanguage(val);
        document.documentElement.dir = val === 'ur' ? 'rtl' : 'ltr';
    };

    const tabs = [
        { id: 'general', label: t('options.general.title'), icon: Settings },
        { id: 'cookies', label: t('options.cookies.title'), icon: Cookie },
        { id: 'privacyScanner', label: t('options.privacyScanner.title'), icon: FileSearch },
        { id: 'standards', label: t('options.standards.title'), icon: Shield },
        { id: 'data', label: t('options.data.title'), icon: Database },
        { id: 'trackers', label: 'Tracker Map', icon: Network },
    ];

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-background flex flex-col font-sans transition-colors duration-200">
            <header className="bg-[#1e2d3d] sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500 p-2.5 rounded-xl">
                        <Shield className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Privacomply</h1>
                        <span className="text-xs text-gray-400">{t('options.title')}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => settings.setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
                        className="h-10 w-10 rounded-xl bg-gray-700/50 text-gray-300 hover:bg-gray-600 hover:text-white"
                        aria-label="Toggle dark mode"
                    >
                        {settings.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </Button>
                     <Button variant="outline" onClick={settings.resetSettings} className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                     </Button>
                    <Button onClick={handleSave} id="save-btn" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        {t('common.save')}
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex max-w-6xl mx-auto w-full p-8 gap-8">
                {/* Sidebar */}
                <aside className="w-56 flex-shrink-0">
                    <nav className="space-y-1.5 bg-white dark:bg-card rounded-xl p-3 shadow-sm border border-gray-200 dark:border-border">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200",
                                        activeTab === tab.id
                                            ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-l-4 border-emerald-500"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-muted hover:text-gray-900 dark:hover:text-gray-200"
                                    )}
                                >
                                    <Icon className={cn("w-5 h-5", activeTab === tab.id ? "text-emerald-600 dark:text-emerald-400" : "")} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Content */}
                <main className="flex-1">
                    {/* General Settings */}
                    {activeTab === 'general' && (
                        <Card className="shadow-sm border border-gray-200 dark:border-border dark:bg-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">{t('options.general.title')}</CardTitle>
                                <CardDescription>Manage basic application preferences.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-muted rounded-xl">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-medium">{t('common.language')}</Label>
                                        <p className="text-xs text-gray-500 dark:text-muted-foreground">Select your preferred language</p>
                                    </div>
                                    <Select value={settings.language} onValueChange={handleLanguageChange}>
                                        <SelectTrigger className="w-[200px] bg-white dark:bg-secondary dark:border-border">
                                            <SelectValue placeholder="Select Language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en">English (English)</SelectItem>
                                            <SelectItem value="ur">Urdu (اردو)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-muted rounded-xl">
                                    <Label className="text-sm font-medium mb-3 block">{t('common.theme')}</Label>
                                    <RadioGroup
                                        defaultValue={settings.theme}
                                        onValueChange={(val: any) => settings.setTheme(val)}
                                        className="flex gap-3"
                                    >
                                        <label htmlFor="theme-light" className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors flex-1">
                                            <RadioGroupItem value="light" id="theme-light" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground">Light</span>
                                        </label>
                                        <label htmlFor="theme-dark" className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors flex-1">
                                            <RadioGroupItem value="dark" id="theme-dark" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground">Dark</span>
                                        </label>
                                        <label htmlFor="theme-system" className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors flex-1">
                                            <RadioGroupItem value="system" id="theme-system" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground">System</span>
                                        </label>
                                    </RadioGroup>
                                </div>

                            </CardContent>
                        </Card>
                    )}

                    {/* Cookie Consent */}
                    {activeTab === 'cookies' && (
                         <Card className="shadow-sm border border-gray-200 dark:border-border dark:bg-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">{t('options.cookies.title')}</CardTitle>
                                <CardDescription>Automated cookie consent handling.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-4 bg-gray-50 dark:bg-muted rounded-xl">
                                    <RadioGroup
                                        value={settings.cookieConsent}
                                        onValueChange={(val: any) => settings.updateSettings({ cookieConsent: val })}
                                        className="space-y-3"
                                    >
                                        <label htmlFor="cookie-ask" className="flex items-center gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                            <RadioGroupItem value="ask" id="cookie-ask" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground">Ask each time (Default)</span>
                                        </label>
                                        <label htmlFor="cookie-reject" className="flex items-center gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                            <RadioGroupItem value="reject-all" id="cookie-reject" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground">Reject All</span>
                                        </label>
                                        <label htmlFor="cookie-accept" className="flex items-center gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                            <RadioGroupItem value="accept-all" id="cookie-accept" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground">Accept All</span>
                                        </label>
                                        <label htmlFor="cookie-custom" className="flex items-center gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                            <RadioGroupItem value="custom" id="cookie-custom" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground">Custom Strategy</span>
                                        </label>
                                    </RadioGroup>
                                </div>

                                {settings.cookieConsent === 'custom' && (
                                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                                        <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-4">Custom Cookie Preferences</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border">
                                                <Checkbox
                                                    id="cookie-necessary"
                                                    checked={settings.customCookiePreferences.strictlyNecessary}
                                                    disabled
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1">
                                                    <Label htmlFor="cookie-necessary" className="text-sm font-medium text-gray-700 dark:text-foreground">
                                                        {t('options.cookies.types.necessary.title')}
                                                    </Label>
                                                    <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                                                        {t('options.cookies.types.necessary.description')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                                <Checkbox
                                                    id="cookie-functionality"
                                                    checked={settings.customCookiePreferences.functionality}
                                                    onCheckedChange={(checked) => settings.updateSettings({
                                                        customCookiePreferences: {
                                                            ...settings.customCookiePreferences,
                                                            functionality: checked as boolean
                                                        }
                                                    })}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1">
                                                    <Label htmlFor="cookie-functionality" className="text-sm font-medium text-gray-700 dark:text-foreground">
                                                        {t('options.cookies.types.functionality.title')}
                                                    </Label>
                                                    <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                                                        {t('options.cookies.types.functionality.description')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                                <Checkbox
                                                    id="cookie-analytics"
                                                    checked={settings.customCookiePreferences.analytics}
                                                    onCheckedChange={(checked) => settings.updateSettings({
                                                        customCookiePreferences: {
                                                            ...settings.customCookiePreferences,
                                                            analytics: checked as boolean
                                                        }
                                                    })}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1">
                                                    <Label htmlFor="cookie-analytics" className="text-sm font-medium text-gray-700 dark:text-foreground">
                                                        {t('options.cookies.types.analytics.title')}
                                                    </Label>
                                                    <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                                                        {t('options.cookies.types.analytics.description')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                                <Checkbox
                                                    id="cookie-advertising"
                                                    checked={settings.customCookiePreferences.advertising}
                                                    onCheckedChange={(checked) => settings.updateSettings({
                                                        customCookiePreferences: {
                                                            ...settings.customCookiePreferences,
                                                            advertising: checked as boolean
                                                        }
                                                    })}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1">
                                                    <Label htmlFor="cookie-advertising" className="text-sm font-medium text-gray-700 dark:text-foreground">
                                                        {t('options.cookies.types.advertising.title')}
                                                    </Label>
                                                    <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                                                        {t('options.cookies.types.advertising.description')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Privacy Policy Compliance */}
                    {activeTab === 'privacyScanner' && (
                        <Card className="shadow-sm border border-gray-200 dark:border-border dark:bg-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">{t('options.privacyScanner.title')}</CardTitle>
                                <CardDescription>Analyze websites for GDPR and PDPA privacy policy compliance.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <PrivacyPolicyScanner />
                            </CardContent>
                        </Card>
                    )}

                     {/* Standards */}
                    {activeTab === 'standards' && (
                         <Card className="shadow-sm border border-gray-200 dark:border-border dark:bg-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">{t('options.standards.title')}</CardTitle>
                                <CardDescription>Select which regulations to check against.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="p-4 bg-gray-50 dark:bg-muted rounded-xl space-y-3">
                                    <label htmlFor="std-gdpr" className="flex items-center gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                        <Checkbox
                                            id="std-gdpr"
                                            checked={settings.complianceStandards.includes('gdpr')}
                                            onCheckedChange={(checked) => {
                                                 let newStds = [...settings.complianceStandards];
                                                 if (checked) newStds.push('gdpr');
                                                 else newStds = newStds.filter(s => s !== 'gdpr');
                                                 settings.updateSettings({ complianceStandards: newStds });
                                            }}
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground block">GDPR</span>
                                            <span className="text-xs text-gray-500 dark:text-muted-foreground">European Union General Data Protection Regulation</span>
                                        </div>
                                    </label>
                                    <label htmlFor="std-pdpa" className="flex items-center gap-3 p-3 bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-border cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                        <Checkbox
                                            id="std-pdpa"
                                            checked={settings.complianceStandards.includes('pdpa')}
                                             onCheckedChange={(checked) => {
                                                 let newStds = [...settings.complianceStandards];
                                                 if (checked) newStds.push('pdpa');
                                                 else newStds = newStds.filter(s => s !== 'pdpa');
                                                 settings.updateSettings({ complianceStandards: newStds });
                                            }}
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-gray-700 dark:text-foreground block">PDPA</span>
                                            <span className="text-xs text-gray-500 dark:text-muted-foreground">Pakistan Personal Data Protection Act</span>
                                        </div>
                                    </label>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Data & Privacy — Scan History */}
                    {activeTab === 'data' && (
                        <Card className="shadow-sm border border-gray-200 dark:border-border dark:bg-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">{t('options.data.title')}</CardTitle>
                                <CardDescription>
                                    All compliance scans are stored locally. Click <strong>View Report</strong> to open the full analysis.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScanHistoryList onViewReport={handleViewHistoryReport} />
                            </CardContent>
                        </Card>
                    )}

                    {/* Tracker Map */}
                    {activeTab === 'trackers' && (
                        <Card className="shadow-sm border border-gray-200 dark:border-border dark:bg-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Network className="w-5 h-5 text-emerald-500" />
                                    Tracker Map
                                </CardTitle>
                                <CardDescription>
                                    Visual map of all third-party trackers, ad networks, and CDNs the current site connects to. Browse the site, then refresh.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <TrackerMap />
                            </CardContent>
                        </Card>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Options;
