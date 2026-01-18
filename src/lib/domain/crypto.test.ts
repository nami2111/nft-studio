
import { describe, it, expect } from 'vitest';

describe('Environment Check', () => {
    it('has crypto.randomUUID', () => {
        expect(typeof crypto).toBe('object');
        expect(typeof crypto.randomUUID).toBe('function');
        console.log('UUID:', crypto.randomUUID());
    });
});
