import React from 'react';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import { useScanStore } from '@/store/scanStore';

export const ScanProgress: React.FC = () => {
  const { t } = useTranslation();
  const { scanProgress, scanStep, cancelScan } = useScanStore();

  return (
    <div className="w-full space-y-4 p-5 rounded-xl bg-gray-50 dark:bg-muted max-w-[280px]">
      <div className="flex justify-between items-center text-sm font-medium">
        <span className="text-gray-700 dark:text-foreground">{scanStep}</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{scanProgress}%</span>
      </div>

      <Progress value={scanProgress} className="h-2 bg-gray-200 dark:bg-secondary" />

      <div className="flex justify-center mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={cancelScan}
            className="text-gray-500 dark:text-muted-foreground hover:text-red-500 dark:hover:text-red-400 text-xs rounded-lg"
          >
            <XCircle className="w-3 h-3 mr-2" />
            {t('common.cancel')}
          </Button>
      </div>
    </div>
  );
};
