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
    const socket: TypedSocket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');

      // Try to reconnect to previous session
      const reconnectToken = localStorage.getItem('flip7_reconnect_token');
      const roomCode = localStorage.getItem('flip7_room_code');

      if (reconnectToken && roomCode) {
        socket.emit('connection:reconnect', { token: reconnectToken, roomCode });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback(<E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ) => {
    if (socketRef.current) {
      socketRef.current.emit(event, ...args);
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
