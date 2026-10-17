import { describe, it, expect } from 'vitest';
import {
  generatePlaywrightSimpleScript,
  generatePlaywrightEnterpriseScript,
  generatePlaywrightPytestScript,
} from '../src/generator/playwright-generator';
import { generateAutomationScript } from '../src/generator/python-generator';
import { createTestCase, createTestStep } from '../src/types/model';

describe('Playwright Python Code Generator', () => {
  describe('Simple Mode', () => {
    it('generates a clean synchronous script with sync_playwright', () => {
      const testCase = createTestCase('Basic Test', 'https://example.com');
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'type',
          target: {
            tagName: 'input',
            locators: [{ strategy: 'id', value: 'email', isUnique: true, matchCount: 1, score: 100 }],
            selectedLocatorIndex: 0,
          },
          value: 'user@example.com',
        }),
        createTestStep({
          stepNumber: 2,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [{ strategy: 'css', value: 'button.login', isUnique: true, matchCount: 1, score: 85 }],
            selectedLocatorIndex: 0,
          },
        })
      );

      const code = generatePlaywrightSimpleScript(testCase);

      expect(code).toContain('from playwright.sync_api import sync_playwright');
      expect(code).toContain('with sync_playwright() as p:');
      expect(code).toContain('browser = p.chromium.launch(headless=False)');
      expect(code).toContain('page = context.new_page()');
      expect(code).toContain('page.goto("https://example.com")');
      expect(code).toContain('page.locator("#email").fill("user@example.com")');
      expect(code).toContain('page.locator("button.login").click()');
      expect(code).toContain('browser.close()');
    });

    it('generates switch_tab and print_value steps accurately in simple mode', () => {
      const testCase = createTestCase('Tab & Print Test', 'https://example.com');
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'switch_tab',
          tabIndex: -1,
          tabTitle: 'Dashboard',
        }),
        createTestStep({
          stepNumber: 2,
          action: 'print_value',
          target: {
            tagName: 'span',
            locators: [{ strategy: 'css', value: '.account-id', isUnique: true, matchCount: 1, score: 90 }],
            selectedLocatorIndex: 0,
          },
          value: 'ACC-12345',
        })
      );

      const code = generatePlaywrightSimpleScript(testCase);

      expect(code).toContain('page = context.pages[-1]');
      expect(code).toContain('page.bring_to_front()');
      expect(code).toContain('page.locator(".account-id")');
      expect(code).toContain('input_value()');
      expect(code).toContain('inner_text()');
      expect(code).toContain('[EXTRACTED]');
    });
  });

  describe('Enterprise Mode', () => {
    it('generates robust architecture with trace recording and screenshot on failure', () => {
      const testCase = createTestCase('Enterprise Playwright Flow', 'https://example.com/app');
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [{ strategy: 'css', value: '#menu-btn', isUnique: true, matchCount: 1, score: 100 }],
            selectedLocatorIndex: 0,
          },
        }),
        createTestStep({
          stepNumber: 2,
          action: 'assert_text',
          target: {
            tagName: 'h1',
            locators: [{ strategy: 'css', value: 'h1', isUnique: true, matchCount: 1, score: 70 }],
            selectedLocatorIndex: 0,
          },
          assertExpected: 'Welcome Back',
        })
      );

      const code = generatePlaywrightEnterpriseScript(testCase);

      expect(code).toContain('from playwright.sync_api import sync_playwright, expect');
      expect(code).toContain('context.tracing.start(screenshots=True, snapshots=True, sources=True)');
      expect(code).toContain('expect(page.locator("h1")).to_contain_text("Welcome Back")');
      expect(code).toContain('page.screenshot(path=');
      expect(code).toContain('context.tracing.stop(path=str(artifact_dir / "trace.zip"))');
      expect(code).toContain('browser.close()');
    });
  });

  describe('Pytest Mode', () => {
    it('generates idiomatic pytest test function utilizing page fixture', () => {
      const testCase = createTestCase('Pytest Playwright Suite', 'https://example.com/login');
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'type',
          target: {
            tagName: 'input',
            locators: [{ strategy: 'id', value: 'user', isUnique: true, matchCount: 1, score: 100 }],
            selectedLocatorIndex: 0,
          },
          value: 'admin',
        }),
        createTestStep({
          stepNumber: 2,
          action: 'assert_visible',
          target: {
            tagName: 'div',
            locators: [{ strategy: 'css', value: '.dashboard', isUnique: true, matchCount: 1, score: 95 }],
            selectedLocatorIndex: 0,
          },
        })
      );

      const code = generatePlaywrightPytestScript(testCase);

      expect(code).toContain('import pytest');
      expect(code).toContain('from playwright.sync_api import Page, expect');
      expect(code).toContain('def test_pytest_playwright_suite(page: Page)');
      expect(code).toContain('page.goto("https://example.com/login")');
      expect(code).toContain('page.locator("#user").fill("admin")');
      expect(code).toContain('expect(page.locator(".dashboard")).to_be_visible()');
    });
  });

  describe('Automation Script Dispatcher', () => {
    it('dispatches to Playwright when engine is playwright', () => {
      const testCase = createTestCase('Dispatcher Test', 'https://example.com');
      testCase.settings.engine = 'playwright';
      testCase.settings.codeStyle = 'simple';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [{ strategy: 'id', value: 'btn', isUnique: true, matchCount: 1, score: 100 }],
            selectedLocatorIndex: 0,
          },
        })
      );

      const code = generateAutomationScript(testCase);
      expect(code).toContain('from playwright.sync_api import sync_playwright');
      expect(code).not.toContain('selenium');
    });

    it('dispatches to Selenium when engine is selenium', () => {
      const testCase = createTestCase('Dispatcher Test', 'https://example.com');
      testCase.settings.engine = 'selenium';
      testCase.settings.codeStyle = 'simple';
      testCase.steps.push(
        createTestStep({
          stepNumber: 1,
          action: 'click',
          target: {
            tagName: 'button',
            locators: [{ strategy: 'id', value: 'btn', isUnique: true, matchCount: 1, score: 100 }],
            selectedLocatorIndex: 0,
          },
        })
      );

      const code = generateAutomationScript(testCase);
      expect(code).toContain('from selenium import webdriver');
      expect(code).not.toContain('playwright');
    });
  });
});
