import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCurrentPeriodWindow } from './period';

/**
 * Comprehensive tests for getCurrentPeriodWindow() bug fix
 *
 * Bug: The original logic was inverted - it used the wrong fiscal month
 * Fix: Corrected logic to return the fiscal period that contains today
 */
describe('getCurrentPeriodWindow - Bug Fix Verification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return correct period when before anchor day (Oct 5)', () => {
    // Mock date: October 5, 2025 (before anchor day 23)
    // Expected: September fiscal period (Sep 23 - Oct 22)
    // This is the primary bug case
    vi.setSystemTime(new Date('2025-10-05T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-09-23',
      to: '2025-10-22',
      year: 2025,
      month: 10,
    });
  });

  it('should return correct period when on anchor day (Oct 23)', () => {
    // Mock date: October 23, 2025 (on anchor day)
    // Expected: October fiscal period (Oct 23 - Nov 22)
    vi.setSystemTime(new Date('2025-10-23T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-10-23',
      to: '2025-11-22',
      year: 2025,
      month: 11,
    });
  });

  it('should return correct period when after anchor day (Oct 25)', () => {
    // Mock date: October 25, 2025 (after anchor day 23)
    // Expected: October fiscal period (Oct 23 - Nov 22)
    vi.setSystemTime(new Date('2025-10-25T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-10-23',
      to: '2025-11-22',
      year: 2025,
      month: 11,
    });
  });

  it('should handle January before anchor day (year rollback)', () => {
    // Mock date: January 15, 2026 (before anchor day 23)
    // Expected: January fiscal period (Dec 23, 2025 - Jan 22, 2026)
    vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-12-23',
      to: '2026-01-22',
      year: 2026,
      month: 1,
    });
  });

  it('should handle December after anchor day (year rollover)', () => {
    // Mock date: December 25, 2025 (after anchor day 23)
    // Expected: December fiscal period (Dec 23, 2025 - Jan 22, 2026)
    vi.setSystemTime(new Date('2025-12-25T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-12-23',
      to: '2026-01-22',
      year: 2026,
      month: 1,
    });
  });

  it('should handle December before anchor day', () => {
    // Mock date: December 15, 2025 (before anchor day 23)
    // Expected: December fiscal period (Nov 23 - Dec 22)
    vi.setSystemTime(new Date('2025-12-15T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-11-23',
      to: '2025-12-22',
      year: 2025,
      month: 12,
    });
  });

  it('should handle January after anchor day', () => {
    // Mock date: January 25, 2026 (after anchor day 23)
    // Expected: January fiscal period (Jan 23 - Feb 22, 2026)
    vi.setSystemTime(new Date('2026-01-25T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2026-01-23',
      to: '2026-02-22',
      year: 2026,
      month: 2,
    });
  });

  it('should handle edge case: February 28 (non-leap year)', () => {
    // Mock date: February 28, 2025 (after anchor day 23)
    // Expected: February fiscal period (Feb 23 - Mar 22, 2025)
    vi.setSystemTime(new Date('2025-02-28T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-02-23',
      to: '2025-03-22',
      year: 2025,
      month: 3,
    });
  });

  it('should handle edge case: Day 22 (one before anchor)', () => {
    // Mock date: October 22, 2025 (one day before anchor)
    // Expected: September fiscal period (Sep 23 - Oct 22)
    vi.setSystemTime(new Date('2025-10-22T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-09-23',
      to: '2025-10-22',
      year: 2025,
      month: 10,
    });
  });

  it('should handle edge case: Day 1 (before anchor)', () => {
    // Mock date: October 1, 2025 (first day of month, before anchor)
    // Expected: September fiscal period (Sep 23 - Oct 22)
    vi.setSystemTime(new Date('2025-10-01T10:00:00Z'));

    const result = getCurrentPeriodWindow(23);
    expect(result).toEqual({
      from: '2025-09-23',
      to: '2025-10-22',
      year: 2025,
      month: 10,
    });
  });
});
