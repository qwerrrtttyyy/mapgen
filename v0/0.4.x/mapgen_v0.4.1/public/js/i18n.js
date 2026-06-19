export class I18n {
  constructor(options = {}) {
    this.locale = options.locale || 'en';
    this.translations = options.translations || {};
    this.fallbackLocale = options.fallbackLocale || 'en';
  }

  setLocale(locale) {
    this.locale = locale;
  }

  t(key, params = {}) {
    const translation = this._getTranslation(key);
    if (translation === null) {
      return typeof params === 'string' ? params : key;
    }
    
    return this._interpolate(translation, params);
  }

  addTranslations(locale, translations) {
    if (!this.translations[locale]) {
      this.translations[locale] = {};
    }
    
    this.translations[locale] = {
      ...this.translations[locale],
      ...translations,
    };
  }

  getSupportedLocales() {
    return Object.keys(this.translations);
  }

  _getTranslation(key) {
    // 尝试当前语言
    if (this.translations[this.locale] && this.translations[this.locale][key]) {
      return this.translations[this.locale][key];
    }
    
    // 尝试回退语言
    if (this.translations[this.fallbackLocale] && this.translations[this.fallbackLocale][key]) {
      return this.translations[this.fallbackLocale][key];
    }
    
    return null;
  }

  _interpolate(template, params) {
    if (typeof template !== 'string') {
      return template;
    }
    
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }
}

// 预定义语言包
export const LOCALES = {
  EN: 'en',
  ZH: 'zh',
  JA: 'ja',
  KO: 'ko',
};

// 默认翻译
export const DEFAULT_TRANSLATIONS = {
  en: {
    generate: 'Generate',
    export: 'Export',
    import: 'Import',
    settings: 'Settings',
    seed: 'Seed',
    width: 'Width',
    height: 'Height',
    generating: 'Generating...',
    complete: 'Complete',
    error: 'Error',
  },
  zh: {
    generate: '生成',
    export: '导出',
    import: '导入',
    settings: '设置',
    seed: '种子',
    width: '宽度',
    height: '高度',
    generating: '生成中...',
    complete: '完成',
    error: '错误',
  },
};
