import { describe, it, expect } from 'vitest';
import { inferFieldType, extractParameterizedFields, generateDatasetJson } from '../src/generator/faker-generator';
import { generateGitHubActionsWorkflow, generateDockerfile, generateCloudGridConfig } from '../src/generator/ci-cd-generator';
import { createTestStep } from '../src/types/model';

describe('Pillar 3: Data-Driven Testing (DDT), Faker & 1-Click CI/CD', () => {
  it('heuristically infers semantic field types from input attributes', () => {
    const emailStep = createTestStep({
      stepNumber: 1,
      action: 'type',
      value: 'alex@example.org',
      target: { tagName: 'input', locators: [], selectedLocatorIndex: 0, attributes: { type: 'email' } },
    });
    expect(inferFieldType(emailStep)).toBe('email');

    const passStep = createTestStep({
      stepNumber: 2,
      action: 'type',
      value: 'superSecret123',
      isSensitive: true,
      target: { tagName: 'input', locators: [], selectedLocatorIndex: 0 },
    });
    expect(inferFieldType(passStep)).toBe('password');

    const phoneStep = createTestStep({
      stepNumber: 3,
      action: 'type',
      value: '+1-555-0199',
      target: { tagName: 'input', locators: [], selectedLocatorIndex: 0, name: 'user_phone' },
    });
    expect(inferFieldType(phoneStep)).toBe('phone');
  });

  it('extracts multiple fields into parameterized dataset with Python and TS expressions', () => {
    const steps = [
      createTestStep({
        stepNumber: 1,
        action: 'type',
        value: 'john_doe@acme.com',
        target: { tagName: 'input', locators: [], selectedLocatorIndex: 0, name: 'billing_email' },
      }),
      createTestStep({
        stepNumber: 2,
        action: 'type',
        value: 'John Doe',
        target: { tagName: 'input', locators: [], selectedLocatorIndex: 0, labelText: 'Full Name' },
      }),
    ];

    const fields = extractParameterizedFields(steps);
    expect(fields.length).toBe(2);

    expect(fields[0].variableName).toBe('billing_email');
    expect(fields[0].detectedType).toBe('email');
    expect(fields[0].fakerExpressionPython).toBe('fake.email()');
    expect(fields[0].fakerExpressionTs).toBe('faker.internet.email()');

    expect(fields[1].variableName).toBe('full_name');
    expect(fields[1].detectedType).toBe('name');
    expect(fields[1].fakerExpressionPython).toBe('fake.name()');
    expect(fields[1].fakerExpressionTs).toBe('faker.person.fullName()');

    const json = generateDatasetJson(fields, 2);
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(2);
    expect(parsed[0].billing_email).toBe('john_doe@acme.com');
  });

  it('generates GitHub Actions CI/CD workflows for both Pytest and Playwright TS', () => {
    const pyWorkflow = generateGitHubActionsWorkflow('Selenium Enterprise Regression', 'pytest');
    expect(pyWorkflow).toContain('name: Selenium Enterprise Regression');
    expect(pyWorkflow).toContain('google-chrome-stable');
    expect(pyWorkflow).toContain('pip install pytest selenium');
    expect(pyWorkflow).toContain('pytest -v -s');

    const tsWorkflow = generateGitHubActionsWorkflow('Playwright Cross-Browser CI', 'playwright-ts');
    expect(tsWorkflow).toContain('matrix:\n        browser: [chromium, firefox]');
    expect(tsWorkflow).toContain('npx playwright install');
    expect(tsWorkflow).toContain('npx playwright test');
  });

  it('generates Dockerfile and Cloud Grid configuration files', () => {
    const dockerPy = generateDockerfile('pytest');
    expect(dockerPy).toContain('FROM python:3.11-slim-bullseye');
    expect(dockerPy).toContain('google-chrome-stable');

    const dockerTs = generateDockerfile('playwright-ts');
    expect(dockerTs).toContain('FROM mcr.microsoft.com/playwright');

    const bsConfig = generateCloudGridConfig('browserstack');
    expect(bsConfig).toContain('BROWSERSTACK_USERNAME');
    expect(bsConfig).toContain('cypress_config_file');
  });
});
