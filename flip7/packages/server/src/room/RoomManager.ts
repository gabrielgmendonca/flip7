import { Room, RoomPlayer, GameSettings, DEFAULT_GAME_SETTINGS, PublicRoom } from '@flip7/shared';
import { Game, GamePlayer } from '../game/Game';
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private games: Map<string, Game> = new Map();
  private reconnectTokens: Map<string, { playerId: string; roomCode: string }> = new Map();

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;

    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));

    return code;
  }

  createRoom(playerId: string, playerName: string): { room: PublicRoom; reconnectToken: string } {
    const code = this.generateRoomCode();
    const reconnectToken = uuidv4();

    const player: RoomPlayer = {
      id: playerId,
      name: playerName,
      isHost: true,
      isReady: true,
      isConnected: true,
    };

    const room: Room = {
      code,
      hostId: playerId,
      players: [player],
      settings: { ...DEFAULT_GAME_SETTINGS },
      gameState: null,
      createdAt: new Date(),
    };

    this.rooms.set(code, room);
    this.playerToRoom.set(playerId, code);
    this.reconnectTokens.set(reconnectToken, { playerId, roomCode: code });

    return { room: this.toPublicRoom(room), reconnectToken };
  }

  joinRoom(
    roomCode: string,
    playerId: string,
    playerName: string
  ): { room: PublicRoom; reconnectToken: string } | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) {
      return null;
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return null;
    }

    if (room.gameState) {
      return null; // Can't join mid-game
    }

    const reconnectToken = uuidv4();

    const player: RoomPlayer = {
      id: playerId,
      name: playerName,
      isHost: false,
      isReady: true,
      isConnected: true,
    };

    room.players.push(player);
    this.playerToRoom.set(playerId, room.code);
    this.reconnectTokens.set(reconnectToken, { playerId, roomCode: room.code });

    return { room: this.toPublicRoom(room), reconnectToken };
  }

  leaveRoom(playerId: string): { room: Room | null; wasHost: boolean; newHostId?: string } {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) {
      return { room: null, wasHost: false };
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return { room: null, wasHost: false };
    }

    const wasHost = room.hostId === playerId;
    room.players = room.players.filter((p) => p.id !== playerId);
    this.playerToRoom.delete(playerId);

    // Remove reconnect token for this player
    for (const [token, data] of this.reconnectTokens.entries()) {
      if (data.playerId === playerId) {
        this.reconnectTokens.delete(token);
        break;
      }
    }

    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      const game = this.games.get(roomCode);
      if (game) {
        game.cleanup();
        this.games.delete(roomCode);
      }
      return { room: null, wasHost };
    }

    let newHostId: string | undefined;
    if (wasHost && room.players.length > 0) {
      newHostId = room.players[0].id;
      room.hostId = newHostId;
      room.players[0].isHost = true;
    }

    // If game is active, notify game of disconnect
    const game = this.games.get(roomCode);
    if (game) {
      game.playerDisconnected(playerId);
    }

    return { room, wasHost, newHostId };
  }

  kickPlayer(hostId: string, targetPlayerId: string): boolean {
    const roomCode = this.playerToRoom.get(hostId);
    if (!roomCode) {
      return false;
    }

    const room = this.rooms.get(roomCode);
    if (!room || room.hostId !== hostId) {
      return false;
    }

    if (targetPlayerId === hostId) {
      return false; // Can't kick yourself
    }

    const targetPlayer = room.players.find((p) => p.id === targetPlayerId);
    if (!targetPlayer) {
      return false;
    }

    room.players = room.players.filter((p) => p.id !== targetPlayerId);
    this.playerToRoom.delete(targetPlayerId);

    return true;
  }

  updateSettings(playerId: string, settings: Partial<GameSettings>): GameSettings | null {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode);
    if (!room || room.hostId !== playerId) {
      return null;
    }

    room.settings = { ...room.settings, ...settings };
    return room.settings;
  }

  startGame(hostId: string): Game | null {
    console.log('startGame called with hostId:', hostId);
    const roomCode = this.playerToRoom.get(hostId);
    console.log('roomCode from playerToRoom:', roomCode);
    if (!roomCode) {
      console.log('No roomCode found for hostId');
      return null;
    }

    const room = this.rooms.get(roomCode);
    console.log('room:', room ? { code: room.code, hostId: room.hostId, players: room.players.length } : null);
    if (!room || room.hostId !== hostId) {
      console.log('Room not found or hostId mismatch. room.hostId:', room?.hostId);
      return null;
    }

    if (room.players.length < 3) {
      console.log('Not enough players:', room.players.length);
      return null;
    }

    const gamePlayers: GamePlayer[] = room.players.map((p) => {
      // Find reconnect token for this player
      let token = '';
      for (const [t, data] of this.reconnectTokens.entries()) {
        if (data.playerId === p.id) {
          token = t;
          break;
        }
      }
      return {
        id: p.id,
        name: p.name,
        reconnectToken: token,
      };
    });

    const game = new Game(gamePlayers, room.settings);
    game.startGame();

    this.games.set(roomCode, game);
    room.gameState = game.getState();

    return game;
  }

  getGame(roomCode: string): Game | undefined {
    return this.games.get(roomCode);
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  getRoomByPlayerId(playerId: string): Room | undefined {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) {
      return undefined;
    }
    return this.rooms.get(roomCode);
  }

  getGameByPlayerId(playerId: string): Game | undefined {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) {
      return undefined;
    }
    return this.games.get(roomCode);
  }

  reconnect(
    token: string,
    newSocketId: string
  ): { room: Room; game: Game | undefined; oldPlayerId: string } | null {
    const tokenData = this.reconnectTokens.get(token);
    if (!tokenData) {
      return null;
    }

    const room = this.rooms.get(tokenData.roomCode);
    if (!room) {
      this.reconnectTokens.delete(token);
      return null;
    }

    const player = room.players.find((p) => p.id === tokenData.playerId);
    if (!player) {
      this.reconnectTokens.delete(token);
      return null;
    }

    const oldPlayerId = player.id;

    // Update player ID to new socket ID
    player.id = newSocketId;
    player.isConnected = true;
    this.playerToRoom.delete(oldPlayerId);
    this.playerToRoom.set(newSocketId, tokenData.roomCode);

    if (room.hostId === oldPlayerId) {
      room.hostId = newSocketId;
    }

    // Update game state
    const game = this.games.get(tokenData.roomCode);
    if (game) {
      game.playerReconnected(oldPlayerId);
      game.updatePlayerId(oldPlayerId, newSocketId);
    }

    // Update token mapping
    this.reconnectTokens.set(token, { playerId: newSocketId, roomCode: tokenData.roomCode });

    return { room, game, oldPlayerId };
  }

  playerDisconnected(playerId: string): void {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) {
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isConnected = false;
    }

    const game = this.games.get(roomCode);
    if (game) {
      game.playerDisconnected(playerId);
    }
  }

  private toPublicRoom(room: Room): PublicRoom {
    return {
      code: room.code,
      hostId: room.hostId,
      players: room.players,
      settings: room.settings,
      hasActiveGame: room.gameState !== null,
    };
  }

  getPublicRoom(roomCode: string): PublicRoom | undefined {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return undefined;
    }
    return this.toPublicRoom(room);
  }
}
