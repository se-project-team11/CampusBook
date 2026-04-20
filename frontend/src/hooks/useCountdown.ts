import { useState, useEffect } from 'react';

// Backend returns naive datetimes without timezone — treat as UTC by appending Z
function toUtcMs(iso: string): number {
  const normalized = /[Z+]/.test(iso) ? iso : iso + 'Z';
  return new Date(normalized).getTime();
}

export function useCountdown(targetIso: string) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setRemaining(Math.max(0, toUtcMs(targetIso) - Date.now()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const minutes = Math.floor((remaining ?? 1) / 60000);
  const seconds = Math.floor(((remaining ?? 1) % 60000) / 1000);
  const expired = remaining !== null && remaining === 0;

  return { minutes, seconds, expired, totalMs: remaining ?? 0 };
}
