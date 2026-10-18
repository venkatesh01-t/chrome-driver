import { describe, it, expect } from 'vitest';
import { generatePlaywrightTs, generateCypress, generateSeleniumJava } from '../src/generator/polyglot-generator';
import { TestCaseModel, createTestCase, createTestStep } from '../src/types/model';

describe('Pillar 2: Polyglot Multi-Framework Export Engine', () => {
  const createMockTestCase = (): TestCaseModel => {
    const tc = createTestCase('Checkout Flow Test', 'https://shop.example.com');
    tc.steps = [
      createTestStep({
        stepNumber: 1,
        action: 'click',
        target: {
          tagName: 'button',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'data-testid', value: 'add-cart-btn', isUnique: true, matchCount: 1, score: 95 }],
        },
      }),
      createTestStep({
        stepNumber: 2,
        action: 'type',
        value: 'customer@test.com',
        target: {
          tagName: 'input',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'id', value: 'email-input', isUnique: true, matchCount: 1, score: 100 }],
        },
      }),
      createTestStep({
        stepNumber: 3,
        action: 'select',
        value: 'express',
        target: {
          tagName: 'select',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'name', value: 'shipping_speed', isUnique: true, matchCount: 1, score: 90 }],
        },
      }),
      createTestStep({
        stepNumber: 4,
        action: 'assert_visible',
        target: {
          tagName: 'div',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'css', value: '.order-badge', isUnique: true, matchCount: 1, score: 85 }],
        },
      }),
      createTestStep({
        stepNumber: 5,
        action: 'assert_text',
        assertExpected: 'Order Confirmed',
        target: {
          tagName: 'h2',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'xpath', value: "//h2[@class='confirmation']", isUnique: true, matchCount: 1, score: 80 }],
        },
      }),
    ];
    return tc;
  };

  it('generates valid TypeScript Playwright test code with async/await and expect assertions', () => {
    const tc = createMockTestCase();
    const code = generatePlaywrightTs(tc);

    expect(code).toContain("import { test, expect, Page } from '@playwright/test';");
    expect(code).toContain("test.describe('Checkout Flow Test'");
    expect(code).toContain("await page.goto('https://shop.example.com'");
    expect(code).toContain('await page.locator("[data-testid=\\"add-cart-btn\\"]").click();');
    expect(code).toContain('await page.locator("#email-input").fill("customer@test.com");');
    expect(code).toContain('await page.locator("[name=\\"shipping_speed\\"]").selectOption("express");');
    expect(code).toContain('await expect(page.locator(".order-badge")).toBeVisible');
    expect(code).toContain('await expect(page.locator("xpath=//h2[@class=\'confirmation\']")).toContainText("Order Confirmed");');
  });

  it('generates valid Cypress TypeScript spec with chaining and cy commands', () => {
    const tc = createMockTestCase();
    const code = generateCypress(tc);

    expect(code).toContain("/// <reference types=\"cypress\" />");
    expect(code).toContain("describe('Checkout Flow Test'");
    expect(code).toContain("cy.visit('https://shop.example.com');");
    expect(code).toContain("cy.get('[data-testid=\"add-cart-btn\"]').should('be.visible').click();");
    expect(code).toContain("cy.get('#email-input').clear().type(\"customer@test.com\");");
    expect(code).toContain("cy.get('.order-badge').should('be.visible');");
    expect(code).toContain("cy.xpath('//h2[@class=\\'confirmation\\']').should('contain.text', \"Order Confirmed\");");
  });

  it('generates valid Java Selenium 4 + TestNG class with explicit WebDriverWait and Assert', () => {
    const tc = createMockTestCase();
    const code = generateSeleniumJava(tc);

    expect(code).toContain('public class CheckoutFlowTest {');
    expect(code).toContain('private WebDriver driver;');
    expect(code).toContain('private WebDriverWait wait;');
    expect(code).toContain('driver.get("https://shop.example.com");');
    expect(code).toContain('wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid=\\"add-cart-btn\\"]"))).click();');
    expect(code).toContain('wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("email-input")));');
    expect(code).toContain('Assert.assertTrue(wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".order-badge"))).isDisplayed());');
    expect(code).toContain('Assert.assertTrue(actualText4.contains("Order Confirmed"), "Text assertion failed");');
    expect(code).toContain('driver.quit();');
  });
});
