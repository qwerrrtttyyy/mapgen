import { describe, it } from 'node:test';
import assert from 'node:assert';
import { I18n } from '../../public/js/i18n.js';

describe('I18n', () => {
  describe('constructor()', () => {
    it('should create i18n instance', () => {
      const i18n = new I18n();
      
      assert.ok(i18n);
      assert.strictEqual(i18n.locale, 'en');
    });

    it('should create with custom locale', () => {
      const i18n = new I18n({ locale: 'zh-CN' });
      
      assert.strictEqual(i18n.locale, 'zh-CN');
    });
  });

  describe('setLocale()', () => {
    it('should change locale', () => {
      const i18n = new I18n();
      
      i18n.setLocale('zh-CN');
      
      assert.strictEqual(i18n.locale, 'zh-CN');
    });
  });

  describe('t()', () => {
    it('should translate key', () => {
      const i18n = new I18n({
        translations: {
          en: { hello: 'Hello' },
          zh: { hello: '你好' },
        },
      });
      
      assert.strictEqual(i18n.t('hello'), 'Hello');
      
      i18n.setLocale('zh');
      assert.strictEqual(i18n.t('hello'), '你好');
    });

    it('should return key if translation not found', () => {
      const i18n = new I18n();
      
      assert.strictEqual(i18n.t('missing'), 'missing');
    });

    it('should support default value', () => {
      const i18n = new I18n();
      
      assert.strictEqual(i18n.t('missing', 'Default'), 'Default');
    });

    it('should support interpolation', () => {
      const i18n = new I18n({
        translations: {
          en: { greeting: 'Hello, {{name}}!' },
        },
      });
      
      assert.strictEqual(i18n.t('greeting', { name: 'World' }), 'Hello, World!');
    });
  });

  describe('addTranslations()', () => {
    it('should add translations', () => {
      const i18n = new I18n();
      
      i18n.addTranslations('en', { test: 'Test' });
      
      assert.strictEqual(i18n.t('test'), 'Test');
    });

    it('should merge with existing translations', () => {
      const i18n = new I18n({
        translations: {
          en: { existing: 'Existing' },
        },
      });
      
      i18n.addTranslations('en', { new: 'New' });
      
      assert.strictEqual(i18n.t('existing'), 'Existing');
      assert.strictEqual(i18n.t('new'), 'New');
    });
  });

  describe('getSupportedLocales()', () => {
    it('should return supported locales', () => {
      const i18n = new I18n({
        translations: {
          en: {},
          zh: {},
        },
      });
      
      const locales = i18n.getSupportedLocales();
      
      assert.ok(Array.isArray(locales));
      assert.ok(locales.includes('en'));
      assert.ok(locales.includes('zh'));
    });
  });
});
