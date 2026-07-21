import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9002/api").replace(
    /\/api\/?$/,
    ""
  );

let socket: Socket | null = null;

/**
 * Opens (or reuses) the singleton connection to the /orders namespace,
 * authenticated via the JWT passed as handshake auth — the server rejects
 * the connection in handleConnection if it's missing or invalid.
 *
 * Reconnection uses socket.io's built-in backoff (delay doubles up to
 * reconnectionDelayMax, jittered by randomizationFactor) rather than a
 * fixed interval, so a flaky connection doesn't hammer the server.
 */
export function connectSocket(token: string): Socket {
  if (socket) {
    if (socket.auth && (socket.auth as { token?: string }).token === token) {
      if (!socket.connected) socket.connect();
      return socket;
    }
    socket.disconnect();
    socket = null;
  }

  socket = io(`${SOCKET_URL}/orders`, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
