import { Server, Socket } from 'socket.io';
import { RoomManager } from '../../room/RoomManager';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@flip7/shared';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerRoomHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomManager: RoomManager
): void {
  socket.on('room:create', ({ playerName }) => {
    console.log('room:create received from', socket.id, 'name:', playerName);
    const { room, reconnectToken } = roomManager.createRoom(socket.id, playerName);
    console.log('Room created:', room.code, 'hostId:', room.hostId);

    socket.data.playerId = socket.id;
    socket.data.playerName = playerName;
    socket.data.roomCode = room.code;
    socket.data.reconnectToken = reconnectToken;

    socket.join(room.code);
    socket.emit('room:created', { room, playerId: socket.id, reconnectToken });
    console.log('room:created emitted');
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    console.log('room:join received from', socket.id, 'code:', roomCode, 'name:', playerName);
    const result = roomManager.joinRoom(roomCode, socket.id, playerName);

    if (!result) {
      console.log('Failed to join room');
      socket.emit('room:error', { message: 'Unable to join room. Room may be full or not exist.' });
      return;
    }

    const { room, reconnectToken } = result;
    console.log('Joined room:', room.code, 'players:', room.players.length);

    socket.data.playerId = socket.id;
    socket.data.playerName = playerName;
    socket.data.roomCode = room.code;
    socket.data.reconnectToken = reconnectToken;

    socket.join(room.code);
    socket.emit('room:joined', { room, playerId: socket.id, reconnectToken });
    console.log('room:joined emitted');

    // Notify other players
    socket.to(room.code).emit('room:playerJoined', {
      player: {
        id: socket.id,
        name: playerName,
        isHost: false,
        isReady: true,
        isConnected: true,
      },
    });
  });

  socket.on('room:leave', () => {
    const { room, wasHost, newHostId } = roomManager.leaveRoom(socket.id);

    if (socket.data.roomCode) {
      socket.leave(socket.data.roomCode);
      io.to(socket.data.roomCode).emit('room:playerLeft', { playerId: socket.id });

      if (wasHost && newHostId) {
        io.to(socket.data.roomCode).emit('room:hostChanged', { newHostId });
      }
    }

    socket.data.roomCode = null;
  });

  socket.on('room:kick', ({ playerId }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return;
    }

    const success = roomManager.kickPlayer(socket.id, playerId);
    if (success) {
      io.to(roomCode).emit('room:playerKicked', { playerId });

      // Find and disconnect the kicked player's socket
      const kickedSocket = io.sockets.sockets.get(playerId);
      if (kickedSocket) {
        kickedSocket.leave(roomCode);
        kickedSocket.data.roomCode = null;
      }
    }
  });

  socket.on('room:updateSettings', (settings) => {
    const newSettings = roomManager.updateSettings(socket.id, settings);

    if (newSettings && socket.data.roomCode) {
      io.to(socket.data.roomCode).emit('room:settingsUpdated', { settings: newSettings });
    }
  });
}
