import { describe, it, expect } from 'vitest';
import { exportProjectData, importProjectData } from '../src/lib/stores/project.store';

describe('project.store: export/import roundtrip', () => {
  it('should export and then import successfully', () => {
    const exported = exportProjectData();
    expect(exported).toBeTruthy();

    const ok = importProjectData(exported);
    expect(ok).toBe(true);

    // Re-export to ensure data remains serializable
    const reExported = exportProjectData();
    expect(typeof reExported).toBe('string');
  });
});
