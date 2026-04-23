import { describe, it, expect } from 'vitest';

describe('Sample Test', () => {
  it('should pass basic arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const name = 'CampusBook';
    expect(name.length).toBe(10);
    expect(name.toUpperCase()).toBe('CAMPUSBOOK');
  });
});