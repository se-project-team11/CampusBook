import type { WsBookingEvent } from '../types';

const WS_BASE = 'ws://localhost:8000';
const MAX_RETRIES = 5;

export function createResourceSocket(
  resourceId: string,
  onMessage: (event: WsBookingEvent) => void,
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(`${WS_BASE}/api/ws/${resourceId}`);

    ws.onopen = () => {
      attempt = 0;
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const event: WsBookingEvent = data.data ?? data;
        onMessage(event);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!closed && attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = Math.min(1000 * 2 ** attempt, 16000);
        attempt += 1;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  connect();

  return () => {
    closed = true;
    ws?.close();
  };
}
