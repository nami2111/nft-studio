import { describe, it, expect } from 'vitest';
import { exportProjectData, importProjectData, isValidImportedProject } from '../src/lib/stores/project.store';

describe('import/export validation', () => {
  it('should import valid exported data', () => {
    const exported = exportProjectData();
    expect(exported).toBeTruthy();
    const ok = importProjectData(exported);
    expect(ok).toBe(true);
  });

  it('should reject invalid JSON lacking required fields', () => {
    const bad = JSON.stringify({ not: 'valid' });
    const ok = importProjectData(bad);
    expect(ok).toBe(false);
  });

  it('isValidImportedProject recognizes valid/invalid shapes', () => {
    const data = JSON.parse(exportProjectData());
    expect(isValidImportedProject(data)).toBe(true);
    const clone = JSON.parse(JSON.stringify(data));
    // remove a required field to simulate invalid structure
    delete clone.id;
    expect(isValidImportedProject(clone)).toBe(false);
  });
});
