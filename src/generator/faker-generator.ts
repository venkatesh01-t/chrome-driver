import { TestStep } from '../types/model';

export type DetectedFieldType =
  | 'email'
  | 'name'
  | 'phone'
  | 'address'
  | 'password'
  | 'number'
  | 'date'
  | 'generic';

export interface ParameterizedField {
  stepNumber: number;
  variableName: string;
  originalValue: string;
  detectedType: DetectedFieldType;
  fakerExpressionPython: string;
  fakerExpressionTs: string;
}

/**
 * Heuristically infers the semantic field type from input labels, names, placeholders, and current values
 */
export function inferFieldType(step: TestStep): DetectedFieldType {
  const meta = [
    step.target?.name,
    step.target?.labelText,
    step.target?.attributes?.placeholder,
    step.target?.attributes?.type,
    step.target?.semanticType,
    step.variableName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const val = (step.value || '').trim();

  if (/email|mail/i.test(meta) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    return 'email';
  }
  if (/password|pwd|passcode/i.test(meta) || step.isSensitive) {
    return 'password';
  }
  if (/phone|mobile|tel|cell/i.test(meta) || /^\+?[0-9\s-]{7,15}$/.test(val)) {
    return 'phone';
  }
  if (/first.*name|last.*name|full.*name|username|user.*name/i.test(meta)) {
    return 'name';
  }
  if (/address|street|city|zip|postal/i.test(meta)) {
    return 'address';
  }
  if (/date|dob|birth/i.test(meta) || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return 'date';
  }
  if (/quantity|amount|age|count/i.test(meta) || /^\d+$/.test(val)) {
    return 'number';
  }
  return 'generic';
}

/**
 * Extracts all input fields into parameterized variables for Data-Driven Testing
 */
export function extractParameterizedFields(steps: TestStep[]): ParameterizedField[] {
  const fields: ParameterizedField[] = [];
  const usedVars = new Set<string>();

  steps.forEach((step) => {
    if (step.action === 'type' && step.value) {
      const type = inferFieldType(step);
      let baseVar = step.target?.name || step.target?.labelText || type;
      baseVar = baseVar
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase()
        .replace(/^_+|_+$/g, '');

      if (!baseVar || baseVar.length < 2) baseVar = `param_${type}`;
      let varName = baseVar;
      let counter = 1;
      while (usedVars.has(varName)) {
        varName = `${baseVar}_${counter++}`;
      }
      usedVars.add(varName);

      let pyExpr = `fake.word()`;
      let tsExpr = `faker.word.sample()`;

      switch (type) {
        case 'email':
          pyExpr = `fake.email()`;
          tsExpr = `faker.internet.email()`;
          break;
        case 'name':
          pyExpr = `fake.name()`;
          tsExpr = `faker.person.fullName()`;
          break;
        case 'phone':
          pyExpr = `fake.phone_number()`;
          tsExpr = `faker.phone.number()`;
          break;
        case 'address':
          pyExpr = `fake.address()`;
          tsExpr = `faker.location.streetAddress()`;
          break;
        case 'password':
          pyExpr = `fake.password(length=12)`;
          tsExpr = `faker.internet.password({ length: 12 })`;
          break;
        case 'number':
          pyExpr = `str(fake.random_int(min=1, max=100))`;
          tsExpr = `String(faker.number.int({ min: 1, max: 100 }))`;
          break;
        case 'date':
          pyExpr = `fake.date()`;
          tsExpr = `faker.date.recent().toISOString().split('T')[0]`;
          break;
        default:
          pyExpr = `"${step.value}"`;
          tsExpr = `"${step.value}"`;
          break;
      }

      fields.push({
        stepNumber: step.stepNumber,
        variableName: varName,
        originalValue: step.value,
        detectedType: type,
        fakerExpressionPython: pyExpr,
        fakerExpressionTs: tsExpr,
      });
    }
  });

  return fields;
}

/**
 * Generates an external JSON dataset fixture for Data-Driven Testing (DDT)
 */
export function generateDatasetJson(fields: ParameterizedField[], iterations = 3): string {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < iterations; i++) {
    const row: Record<string, string> = {};
    fields.forEach((f) => {
      row[f.variableName] = i === 0 ? f.originalValue : `${f.originalValue}_iter${i + 1}`;
    });
    rows.push(row);
  }
  return JSON.stringify(rows, null, 2);
}
