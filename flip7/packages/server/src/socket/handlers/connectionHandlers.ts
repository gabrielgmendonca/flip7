import { Server, Socket } from 'socket.io';
import { RoomManager } from '../../room/RoomManager';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  PublicGameState,
  PublicRoom,
} from '@flip7/shared';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerConnectionHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomManager: RoomManager
): void {
  socket.on('connection:reconnect', ({ token, roomCode }) => {
    console.log('connection:reconnect received, token:', token?.substring(0, 8) + '...', 'roomCode:', roomCode);
    const result = roomManager.reconnect(token, socket.id);

    if (!result) {
      console.log('Reconnect failed - session not found');
      socket.emit('room:error', { message: 'Unable to reconnect. Session may have expired.' });
      return;
    }
    console.log('Reconnect successful');

    const { room, game, oldPlayerId } = result;

    socket.data.playerId = socket.id;
    socket.data.roomCode = room.code;
    socket.data.reconnectToken = token;

    socket.join(room.code);

    const publicRoom: PublicRoom = {
      code: room.code,
      hostId: room.hostId,
      players: room.players,
      settings: room.settings,
      hasActiveGame: room.gameState !== null,
    };

    const gameState = game ? (game.getState() as PublicGameState) : null;

    socket.emit('connection:reconnected', {
      room: publicRoom,
      gameState,
      playerId: socket.id,
    });

    // Notify other players
    socket.to(room.code).emit('connection:playerReconnected', { playerId: socket.id });
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;

    if (roomCode) {
      roomManager.playerDisconnected(socket.id);

      // Notify other players
      socket.to(roomCode).emit('connection:playerDisconnected', { playerId: socket.id });

      // Check if all players are disconnected, clean up room after timeout
      const room = roomManager.getRoom(roomCode);
      if (room) {
        const connectedPlayers = room.players.filter((p) => p.isConnected);
        if (connectedPlayers.length === 0) {
          // Schedule room cleanup after 5 minutes
          setTimeout(() => {
            const currentRoom = roomManager.getRoom(roomCode);
            if (currentRoom) {
              const stillConnected = currentRoom.players.filter((p) => p.isConnected);
              if (stillConnected.length === 0) {
                // Clean up room
                for (const player of currentRoom.players) {
                  roomManager.leaveRoom(player.id);
                }
              }
            }
          }, 5 * 60 * 1000);
        }
      }
    }
  });
}
