import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RoomManager } from './RoomManager';
import { DEFAULT_GAME_SETTINGS } from '@flip7/shared';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('createRoom', () => {
    it('should create a room with a unique code', () => {
      const result = roomManager.createRoom('player-1', 'Alice');

      expect(result.room.code).toHaveLength(5);
      expect(result.room.code).toMatch(/^[A-Z0-9]+$/);
    });

    it('should return a reconnect token', () => {
      const result = roomManager.createRoom('player-1', 'Alice');

      expect(result.reconnectToken).toBeDefined();
      expect(result.reconnectToken.length).toBeGreaterThan(0);
    });

    it('should set creator as host', () => {
      const result = roomManager.createRoom('player-1', 'Alice');

      expect(result.room.hostId).toBe('player-1');
      expect(result.room.players[0].isHost).toBe(true);
    });

    it('should use default game settings', () => {
      const result = roomManager.createRoom('player-1', 'Alice');

      expect(result.room.settings).toEqual(DEFAULT_GAME_SETTINGS);
    });

    it('should mark creator as ready and connected', () => {
      const result = roomManager.createRoom('player-1', 'Alice');

      expect(result.room.players[0].isReady).toBe(true);
      expect(result.room.players[0].isConnected).toBe(true);
    });

    it('should not have an active game initially', () => {
      const result = roomManager.createRoom('player-1', 'Alice');

      expect(result.room.hasActiveGame).toBe(false);
    });

    it('should store the room for later retrieval', () => {
      const result = roomManager.createRoom('player-1', 'Alice');

      const room = roomManager.getRoom(result.room.code);
      expect(room).toBeDefined();
      expect(room!.code).toBe(result.room.code);
    });

    it('should generate unique codes for multiple rooms', () => {
      const codes = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const result = roomManager.createRoom(`player-${i}`, `Player ${i}`);
        codes.add(result.room.code);
      }

      expect(codes.size).toBe(10);
    });
  });

  describe('joinRoom', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
    });

    it('should allow a player to join an existing room', () => {
      const result = roomManager.joinRoom(roomCode, 'player-2', 'Bob');

      expect(result).not.toBeNull();
      expect(result!.room.players.length).toBe(2);
    });

    it('should return reconnect token for joined player', () => {
      const result = roomManager.joinRoom(roomCode, 'player-2', 'Bob');

      expect(result!.reconnectToken).toBeDefined();
      expect(result!.reconnectToken.length).toBeGreaterThan(0);
    });

    it('should mark joined player as not host', () => {
      const result = roomManager.joinRoom(roomCode, 'player-2', 'Bob');

      const joinedPlayer = result!.room.players.find((p) => p.id === 'player-2');
      expect(joinedPlayer!.isHost).toBe(false);
    });

    it('should mark joined player as ready and connected', () => {
      const result = roomManager.joinRoom(roomCode, 'player-2', 'Bob');

      const joinedPlayer = result!.room.players.find((p) => p.id === 'player-2');
      expect(joinedPlayer!.isReady).toBe(true);
      expect(joinedPlayer!.isConnected).toBe(true);
    });

    it('should return null for non-existent room', () => {
      const result = roomManager.joinRoom('XXXXX', 'player-2', 'Bob');

      expect(result).toBeNull();
    });

    it('should handle case-insensitive room codes', () => {
      const result = roomManager.joinRoom(roomCode.toLowerCase(), 'player-2', 'Bob');

      expect(result).not.toBeNull();
      expect(result!.room.players.length).toBe(2);
    });

    it('should not allow joining a full room', () => {
      // Fill the room to max (6 players)
      for (let i = 2; i <= 6; i++) {
        roomManager.joinRoom(roomCode, `player-${i}`, `Player ${i}`);
      }

      const result = roomManager.joinRoom(roomCode, 'player-7', 'Player 7');
      expect(result).toBeNull();
    });

    it('should not allow joining a room with active game', () => {
      // Add enough players to start a game
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');

      // Start the game
      roomManager.startGame('host-1');

      // Try to join
      const result = roomManager.joinRoom(roomCode, 'player-4', 'Player 4');
      expect(result).toBeNull();
    });
  });

  describe('leaveRoom', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');
    });

    it('should remove player from room', () => {
      const result = roomManager.leaveRoom('player-2');

      expect(result.room).not.toBeNull();
      expect(result.room!.players.length).toBe(2);
      expect(result.room!.players.find((p) => p.id === 'player-2')).toBeUndefined();
    });

    it('should return wasHost as false for non-host leaving', () => {
      const result = roomManager.leaveRoom('player-2');

      expect(result.wasHost).toBe(false);
    });

    it('should return wasHost as true for host leaving', () => {
      const result = roomManager.leaveRoom('host-1');

      expect(result.wasHost).toBe(true);
    });

    it('should assign new host when host leaves', () => {
      const result = roomManager.leaveRoom('host-1');

      expect(result.newHostId).toBeDefined();
      expect(result.room!.hostId).toBe(result.newHostId);
    });

    it('should delete room when last player leaves', () => {
      roomManager.leaveRoom('player-2');
      roomManager.leaveRoom('player-3');
      const result = roomManager.leaveRoom('host-1');

      expect(result.room).toBeNull();
      expect(roomManager.getRoom(roomCode)).toBeUndefined();
    });

    it('should return null room for non-existent player', () => {
      const result = roomManager.leaveRoom('non-existent');

      expect(result.room).toBeNull();
      expect(result.wasHost).toBe(false);
    });

    it('should clean up player-to-room mapping', () => {
      roomManager.leaveRoom('player-2');

      const room = roomManager.getRoomByPlayerId('player-2');
      expect(room).toBeUndefined();
    });
  });

  describe('kickPlayer', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');
    });

    it('should allow host to kick a player', () => {
      const result = roomManager.kickPlayer('host-1', 'player-2');

      expect(result).toBe(true);
      const room = roomManager.getRoom(roomCode)!;
      expect(room.players.find((p) => p.id === 'player-2')).toBeUndefined();
    });

    it('should not allow non-host to kick', () => {
      const result = roomManager.kickPlayer('player-2', 'player-3');

      expect(result).toBe(false);
    });

    it('should not allow host to kick themselves', () => {
      const result = roomManager.kickPlayer('host-1', 'host-1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent host', () => {
      const result = roomManager.kickPlayer('non-existent', 'player-2');

      expect(result).toBe(false);
    });

    it('should return false for non-existent target player', () => {
      const result = roomManager.kickPlayer('host-1', 'non-existent');

      expect(result).toBe(false);
    });

    it('should clean up kicked player mappings', () => {
      roomManager.kickPlayer('host-1', 'player-2');

      const room = roomManager.getRoomByPlayerId('player-2');
      expect(room).toBeUndefined();
    });
  });

  describe('updateSettings', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
    });

    it('should allow host to update settings', () => {
      const result = roomManager.updateSettings('host-1', { targetScore: 100 });

      expect(result).not.toBeNull();
      expect(result!.targetScore).toBe(100);
    });

    it('should merge with existing settings', () => {
      const result = roomManager.updateSettings('host-1', { targetScore: 100 });

      expect(result!.targetScore).toBe(100);
      expect(result!.maxPlayers).toBe(DEFAULT_GAME_SETTINGS.maxPlayers);
    });

    it('should not allow non-host to update settings', () => {
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');

      const result = roomManager.updateSettings('player-2', { targetScore: 100 });
      expect(result).toBeNull();
    });

    it('should return null for non-existent player', () => {
      const result = roomManager.updateSettings('non-existent', { targetScore: 100 });

      expect(result).toBeNull();
    });

    it('should update multiple settings at once', () => {
      const result = roomManager.updateSettings('host-1', {
        targetScore: 150,
        maxPlayers: 4,
        turnTimeoutSeconds: 60,
      });

      expect(result!.targetScore).toBe(150);
      expect(result!.maxPlayers).toBe(4);
      expect(result!.turnTimeoutSeconds).toBe(60);
    });
  });

  describe('startGame', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');
    });

    afterEach(() => {
      // Cleanup any running games
      const game = roomManager.getGame(roomCode);
      if (game) {
        game.cleanup();
      }
    });

    it('should allow host to start game', () => {
      const game = roomManager.startGame('host-1');

      expect(game).not.toBeNull();
    });

    it('should not allow non-host to start game', () => {
      const game = roomManager.startGame('player-2');

      expect(game).toBeNull();
    });

    it('should require at least 3 players', () => {
      // Create a new room with only 2 players
      const newRoom = roomManager.createRoom('host-2', 'Host 2');
      roomManager.joinRoom(newRoom.room.code, 'player-4', 'Player 4');

      const game = roomManager.startGame('host-2');
      expect(game).toBeNull();
    });

    it('should return null for non-existent host', () => {
      const game = roomManager.startGame('non-existent');

      expect(game).toBeNull();
    });

    it('should store game for later retrieval', () => {
      roomManager.startGame('host-1');

      const game = roomManager.getGame(roomCode);
      expect(game).toBeDefined();
    });

    it('should update room gameState', () => {
      roomManager.startGame('host-1');

      const room = roomManager.getRoom(roomCode);
      expect(room!.gameState).not.toBeNull();
    });
  });

  describe('getRoom', () => {
    it('should return room by code', () => {
      const created = roomManager.createRoom('host-1', 'Host');
      const room = roomManager.getRoom(created.room.code);

      expect(room).toBeDefined();
      expect(room!.code).toBe(created.room.code);
    });

    it('should return undefined for non-existent room', () => {
      const room = roomManager.getRoom('XXXXX');

      expect(room).toBeUndefined();
    });
  });

  describe('getRoomByPlayerId', () => {
    it('should return room for player', () => {
      const created = roomManager.createRoom('host-1', 'Host');
      const room = roomManager.getRoomByPlayerId('host-1');

      expect(room).toBeDefined();
      expect(room!.code).toBe(created.room.code);
    });

    it('should return room for joined player', () => {
      const created = roomManager.createRoom('host-1', 'Host');
      roomManager.joinRoom(created.room.code, 'player-2', 'Player 2');

      const room = roomManager.getRoomByPlayerId('player-2');
      expect(room).toBeDefined();
      expect(room!.code).toBe(created.room.code);
    });

    it('should return undefined for non-existent player', () => {
      const room = roomManager.getRoomByPlayerId('non-existent');

      expect(room).toBeUndefined();
    });
  });

  describe('getGame', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');
    });

    afterEach(() => {
      const game = roomManager.getGame(roomCode);
      if (game) {
        game.cleanup();
      }
    });

    it('should return undefined before game starts', () => {
      const game = roomManager.getGame(roomCode);

      expect(game).toBeUndefined();
    });

    it('should return game after it starts', () => {
      roomManager.startGame('host-1');
      const game = roomManager.getGame(roomCode);

      expect(game).toBeDefined();
    });
  });

  describe('getGameByPlayerId', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');
    });

    afterEach(() => {
      const game = roomManager.getGame(roomCode);
      if (game) {
        game.cleanup();
      }
    });

    it('should return undefined before game starts', () => {
      const game = roomManager.getGameByPlayerId('host-1');

      expect(game).toBeUndefined();
    });

    it('should return game for player after it starts', () => {
      roomManager.startGame('host-1');
      const game = roomManager.getGameByPlayerId('player-2');

      expect(game).toBeDefined();
    });

    it('should return undefined for non-existent player', () => {
      roomManager.startGame('host-1');
      const game = roomManager.getGameByPlayerId('non-existent');

      expect(game).toBeUndefined();
    });
  });

  describe('reconnect', () => {
    let roomCode: string;
    let reconnectToken: string;

    beforeEach(() => {
      const result = roomManager.createRoom('old-socket-id', 'Host');
      roomCode = result.room.code;
      reconnectToken = result.reconnectToken;
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');
    });

    afterEach(() => {
      const game = roomManager.getGame(roomCode);
      if (game) {
        game.cleanup();
      }
    });

    it('should allow reconnection with valid token', () => {
      const result = roomManager.reconnect(reconnectToken, 'new-socket-id');

      expect(result).not.toBeNull();
      expect(result!.room).toBeDefined();
      expect(result!.oldPlayerId).toBe('old-socket-id');
    });

    it('should update player ID in room', () => {
      roomManager.reconnect(reconnectToken, 'new-socket-id');

      const room = roomManager.getRoom(roomCode);
      const player = room!.players.find((p) => p.id === 'new-socket-id');
      expect(player).toBeDefined();
    });

    it('should mark player as connected', () => {
      // First disconnect the player
      roomManager.playerDisconnected('old-socket-id');

      // Then reconnect
      roomManager.reconnect(reconnectToken, 'new-socket-id');

      const room = roomManager.getRoom(roomCode);
      const player = room!.players.find((p) => p.id === 'new-socket-id');
      expect(player!.isConnected).toBe(true);
    });

    it('should update host ID if host reconnects', () => {
      roomManager.reconnect(reconnectToken, 'new-socket-id');

      const room = roomManager.getRoom(roomCode);
      expect(room!.hostId).toBe('new-socket-id');
    });

    it('should return null for invalid token', () => {
      const result = roomManager.reconnect('invalid-token', 'new-socket-id');

      expect(result).toBeNull();
    });

    it('should return null if room no longer exists', () => {
      // Leave all players to delete room
      roomManager.leaveRoom('old-socket-id');
      roomManager.leaveRoom('player-2');
      roomManager.leaveRoom('player-3');

      const result = roomManager.reconnect(reconnectToken, 'new-socket-id');
      expect(result).toBeNull();
    });

    it('should update game state if game is active', () => {
      roomManager.startGame('old-socket-id');

      const result = roomManager.reconnect(reconnectToken, 'new-socket-id');

      expect(result!.game).toBeDefined();
    });

    it('should update player-to-room mapping', () => {
      roomManager.reconnect(reconnectToken, 'new-socket-id');

      const roomByOldId = roomManager.getRoomByPlayerId('old-socket-id');
      const roomByNewId = roomManager.getRoomByPlayerId('new-socket-id');

      expect(roomByOldId).toBeUndefined();
      expect(roomByNewId).toBeDefined();
    });
  });

  describe('playerDisconnected', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');
    });

    afterEach(() => {
      const game = roomManager.getGame(roomCode);
      if (game) {
        game.cleanup();
      }
    });

    it('should mark player as disconnected', () => {
      roomManager.playerDisconnected('player-2');

      const room = roomManager.getRoom(roomCode);
      const player = room!.players.find((p) => p.id === 'player-2');
      expect(player!.isConnected).toBe(false);
    });

    it('should do nothing for non-existent player', () => {
      // Should not throw
      expect(() => roomManager.playerDisconnected('non-existent')).not.toThrow();
    });

    it('should notify game of disconnect if game is active', () => {
      roomManager.startGame('host-1');
      roomManager.playerDisconnected('player-2');

      const game = roomManager.getGame(roomCode);
      const player = game!.getPlayer('player-2');
      expect(player!.isConnected).toBe(false);
    });
  });

  describe('getPublicRoom', () => {
    it('should return public room data', () => {
      const created = roomManager.createRoom('host-1', 'Host');
      const publicRoom = roomManager.getPublicRoom(created.room.code);

      expect(publicRoom).toBeDefined();
      expect(publicRoom!.code).toBe(created.room.code);
      expect(publicRoom!.hostId).toBe('host-1');
      expect(publicRoom!.players).toBeDefined();
      expect(publicRoom!.settings).toBeDefined();
      expect(publicRoom!.hasActiveGame).toBe(false);
    });

    it('should return undefined for non-existent room', () => {
      const publicRoom = roomManager.getPublicRoom('XXXXX');

      expect(publicRoom).toBeUndefined();
    });

    it('should reflect active game status', () => {
      const created = roomManager.createRoom('host-1', 'Host');
      roomManager.joinRoom(created.room.code, 'player-2', 'Player 2');
      roomManager.joinRoom(created.room.code, 'player-3', 'Player 3');
      roomManager.startGame('host-1');

      const publicRoom = roomManager.getPublicRoom(created.room.code);
      expect(publicRoom!.hasActiveGame).toBe(true);

      // Cleanup
      const game = roomManager.getGame(created.room.code);
      if (game) {
        game.cleanup();
      }
    });
  });

  describe('room code generation', () => {
    it('should not include ambiguous characters', () => {
      // Characters that should not appear: I, O, 0, 1 (L is included per the code)
      const ambiguousChars = /[IO01]/;

      for (let i = 0; i < 20; i++) {
        const result = roomManager.createRoom(`player-${i}`, `Player ${i}`);
        expect(result.room.code).not.toMatch(ambiguousChars);
      }
    });

    it('should generate 5-character codes', () => {
      for (let i = 0; i < 10; i++) {
        const result = roomManager.createRoom(`player-${i}`, `Player ${i}`);
        expect(result.room.code).toHaveLength(5);
      }
    });
  });

  describe('host migration', () => {
    let roomCode: string;

    beforeEach(() => {
      const result = roomManager.createRoom('host-1', 'Host');
      roomCode = result.room.code;
      roomManager.joinRoom(roomCode, 'player-2', 'Player 2');
      roomManager.joinRoom(roomCode, 'player-3', 'Player 3');
    });

    it('should make first remaining player the new host', () => {
      roomManager.leaveRoom('host-1');

      const room = roomManager.getRoom(roomCode);
      expect(room!.hostId).toBe('player-2');
      expect(room!.players.find((p) => p.id === 'player-2')!.isHost).toBe(true);
    });

    it('should update host correctly on successive leaves', () => {
      roomManager.leaveRoom('host-1');
      roomManager.leaveRoom('player-2');

      const room = roomManager.getRoom(roomCode);
      expect(room!.hostId).toBe('player-3');
    });
  });
});
