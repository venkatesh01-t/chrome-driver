import { describe, it, expect } from 'vitest';

describe('Project Scaffolding', () => {
  it('initializes vitest with jsdom environment', () => {
    const div = document.createElement('div');
    div.id = 'test-node';
    div.textContent = 'Selenium Recorder';
    document.body.appendChild(div);

    const found = document.getElementById('test-node');
    expect(found).not.toBeNull();
    expect(found?.textContent).toBe('Selenium Recorder');
  });
});
