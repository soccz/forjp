"use client";
import { useCallback } from "react";

export function useHaptic() {
  return useCallback((pattern: number | number[] = 50) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);
}
