import zh from './zh';
import en from './en';

const translations = { zh, en };

export function t(lang: 'zh' | 'en', key: string): string {
  const dict = translations[lang] as Record<string, string>;
  return dict[key] || key;
}
