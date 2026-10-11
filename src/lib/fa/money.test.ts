import { describe, it, expect } from 'vitest';
import { bhd, parseAmount } from './money';

describe('money', () => {
  it('formats 3 decimals with grouping', () => expect(bhd(1234.5)).toBe('1,234.500'));
  it('formats zero', () => expect(bhd(0)).toBe('0.000'));
  it('parses typed amounts', () => { expect(parseAmount('1.275')).toBe(1.275); expect(parseAmount('1,2')).toBe(1.2); expect(parseAmount('')).toBe(0); });
});
