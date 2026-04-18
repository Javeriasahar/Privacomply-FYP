import { useTranslation } from 'react-i18next';
import { Download, Shield, Cookie, BarChart3, Megaphone, ShieldCheck, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useScanStore } from '@/store/scanStore';
import { TrackerMap } from '@/components/trackers/TrackerMap';

const SidePanel = () => {
    const { t } = useTranslation();
    const { scanResults } = useScanStore();

    // Fallback if no results found
    if (!scanResults) {
        return (
            <div className="flex flex-col h-screen bg-gray-50 dark:bg-background">
               <Header />
               <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
                   <div className="space-y-4">
                       <ShieldCheck className="w-16 h-16 mx-auto text-emerald-500 opacity-50" />
                       <p>CookieBlock ML is actively protecting your privacy.</p>
                       <p className="text-sm">Run a scan from the popup to see cookie statistics.</p>
                   </div>
               </div>
            </div>
        );
    }

    const results = scanResults;
    const { summary } = results;

    const categoryData = [
        { name: 'Necessary', count: summary.necessary, icon: Shield, color: 'emerald', description: 'Required for website to function' },
        { name: 'Functional', count: summary.functional, icon: Cookie, color: 'blue', description: 'Enhance user experience' },
        { name: 'Analytics', count: summary.analytics, icon: BarChart3, color: 'amber', description: 'Track usage statistics' },
        { name: 'Advertising', count: summary.advertising, icon: Megaphone, color: 'red', description: 'Personalized ads & tracking' },
    ];

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-background font-sans">
            <Header url={results.url} />
            
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="p-4 bg-white dark:bg-card border-b dark:border-border shadow-sm z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold dark:text-foreground">{t('sidepanel.title', 'Cookie Report')}</h2>
                        <p className="text-xs text-muted-foreground">{new Date(results.timestamp).toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Total Cookies</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <div className="text-3xl font-bold text-emerald-800 dark:text-emerald-200">{summary.total}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Blocked</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <div className="text-3xl font-bold text-red-800 dark:text-red-200">{summary.blocked}</div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Tabs defaultValue="categories" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="categories">Cookies</TabsTrigger>
                                    <TabsTrigger value="trackers" className="flex items-center gap-1">
                                        <Network className="w-3 h-3" />Trackers
                                    </TabsTrigger>
                                    <TabsTrigger value="preferences">Prefs</TabsTrigger>
                                </TabsList>
                                
                                {/* Categories Tab */}
                                <TabsContent value="categories" className="space-y-4 mt-4">
                                    {categoryData.map((cat) => (
                                        <Card key={cat.name} className="dark:bg-card">
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl bg-${cat.color}-100 dark:bg-${cat.color}-900/30`}>
                                                        <cat.icon className={`w-6 h-6 text-${cat.color}-600 dark:text-${cat.color}-400`} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="font-semibold dark:text-foreground">{cat.name}</h3>
                                                            <Badge variant="secondary" className="text-lg px-3">
                                                                {cat.count}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </TabsContent>

                                {/* Trackers Tab */}
                                <TabsContent value="trackers" className="mt-4">
                                    <TrackerMap />
                                </TabsContent>

                                {/* Preferences Tab */}
                                <TabsContent value="preferences" className="space-y-4 mt-4">
                                    <Card className="dark:bg-card">
                                        <CardHeader>
                                            <CardTitle className="text-base">Your Cookie Preferences</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex justify-between items-center py-2 border-b dark:border-border">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-sm">Necessary</span>
                                                </div>
                                                <Badge variant="default" className="bg-emerald-500">Always On</Badge>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b dark:border-border">
                                                <div className="flex items-center gap-2">
                                                    <Cookie className="w-4 h-4 text-blue-500" />
                                                    <span className="text-sm">Functional</span>
                                                </div>
                                                <Badge variant="outline">Check Settings</Badge>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b dark:border-border">
                                                <div className="flex items-center gap-2">
                                                    <BarChart3 className="w-4 h-4 text-amber-500" />
                                                    <span className="text-sm">Analytics</span>
                                                </div>
                                                <Badge variant="outline">Check Settings</Badge>
                                            </div>
                                            <div className="flex justify-between items-center py-2">
                                                <div className="flex items-center gap-2">
                                                    <Megaphone className="w-4 h-4 text-red-500" />
                                                    <span className="text-sm">Advertising</span>
                                                </div>
                                                <Badge variant="outline">Check Settings</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                                        <CardContent className="p-4">
                                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                                CookieBlock uses machine learning to classify cookies automatically. 
                                                Configure your preferences in the extension popup or options page.
                                            </p>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
};

export default SidePanel;
