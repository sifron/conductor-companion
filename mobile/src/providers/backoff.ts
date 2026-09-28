export interface Backoff {
  next(): number;
  reset(): void;
}

/** 1s -> 60s, doubling, +/-20% jitter. */
export function createBackoff(minMs = 1000, maxMs = 60000): Backoff {
  let delay = minMs;
  return {
    next() {
      const jitter = delay * (0.8 + Math.random() * 0.4);
      delay = Math.min(delay * 2, maxMs);
      return jitter;
    },
    reset() {
      delay = minMs;
    },
  };
}
