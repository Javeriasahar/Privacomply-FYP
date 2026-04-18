import React from 'react';
import { Cookie, Shield, BarChart3, Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

export interface BlockedCookieInfo {
  name: string;
  domain: string;
  category: 'necessary' | 'functional' | 'analytics' | 'advertising';
  blocked: boolean;
}

interface CookieCardProps {
  cookie: BlockedCookieInfo;
}

export const ViolationCard: React.FC<CookieCardProps> = ({ cookie }) => {

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'necessary': return <Shield className="w-4 h-4 text-emerald-500" />;
      case 'functional': return <Cookie className="w-4 h-4 text-blue-500" />;
      case 'analytics': return <BarChart3 className="w-4 h-4 text-amber-500" />;
      case 'advertising': return <Megaphone className="w-4 h-4 text-red-500" />;
      default: return <Cookie className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'necessary': return 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200';
      case 'functional': return 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200';
      case 'analytics': return 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200';
      case 'advertising': return 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200';
      default: return 'bg-gray-50 dark:bg-muted text-gray-700 dark:text-muted-foreground border-gray-200';
    }
  };

  return (
    <Card className="transition-all duration-200 rounded-xl border-gray-100 dark:border-border dark:bg-card shadow-sm hover:shadow-md">
      <CardContent className="p-3.5">
        <div className="flex items-start">
          <div className="mr-3 mt-0.5 p-1.5 rounded-lg bg-gray-50 dark:bg-muted">
            {getCategoryIcon(cookie.category)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-gray-800 dark:text-foreground truncate">
              {cookie.name}
            </h4>
            <p className="text-xs text-gray-500 dark:text-muted-foreground truncate mt-0.5">
              {cookie.domain}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge 
                variant="outline" 
                className={cn("text-[10px] px-2 h-5 rounded-md font-medium border", getCategoryBadgeClass(cookie.category))}
              >
                {cookie.category}
              </Badge>
              {cookie.blocked && (
                <Badge variant="destructive" className="text-[10px] px-2 h-5 rounded-md">
                  Blocked
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ViolationCard;
