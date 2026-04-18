import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface ComplianceScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export const ComplianceScore: React.FC<ComplianceScoreProps> = ({ score, size = 'md' }) => {
  const { t } = useTranslation();

  // Determine color based on score
  let colorClass = 'text-red-500 border-red-500';
  if (score >= 80) colorClass = 'text-green-500 border-green-500';
  else if (score >= 50) colorClass = 'text-yellow-500 border-yellow-500';

  const sizeClasses = {
    sm: 'w-16 h-16 text-xl border-4',
    md: 'w-24 h-24 text-3xl border-8',
    lg: 'w-32 h-32 text-4xl border-8',
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div 
        className={cn(
          "rounded-full flex items-center justify-center font-bold",
          colorClass,
          sizeClasses[size]
        )}
      >
        {score}
      </div>
      <span className="mt-2 text-sm font-medium text-muted-foreground">
        {t('sidepanel.score')}
      </span>
    </div>
  );
};
