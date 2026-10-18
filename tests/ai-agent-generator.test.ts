import { describe, it, expect } from 'vitest';
import {
  inferNaturalLanguageIntent,
  generateNaturalLanguageScenario,
  generateBrowserUseAgent,
  generateStagehandScript,
} from '../src/generator/ai-agent-generator';
import { TestCaseModel, createTestCase, createTestStep } from '../src/types/model';

describe('Feature 2: Autonomous AI Agent Exporter (Browser-Use & Stagehand)', () => {
  const createMockTestCase = (): TestCaseModel => {
    const tc = createTestCase('Flight Search', 'https://travel.example.com');
    tc.steps = [
      createTestStep({
        stepNumber: 1,
        action: 'type',
        value: 'New York',
        target: {
          tagName: 'input',
          selectedLocatorIndex: 0,
          labelText: 'Departure City',
          locators: [{ strategy: 'id', value: 'from-city', isUnique: true, matchCount: 1, score: 95 }],
        },
      }),
      createTestStep({
        stepNumber: 2,
        action: 'click',
        target: {
          tagName: 'button',
          selectedLocatorIndex: 0,
          text: 'Search Flights',
          locators: [{ strategy: 'css', value: '.search-btn', isUnique: true, matchCount: 1, score: 90 }],
        },
      }),
      createTestStep({
        stepNumber: 3,
        action: 'assert_text',
        assertExpected: 'Results Found',
        target: {
          tagName: 'h3',
          selectedLocatorIndex: 0,
          locators: [{ strategy: 'css', value: '.results-header', isUnique: true, matchCount: 1, score: 85 }],
        },
      }),
    ];
    return tc;
  };

  it('infers natural language intents accurately from element labels and actions', () => {
    const step = createTestStep({
      stepNumber: 1,
      action: 'click',
      target: { tagName: 'button', locators: [], selectedLocatorIndex: 0, text: 'Confirm Booking' },
    });
    const intent = inferNaturalLanguageIntent(step);
    expect(intent).toBe('Click on the "Confirm Booking" button or link');
  });

  it('generates a clean plain-English user scenario synopsis', () => {
    const tc = createMockTestCase();
    const synopsis = generateNaturalLanguageScenario(tc);
    expect(synopsis).toContain('Scenario: Flight Search');
    expect(synopsis).toContain('Target URL: https://travel.example.com');
    expect(synopsis).toContain('1. Type "New York" into the "Departure City" input field');
    expect(synopsis).toContain('2. Click on the "Search Flights" button or link');
  });

  it('generates a valid Python Browser-Use autonomous agent script', () => {
    const tc = createMockTestCase();
    const script = generateBrowserUseAgent(tc);

    expect(script).toContain('from browser_use import Agent');
    expect(script).toContain('from langchain_openai import ChatOpenAI');
    expect(script).toContain('ChatOpenAI(');
    expect(script).toContain('model="gpt-4o"');
    expect(script).toContain('agent = Agent(');
    expect(script).toContain('use_vision=True');
    expect(script).toContain('await agent.run()');
  });

  it('generates a valid Stagehand TypeScript agent script with act and extract commands', () => {
    const tc = createMockTestCase();
    const script = generateStagehandScript(tc);

    expect(script).toContain("import { Stagehand } from '@browserbase/stagehand';");
    expect(script).toContain("import { z } from 'zod';");
    expect(script).toContain('await stagehand.init();');
    expect(script).toContain("await page.goto('https://travel.example.com');");
    expect(script).toContain('await page.act(');
    expect(script).toContain('await page.extract({');
  });
});
