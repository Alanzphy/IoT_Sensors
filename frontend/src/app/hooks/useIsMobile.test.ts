import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from './useIsMobile';

describe('useIsMobile code hook', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    // Reset vi fake timers inside tests if needed
  });

  afterEach(() => {
    // Restore original window width
    window.innerWidth = originalInnerWidth;
    vi.unstubAllGlobals();
  });

  it('initially evaluates to false on large screens (>= 768px)', () => {
    // Replace window inner width manually
    vi.stubGlobal('innerWidth', 1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('initially evaluates to true on mobile screens (< 768px)', () => {
    // Simulate a phone screen
    vi.stubGlobal('innerWidth', 375);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates state immediately on browser resize event crossing the 768px breakpoint', () => {
    // Start as mobile
    vi.stubGlobal('innerWidth', 400);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    // Expand screen past breakpoint
    act(() => {
      vi.stubGlobal('innerWidth', 800);
      window.dispatchEvent(new Event('resize'));
    });

    // Validates reactive layout behavior
    expect(result.current).toBe(false);
  });
});
