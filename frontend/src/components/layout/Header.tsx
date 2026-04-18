import React from 'react';
import { Settings, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from './LanguageToggle';

interface HeaderProps {
  url?: string;
  onSettingsClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ url, onSettingsClick }) => {
  const { t } = useTranslation();

  return (
    <header className="bg-[#1e2d3d] text-white px-4 py-3 rounded-t-xl">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-base font-semibold tracking-tight">{t('popup.header')}</h1>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-300 hover:text-white hover:bg-white/10 h-8 w-8 rounded-lg"
            onClick={onSettingsClick}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {url && (
        <div className="mt-3 text-xs text-gray-300 truncate max-w-full bg-[#162029] px-3 py-2 rounded-lg flex items-center">
          <span className="text-gray-500 mr-2 font-medium">URL:</span>
          <span className="font-mono text-emerald-400">{url}</span>
        </div>
      )}
    </header>
  );
};
