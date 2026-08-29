import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration } from '../lib/utils';

describe('formatDuration', () => {
  it('formats sub-hour durations as M:SS', () => {
    expect(formatDuration(75)).toBe('1:15');
  });

  it('formats durations over an hour as H:MM:SS', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('guards against negative input', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('formatBytes', () => {
  it('formats megabytes', () => {
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
  });

  it('returns 0 B for non-positive input', () => {
    expect(formatBytes(0)).toBe('0 B');
  });
});
