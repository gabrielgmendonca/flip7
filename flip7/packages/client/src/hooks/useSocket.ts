import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@flip7/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('Connecting to socket server:', SOCKET_URL);
    const socket: TypedSocket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // Force WebSocket first, fallback to polling
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server, socket id:', socket.id);

      // Try to reconnect to previous session
      const reconnectToken = localStorage.getItem('flip7_reconnect_token');
      const roomCode = localStorage.getItem('flip7_room_code');

      if (reconnectToken && roomCode) {
        socket.emit('connection:reconnect', { token: reconnectToken, roomCode });
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Disconnected from server, reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    socket.io.on('reconnect', (attempt) => {
      console.log('Socket reconnected after', attempt, 'attempts');
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log('Socket reconnection attempt', attempt);
    });

    socket.io.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback(<E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log(`Emitting ${event}`, args.length > 0 ? args : '(no args)');
      socketRef.current.emit(event, ...args);
    } else {
      console.error(`Failed to emit ${event}: socket not connected (exists: ${!!socketRef.current}, connected: ${socketRef.current?.connected})`);
    }
  }, []);

  const on = useCallback(<E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E]
  ) => {
    if (socketRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socketRef.current.on(event, handler as any);
    }
    return () => {
      if (socketRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socketRef.current.off(event, handler as any);
      }
    };
  }, []);

  const off = useCallback(<E extends keyof ServerToClientEvents>(
    event: E,
    handler?: ServerToClientEvents[E]
  ) => {
    if (socketRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socketRef.current.off(event, handler as any);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
    off,
  };
}
