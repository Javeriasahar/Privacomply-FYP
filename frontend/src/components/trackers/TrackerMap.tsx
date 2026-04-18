import { useEffect, useRef } from 'react';
import { useTrackerStore } from '@/store/trackerStore';
import type { TrackerEntry } from '@/store/trackerStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Globe, Megaphone, BarChart3, Users, Zap, Mail, HelpCircle } from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { color: string; darkColor: string; icon: typeof Globe; label: string }> = {
  Advertising: { color: '#ef4444', darkColor: '#fca5a5', icon: Megaphone, label: 'Advertising' },
  Analytics:   { color: '#f59e0b', darkColor: '#fcd34d', icon: BarChart3, label: 'Analytics' },
  Social:      { color: '#3b82f6', darkColor: '#93c5fd', icon: Users,     label: 'Social' },
  CDN:         { color: '#10b981', darkColor: '#6ee7b7', icon: Zap,       label: 'CDN' },
  Email:       { color: '#8b5cf6', darkColor: '#c4b5fd', icon: Mail,      label: 'Email' },
  Unknown:     { color: '#6b7280', darkColor: '#d1d5db', icon: HelpCircle, label: 'Unknown' },
};

const getCategoryConfig = (cat: string) => CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['Unknown'];

interface Node {
  id: string;
  label: string;
  category: string;
  x: number;
  y: number;
  r: number;
  requestCount: number;
}

function buildRadialLayout(trackers: TrackerEntry[], cx: number, cy: number): Node[] {
  if (trackers.length === 0) return [];

  const grouped: Record<string, TrackerEntry[]> = {};
  trackers.forEach(t => {
    const cat = t.category || 'Unknown';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });

  const nodes: Node[] = [];
  const categories = Object.keys(grouped);
  const categoryAngleStep = (2 * Math.PI) / categories.length;

  categories.forEach((cat, catIdx) => {
    const catAngle = catIdx * categoryAngleStep - Math.PI / 2;
    const items = grouped[cat];
    const innerRadius = 80;
    const outerRadius = 160;

    items.forEach((tracker, itemIdx) => {
      const spread = (items.length > 1)
        ? ((itemIdx / (items.length - 1)) - 0.5) * (categoryAngleStep * 0.8)
        : 0;
      const angle = catAngle + spread;
      const radius = items.length === 1 ? innerRadius + 40 : innerRadius + (itemIdx % 2) * (outerRadius - innerRadius) / 2;

      nodes.push({
        id: tracker.domain,
        label: tracker.domain.length > 18 ? tracker.domain.slice(0, 16) + '…' : tracker.domain,
        category: cat,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        r: Math.min(6 + tracker.requestCount * 1.5, 14),
        requestCount: tracker.requestCount,
      });
    });
  });

  return nodes;
}

export function TrackerMap() {
  const { trackerData, isLoading, loadTrackers } = useTrackerStore();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadTrackers();
  }, []);

  const W = 340;
  const H = 340;
  const cx = W / 2;
  const cy = H / 2;

  const trackers = trackerData?.trackers ?? [];
  const nodes = buildRadialLayout(trackers, cx, cy);
  const summary = trackerData?.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold dark:text-foreground">Third-Party Tracker Map</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadTrackers} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary badges */}
      {summary && summary.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
            const count = summary[cat.toLowerCase() as keyof typeof summary] as number;
            if (!count) return null;
            return (
              <Badge key={cat} variant="secondary" className="text-xs gap-1" style={{ borderColor: cfg.color, color: cfg.color }}>
                <cfg.icon className="w-3 h-3" />
                {cfg.label} {count}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Graph */}
      <Card className="dark:bg-card overflow-hidden">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-[340px] text-muted-foreground text-sm">
              Loading trackers...
            </div>
          ) : trackers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[340px] text-center gap-3">
              <Globe className="w-12 h-12 text-emerald-500 opacity-40" />
              <p className="text-sm text-muted-foreground">No known trackers detected on this page.</p>
              <p className="text-xs text-muted-foreground">Browse the site for a bit, then refresh.</p>
            </div>
          ) : (
            <svg ref={svgRef} width={W} height={H} className="mx-auto">
              {/* Center node */}
              <circle cx={cx} cy={cy} r={22} fill="#10b981" opacity={0.15} />
              <circle cx={cx} cy={cy} r={14} fill="#10b981" opacity={0.8} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={7} fill="white" fontWeight="bold">SITE</text>

              {/* Edges */}
              {nodes.map(node => {
                const cfg = getCategoryConfig(node.category);
                return (
                  <line
                    key={`edge-${node.id}`}
                    x1={cx} y1={cy}
                    x2={node.x} y2={node.y}
                    stroke={cfg.color}
                    strokeWidth={Math.min(1 + node.requestCount * 0.3, 3)}
                    opacity={0.35}
                  />
                );
              })}

              {/* Tracker nodes */}
              {nodes.map(node => {
                const cfg = getCategoryConfig(node.category);
                return (
                  <g key={node.id}>
                    <title>{node.id} ({node.category}) — {node.requestCount} request{node.requestCount !== 1 ? 's' : ''}</title>
                    <circle
                      cx={node.x} cy={node.y} r={node.r + 4}
                      fill={cfg.color} opacity={0.12}
                    />
                    <circle
                      cx={node.x} cy={node.y} r={node.r}
                      fill={cfg.color} opacity={0.85}
                    />
                    <text
                      x={node.x} y={node.y + node.r + 9}
                      textAnchor="middle"
                      fontSize={6.5}
                      fill="currentColor"
                      className="fill-gray-600 dark:fill-gray-300"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-1">
        {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Tracker list */}
      {trackers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detected ({trackers.length})</p>
          {trackers.map(t => {
            const cfg = getCategoryConfig(t.category);
            return (
              <div key={t.domain} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50 dark:bg-muted text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <span className="truncate text-xs font-mono dark:text-foreground">{t.domain}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <Badge variant="outline" className="text-xs px-1.5 py-0" style={{ borderColor: cfg.color, color: cfg.color }}>
                    {t.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{t.requestCount}×</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
