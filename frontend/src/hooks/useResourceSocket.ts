import { useEffect, useState } from 'react';
import { createResourceSocket } from '../services/socket';
import type { WsBookingEvent } from '../types';

export function useResourceSocket(resourceId: string | null) {
  const [lastEvent, setLastEvent] = useState<WsBookingEvent | null>(null);

  useEffect(() => {
    if (!resourceId) return;
    const disconnect = createResourceSocket(resourceId, (event) => {
      setLastEvent(event);
    });
    return disconnect;
  }, [resourceId]);

  return lastEvent;
}
