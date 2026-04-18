import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/store/settingsStore';

export const LanguageToggle: React.FC = () => {
  const { i18n } = useTranslation();
  const { setLanguage } = useSettingsStore();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ur' : 'en';
    i18n.changeLanguage(newLang);
    setLanguage(newLang);
    
    // Update HTML dir attribute
    document.documentElement.dir = newLang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="font-semibold text-xs px-2.5 h-8 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg"
      aria-label="Toggle Language"
    >
      {i18n.language === 'en' ? 'EN' : 'UR'}
    </Button>
  );
};
