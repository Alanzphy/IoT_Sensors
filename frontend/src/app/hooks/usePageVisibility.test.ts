import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePageVisibility } from "./usePageVisibility";

describe("usePageVisibility Code Hook", () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with the current visibility state", () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    // Check initial state
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);  // Is visible
  });

  it("should update visibility state when the browser triggers visibilitychange true -> hidden", () => {
    // 1. Ensure document initially visible
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);

    act(() => {
      // 2. Change mock to hidden and trigger event
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(false); // Tab was hidden
  });
});
