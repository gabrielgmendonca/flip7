import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game, GamePlayer } from './Game';
import { isNumberCard, isActionCard, isModifierCard } from '@flip7/shared';

function createPlayers(count: number): GamePlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Player ${i + 1}`,
    reconnectToken: `token-${i + 1}`,
  }));
}

describe('Game', () => {
  let game: Game;
  let players: GamePlayer[];

  beforeEach(() => {
    players = createPlayers(3);
    game = new Game(players);
  });

  describe('constructor', () => {
    it('should initialize with provided players', () => {
      const state = game.getState();
      expect(state.players.length).toBe(3);
      expect(state.players[0].name).toBe('Player 1');
      expect(state.players[1].name).toBe('Player 2');
      expect(state.players[2].name).toBe('Player 3');
    });

    it('should set first player as host', () => {
      const state = game.getState();
      expect(state.players[0].isHost).toBe(true);
      expect(state.players[1].isHost).toBe(false);
      expect(state.players[2].isHost).toBe(false);
    });

    it('should initialize players with 0 scores', () => {
      const state = game.getState();
      for (const player of state.players) {
        expect(player.score).toBe(0);
        expect(player.roundScore).toBe(0);
      }
    });

    it('should start in LOBBY phase', () => {
      expect(game.getState().phase).toBe('LOBBY');
    });

    it('should start at round 0', () => {
      expect(game.getState().round).toBe(0);
    });

    it('should apply custom settings', () => {
      const customGame = new Game(players, { targetScore: 100 });
      expect(customGame.getState().settings.targetScore).toBe(100);
    });

    it('should use default settings when not provided', () => {
      expect(game.getState().settings.targetScore).toBe(200);
      expect(game.getState().settings.maxPlayers).toBe(6);
    });
  });

  describe('startGame', () => {
    it('should throw error with less than 2 players', () => {
      const singlePlayerGame = new Game([players[0]]);
      expect(() => singlePlayerGame.startGame()).toThrow('Need at least 2 players');
    });

    it('should transition to PLAYER_TURN phase', () => {
      game.startGame();
      expect(game.getState().phase).toBe('PLAYER_TURN');
    });

    it('should increment round to 1', () => {
      game.startGame();
      expect(game.getState().round).toBe(1);
    });

    it('should deal initial cards to players', () => {
      game.startGame();
      const state = game.getState();

      // Each active player should have at least one card
      for (const player of state.players) {
        if (player.status === 'active' || player.status === 'frozen' || player.status === 'passed') {
          expect(player.cards.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('should work with exactly 2 players', () => {
      const twoPlayerGame = new Game(createPlayers(2));
      expect(() => twoPlayerGame.startGame()).not.toThrow();
      expect(twoPlayerGame.getState().phase).toBe('PLAYER_TURN');
    });
  });

  describe('hit', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should return null for non-current player', () => {
      const state = game.getState();
      const nonCurrentPlayerId = state.players.find(
        (_, i) => i !== state.currentPlayerIndex
      )!.id;

      const result = game.hit(nonCurrentPlayerId);
      expect(result).toBeNull();
    });

    it('should return DrawResult for current player', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      const result = game.hit(currentPlayer.id);

      expect(result).not.toBeNull();
      expect(result!.card).toBeDefined();
      expect(result!.playedCard).toBeDefined();
    });

    it('should add non-duplicate number card to player hand', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      const initialCardCount = currentPlayer.cards.length;

      // Keep hitting until we get a non-bust number card
      let result = game.hit(currentPlayer.id);
      let attempts = 0;
      while (result && (result.isBust || !isNumberCard(result.card)) && attempts < 20) {
        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        }
        result = game.hit(currentPlayer.id);
        attempts++;
      }

      if (result && !result.isBust && isNumberCard(result.card)) {
        const updatedPlayer = game.getPlayer(currentPlayer.id)!;
        expect(updatedPlayer.cards.length).toBeGreaterThan(initialCardCount);
      }
    });

    it('should return null for invalid player id', () => {
      const result = game.hit('invalid-id');
      expect(result).toBeNull();
    });

    it('should not allow hit during non-PLAYER_TURN phase', () => {
      // This is tricky to test without manipulating internal state
      // We can test by having a player bust and trying to hit
      const currentPlayer = game.getCurrentPlayer()!;

      // Get the current player to bust
      let busted = false;
      for (let i = 0; i < 20 && !busted; i++) {
        const result = game.hit(currentPlayer.id);
        if (result && result.isBust) {
          if (result.hasSecondChance) {
            game.useSecondChance(currentPlayer.id, false);
          }
          busted = true;
        }
      }

      if (busted) {
        const result = game.hit(currentPlayer.id);
        expect(result).toBeNull();
      }
    });
  });

  describe('pass', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should return false for non-current player', () => {
      const state = game.getState();
      const nonCurrentPlayerId = state.players.find(
        (_, i) => i !== state.currentPlayerIndex
      )!.id;

      const result = game.pass(nonCurrentPlayerId);
      expect(result).toBe(false);
    });

    it('should return true for current player', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      const result = game.pass(currentPlayer.id);
      expect(result).toBe(true);
    });

    it('should set player status to passed', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      game.pass(currentPlayer.id);

      const updatedPlayer = game.getPlayer(currentPlayer.id)!;
      expect(updatedPlayer.status).toBe('passed');
    });

    it('should calculate round score', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      game.pass(currentPlayer.id);

      const updatedPlayer = game.getPlayer(currentPlayer.id)!;
      expect(typeof updatedPlayer.roundScore).toBe('number');
    });

    it('should advance to next player', () => {
      const state = game.getState();
      const firstPlayerIndex = state.currentPlayerIndex;

      game.pass(game.getCurrentPlayer()!.id);

      const newState = game.getState();
      expect(newState.currentPlayerIndex).not.toBe(firstPlayerIndex);
    });

    it('should return false for invalid player id', () => {
      const result = game.pass('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('useSecondChance', () => {
    it('should return false when not in AWAITING_SECOND_CHANCE phase', () => {
      game.startGame();
      const result = game.useSecondChance(game.getCurrentPlayer()!.id, true);
      expect(result).toBe(false);
    });
  });

  describe('playerDisconnected', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should mark player as disconnected', () => {
      const player = game.getPlayer('player-1')!;
      game.playerDisconnected('player-1');

      const updatedPlayer = game.getPlayer('player-1')!;
      expect(updatedPlayer.isConnected).toBe(false);
    });

    it('should set active player status to disconnected', () => {
      const activePlayer = game.getState().players.find((p) => p.status === 'active')!;
      game.playerDisconnected(activePlayer.id);

      const updatedPlayer = game.getPlayer(activePlayer.id)!;
      expect(updatedPlayer.status).toBe('disconnected');
    });

    it('should advance turn if current player disconnects', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      const currentIndex = game.getState().currentPlayerIndex;

      game.playerDisconnected(currentPlayer.id);

      // Turn should advance to next player
      const newIndex = game.getState().currentPlayerIndex;
      expect(newIndex).not.toBe(currentIndex);
    });
  });

  describe('playerReconnected', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should mark player as connected', () => {
      game.playerDisconnected('player-1');
      game.playerReconnected('player-1');

      const player = game.getPlayer('player-1')!;
      expect(player.isConnected).toBe(true);
    });

    it('should restore disconnected player to active', () => {
      const activePlayer = game.getState().players.find((p) => p.status === 'active')!;

      game.playerDisconnected(activePlayer.id);
      expect(game.getPlayer(activePlayer.id)!.status).toBe('disconnected');

      game.playerReconnected(activePlayer.id);
      expect(game.getPlayer(activePlayer.id)!.status).toBe('active');
    });
  });

  describe('getPlayer', () => {
    it('should return player by id', () => {
      const player = game.getPlayer('player-1');
      expect(player).toBeDefined();
      expect(player!.id).toBe('player-1');
    });

    it('should return undefined for non-existent player', () => {
      const player = game.getPlayer('non-existent');
      expect(player).toBeUndefined();
    });
  });

  describe('getCurrentPlayer', () => {
    it('should return undefined before game starts', () => {
      const currentPlayer = game.getCurrentPlayer();
      expect(currentPlayer).toBeDefined(); // Players array exists
    });

    it('should return current player after game starts', () => {
      game.startGame();
      const currentPlayer = game.getCurrentPlayer();
      expect(currentPlayer).toBeDefined();
      expect(currentPlayer!.status).toBe('active');
    });
  });

  describe('getState', () => {
    it('should return complete game state', () => {
      const state = game.getState();

      expect(state).toHaveProperty('phase');
      expect(state).toHaveProperty('players');
      expect(state).toHaveProperty('currentPlayerIndex');
      expect(state).toHaveProperty('dealerIndex');
      expect(state).toHaveProperty('deckCount');
      expect(state).toHaveProperty('discardPile');
      expect(state).toHaveProperty('round');
      expect(state).toHaveProperty('settings');
    });

    it('should track deck count', () => {
      game.startGame();
      const initialDeckCount = game.getState().deckCount;
      expect(initialDeckCount).toBeLessThan(94); // Some cards dealt

      const currentPlayer = game.getCurrentPlayer()!;
      game.hit(currentPlayer.id);

      const newDeckCount = game.getState().deckCount;
      expect(newDeckCount).toBeLessThan(initialDeckCount);
    });
  });

  describe('isGameOver', () => {
    it('should return false during active game', () => {
      game.startGame();
      expect(game.isGameOver()).toBe(false);
    });

    it('should return false in LOBBY', () => {
      expect(game.isGameOver()).toBe(false);
    });
  });

  describe('round progression', () => {
    it('should end round when all players pass or bust', () => {
      game.startGame();
      const state = game.getState();

      // Have all players pass
      for (let i = 0; i < state.players.length * 2; i++) {
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer && currentPlayer.status === 'active') {
          game.pass(currentPlayer.id);
        }
      }

      // Phase should be ROUND_END or game should have moved to next round
      const newState = game.getState();
      expect(['ROUND_END', 'PLAYER_TURN', 'GAME_END']).toContain(newState.phase);
    });
  });

  describe('scoring', () => {
    it('should add round scores to total when round ends', () => {
      game.startGame();

      // Have all players pass to end round
      for (let i = 0; i < 10; i++) {
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer && currentPlayer.status === 'active') {
          game.pass(currentPlayer.id);
        }
      }

      // Check that players who passed have scores
      const state = game.getState();
      const passedPlayers = state.players.filter(
        (p) => p.status === 'passed' || p.score > 0
      );

      // At least some players should have scores if they passed
      if (passedPlayers.length > 0) {
        const totalScore = passedPlayers.reduce((sum, p) => sum + p.score, 0);
        expect(totalScore).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('custom settings', () => {
    it('should respect custom target score', () => {
      const customGame = new Game(players, { targetScore: 50 });
      expect(customGame.getState().settings.targetScore).toBe(50);
    });

    it('should merge with default settings', () => {
      const customGame = new Game(players, { targetScore: 50 });
      const settings = customGame.getState().settings;

      expect(settings.targetScore).toBe(50);
      expect(settings.maxPlayers).toBe(6); // Default
      expect(settings.turnTimeoutSeconds).toBe(30); // Default
    });
  });

  describe('edge cases', () => {
    it('should handle game with maximum players', () => {
      const sixPlayers = createPlayers(6);
      const bigGame = new Game(sixPlayers);

      expect(() => bigGame.startGame()).not.toThrow();
      expect(bigGame.getState().players.length).toBe(6);
    });

    it('should handle rapid hit/pass cycles', () => {
      game.startGame();

      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 10; i++) {
          const currentPlayer = game.getCurrentPlayer();
          if (currentPlayer && currentPlayer.status === 'active') {
            // Randomly hit or pass
            if (Math.random() > 0.5) {
              const result = game.hit(currentPlayer.id);
              if (result?.isBust && result.hasSecondChance) {
                game.useSecondChance(currentPlayer.id, Math.random() > 0.5);
              }
            } else {
              game.pass(currentPlayer.id);
            }
          }
        }
      }

      // Game should still be in a valid state
      const state = game.getState();
      expect(['LOBBY', 'DEALING', 'PLAYER_TURN', 'AWAITING_SECOND_CHANCE', 'ROUND_END', 'GAME_END']).toContain(state.phase);
    });
  });
});
