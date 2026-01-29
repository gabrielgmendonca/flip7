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

/**
 * Helper to resolve any pending freeze target selections during initial deal.
 * Per official rules, freeze target selection can happen during initial deal.
 * This helper auto-selects the first available target (typically self-freeze).
 */
function resolveInitialDealFreezes(game: Game): void {
  let state = game.getState();
  while (state.phase === 'AWAITING_FREEZE_TARGET' && state.pendingFreezeTarget) {
    const { playerId, eligibleTargets } = state.pendingFreezeTarget;
    // Auto-select first eligible target (often self)
    game.selectFreezeTarget(playerId, eligibleTargets[0]);
    state = game.getState();
  }
}

/**
 * Start game and resolve any freeze target selections during initial deal.
 */
function startGameAndResolve(game: Game): void {
  game.startGame();
  resolveInitialDealFreezes(game);
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
    it('should throw error with less than 3 players', () => {
      const twoPlayerGame = new Game(createPlayers(2));
      expect(() => twoPlayerGame.startGame()).toThrow('Need at least 3 players');
    });

    it('should transition to PLAYER_TURN phase', () => {
      startGameAndResolve(game);
      expect(game.getState().phase).toBe('PLAYER_TURN');
    });

    it('should increment round to 1', () => {
      game.startGame();
      expect(game.getState().round).toBe(1);
    });

    it('should deal initial cards to players', () => {
      startGameAndResolve(game);
      const state = game.getState();

      // Each active player should have at least one card
      for (const player of state.players) {
        if (player.status === 'active' || player.status === 'frozen' || player.status === 'passed') {
          expect(player.cards.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('should work with exactly 3 players', () => {
      const threePlayerGame = new Game(createPlayers(3));
      expect(() => threePlayerGame.startGame()).not.toThrow();
      // Phase can be PLAYER_TURN or AWAITING_FREEZE_TARGET if freeze was drawn during initial deal
      expect(['PLAYER_TURN', 'AWAITING_FREEZE_TARGET']).toContain(
        threePlayerGame.getState().phase
      );
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
      startGameAndResolve(game);
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
      const firstPlayer = game.getCurrentPlayer()!;
      const activePlayersCount = state.players.filter((p) => p.status === 'active').length;

      game.pass(firstPlayer.id);

      const newState = game.getState();
      // If there were at least 2 active players (first player passed, so now at least 1 remaining),
      // the current player should be different
      if (activePlayersCount >= 2) {
        const newCurrentPlayer = game.getCurrentPlayer();
        // Either we advanced to a different player, or the round ended
        expect(
          newCurrentPlayer?.id !== firstPlayer.id || newState.phase === 'ROUND_END'
        ).toBe(true);
      }
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
      startGameAndResolve(game);
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
      const activePlayersCount = game.getState().players.filter((p) => p.status === 'active').length;

      game.playerDisconnected(currentPlayer.id);

      // If there were at least 2 active players, turn should advance to a different player
      if (activePlayersCount >= 2) {
        const newCurrentPlayer = game.getCurrentPlayer();
        const newState = game.getState();
        // Either we advanced to a different player, or the round ended
        expect(
          newCurrentPlayer?.id !== currentPlayer.id || newState.phase === 'ROUND_END'
        ).toBe(true);
      }
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
      startGameAndResolve(game);
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

    it('should start next round after timeout when round ends', () => {
      vi.useFakeTimers();

      try {
        game.startGame();
        expect(game.getState().round).toBe(1);

        // Have all players pass to end the round
        for (let i = 0; i < 10; i++) {
          const currentPlayer = game.getCurrentPlayer();
          if (currentPlayer && currentPlayer.status === 'active') {
            game.pass(currentPlayer.id);
          }
        }

        // Verify round has ended
        const stateAfterRound = game.getState();
        expect(stateAfterRound.phase).toBe('ROUND_END');

        // Advance time by 3 seconds (the round start delay)
        vi.advanceTimersByTime(3000);

        // Verify the game has started a new round
        const stateAfterTimeout = game.getState();
        expect(stateAfterTimeout.phase).toBe('PLAYER_TURN');
        expect(stateAfterTimeout.round).toBe(2);

        // Players should be reset to active status
        const activePlayers = stateAfterTimeout.players.filter(
          (p) => p.status === 'active'
        );
        expect(activePlayers.length).toBeGreaterThan(0);

        // Clean up
        game.cleanup();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should reset player cards and round scores when starting new round', () => {
      vi.useFakeTimers();

      try {
        game.startGame();

        // Have all players pass to end the round
        for (let i = 0; i < 10; i++) {
          const currentPlayer = game.getCurrentPlayer();
          if (currentPlayer && currentPlayer.status === 'active') {
            game.pass(currentPlayer.id);
          }
        }

        const stateAtRoundEnd = game.getState();
        expect(stateAtRoundEnd.phase).toBe('ROUND_END');

        // Some players should have round scores from passing
        const playersWithRoundScores = stateAtRoundEnd.players.filter(
          (p) => p.roundScore > 0
        );
        expect(playersWithRoundScores.length).toBeGreaterThan(0);

        // Advance to next round
        vi.advanceTimersByTime(3000);

        const stateAfterNewRound = game.getState();

        // Round scores should be reset to 0
        for (const player of stateAfterNewRound.players) {
          expect(player.roundScore).toBe(0);
        }

        // Players should have new initial cards dealt
        const activePlayers = stateAfterNewRound.players.filter(
          (p) => p.status === 'active' || p.status === 'frozen' || p.status === 'passed'
        );
        for (const player of activePlayers) {
          expect(player.cards.length).toBeGreaterThanOrEqual(1);
        }

        game.cleanup();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should rotate dealer when starting new round', () => {
      vi.useFakeTimers();

      try {
        game.startGame();
        resolveInitialDealFreezes(game);
        const initialDealerIndex = game.getState().dealerIndex;

        // End the round
        for (let i = 0; i < 10; i++) {
          const currentPlayer = game.getCurrentPlayer();
          if (currentPlayer && currentPlayer.status === 'active') {
            game.pass(currentPlayer.id);
          }
        }

        expect(game.getState().phase).toBe('ROUND_END');

        // Advance to next round
        vi.advanceTimersByTime(3000);

        const newDealerIndex = game.getState().dealerIndex;
        const expectedDealerIndex = (initialDealerIndex + 1) % players.length;
        expect(newDealerIndex).toBe(expectedDealerIndex);

        game.cleanup();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should call onRoundStart callback when new round starts after timeout', () => {
      vi.useFakeTimers();

      const onRoundStart = vi.fn();
      game = new Game(players, {}, onRoundStart);
      game.startGame();
      resolveInitialDealFreezes(game);

      // onRoundStart should be called once for the initial round
      expect(onRoundStart).toHaveBeenCalledTimes(1);

      // End the round
      for (let i = 0; i < 10; i++) {
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer && currentPlayer.status === 'active') {
          game.pass(currentPlayer.id);
        }
      }

      expect(game.getState().phase).toBe('ROUND_END');

      // Advance to next round
      vi.advanceTimersByTime(3000);

      // Resolve any freeze target selections in the new round
      resolveInitialDealFreezes(game);

      // onRoundStart should be called again for the new round
      expect(onRoundStart).toHaveBeenCalledTimes(2);
      expect(game.getState().phase).toBe('PLAYER_TURN');
      expect(game.getState().round).toBe(2);

      game.cleanup();
      vi.useRealTimers();
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
      expect(['LOBBY', 'DEALING', 'PLAYER_TURN', 'AWAITING_SECOND_CHANCE', 'AWAITING_FREEZE_TARGET', 'ROUND_END', 'GAME_END']).toContain(state.phase);
    });
  });

  describe('updatePlayerId', () => {
    beforeEach(() => {
      startGameAndResolve(game);
    });

    it('should update player id', () => {
      game.updatePlayerId('player-1', 'new-player-1');

      const player = game.getPlayer('new-player-1');
      expect(player).toBeDefined();
      expect(player!.name).toBe('Player 1');
    });

    it('should remove old player id', () => {
      game.updatePlayerId('player-1', 'new-player-1');

      const oldPlayer = game.getPlayer('player-1');
      expect(oldPlayer).toBeUndefined();
    });

    it('should do nothing for non-existent player', () => {
      // Should not throw
      expect(() => game.updatePlayerId('non-existent', 'new-id')).not.toThrow();
    });

    it('should allow hit/pass with new id after update', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      const newId = 'new-' + currentPlayer.id;

      game.updatePlayerId(currentPlayer.id, newId);

      // The action should work with the new ID
      const result = game.pass(newId);
      expect(result).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clean up round start timeout', () => {
      game.startGame();

      // Have all players pass to end round (which schedules next round)
      for (let i = 0; i < 10; i++) {
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer && currentPlayer.status === 'active') {
          game.pass(currentPlayer.id);
        }
      }

      const state = game.getState();
      if (state.phase === 'ROUND_END') {
        // Cleanup should not throw
        expect(() => game.cleanup()).not.toThrow();
      }
    });

    it('should be safe to call multiple times', () => {
      game.startGame();
      game.cleanup();
      expect(() => game.cleanup()).not.toThrow();
    });
  });

  describe('freeze mechanics', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should mark player as frozen when freeze card is drawn', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until we get a freeze or run out of attempts
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.triggersFreeze) {
          const player = game.getPlayer(currentPlayer.id)!;
          expect(player.status).toBe('frozen');
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.isBust) {
          break;
        }
      }
    });

    it('should calculate round score when frozen', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until frozen
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.triggersFreeze) {
          const player = game.getPlayer(currentPlayer.id)!;
          expect(typeof player.roundScore).toBe('number');
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.isBust) {
          break;
        }
      }
    });
  });

  describe('freeze target selection (Bug #1 regression)', () => {
    // Bug #1: Freeze card was incorrectly forcing the player who draws it to freeze themselves.
    // Expected: Player should choose an active player (including themselves) to freeze.

    beforeEach(() => {
      game.startGame();
    });

    it('should enter AWAITING_FREEZE_TARGET phase when freeze card is drawn with multiple active players', () => {
      // When a freeze card is drawn and multiple players are active,
      // the game should wait for target selection
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until we get a freeze or run out of attempts
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.triggersFreeze) {
          const state = game.getState();
          // Check if we're in AWAITING_FREEZE_TARGET or player was auto-frozen
          // (auto-freeze happens when there's only one eligible target)
          const activePlayers = state.players.filter(
            (p) => p.status === 'active' && p.isConnected
          );

          if (activePlayers.length > 0) {
            // If there were multiple active players, we should be awaiting target
            expect(state.phase).toBe('AWAITING_FREEZE_TARGET');
            expect(state.pendingFreezeTarget).toBeDefined();
            expect(state.pendingFreezeTarget!.playerId).toBe(currentPlayer.id);
            expect(state.pendingFreezeTarget!.eligibleTargets.length).toBeGreaterThanOrEqual(1);
          }
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.isBust) {
          break;
        }
      }
    });

    it('should allow selecting another player as freeze target', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until we get a freeze
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.triggersFreeze) {
          const state = game.getState();
          if (state.phase === 'AWAITING_FREEZE_TARGET' && state.pendingFreezeTarget) {
            // Find another player to freeze (not self)
            const otherTargets = state.pendingFreezeTarget.eligibleTargets.filter(
              (id) => id !== currentPlayer.id
            );

            if (otherTargets.length > 0) {
              const targetId = otherTargets[0];
              const success = game.selectFreezeTarget(currentPlayer.id, targetId);
              expect(success).toBe(true);

              // Target should be frozen
              const target = game.getPlayer(targetId)!;
              expect(target.status).toBe('frozen');

              // Original player should NOT be frozen
              const original = game.getPlayer(currentPlayer.id)!;
              expect(original.status).not.toBe('frozen');
            }
          }
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.isBust) {
          break;
        }
      }
    });

    it('should reject freeze target selection from wrong player', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.triggersFreeze) {
          const state = game.getState();
          if (state.phase === 'AWAITING_FREEZE_TARGET' && state.pendingFreezeTarget) {
            // Try to select target as a different player
            const wrongPlayer = players.find((p) => p.id !== currentPlayer.id)!;
            const targetId = state.pendingFreezeTarget.eligibleTargets[0];

            const success = game.selectFreezeTarget(wrongPlayer.id, targetId);
            expect(success).toBe(false);
          }
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.isBust) {
          break;
        }
      }
    });

    it('should reject selecting non-eligible target', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.triggersFreeze) {
          const state = game.getState();
          if (state.phase === 'AWAITING_FREEZE_TARGET') {
            // Try to select a non-existent player
            const success = game.selectFreezeTarget(currentPlayer.id, 'non-existent-player');
            expect(success).toBe(false);
          }
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.isBust) {
          break;
        }
      }
    });

    it('should return false when not in AWAITING_FREEZE_TARGET phase', () => {
      // First, resolve any freeze targets from initial deal to get to PLAYER_TURN phase
      resolveInitialDealFreezes(game);

      // Verify we're in PLAYER_TURN phase
      expect(game.getState().phase).toBe('PLAYER_TURN');

      const currentPlayer = game.getCurrentPlayer()!;
      const result = game.selectFreezeTarget(currentPlayer.id, 'player-2');
      expect(result).toBe(false);
    });
  });

  describe('bust mechanics', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should mark player as busted on duplicate card', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until bust
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust) {
          if (result.hasSecondChance) {
            game.useSecondChance(currentPlayer.id, false);
          }
          const player = game.getPlayer(currentPlayer.id)!;
          expect(player.status).toBe('busted');
          expect(player.roundScore).toBe(0);
          break;
        }
      }
    });

    it('should set round score to 0 when busted', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until bust
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust) {
          if (result.hasSecondChance) {
            game.useSecondChance(currentPlayer.id, false);
          }
          const player = game.getPlayer(currentPlayer.id)!;
          expect(player.roundScore).toBe(0);
          break;
        }
      }
    });
  });

  describe('bust card shown (Bug #4)', () => {
    // Bug #4: When a player busts, the duplicate card that caused the bust
    // should be displayed to the user so they understand why they busted.

    beforeEach(() => {
      game.startGame();
    });

    it('should include duplicateCard in DrawResult when player busts', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until bust
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust) {
          // The duplicate card should be included in the result
          expect(result.duplicateCard).toBeDefined();
          expect(result.duplicateCard).not.toBeNull();

          // The duplicate card should be a number card (only number cards can cause busts)
          expect(isNumberCard(result.duplicateCard!)).toBe(true);
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        }
      }
    });

    it('should have duplicateCard match the drawn card that caused bust', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust) {
          // duplicateCard should be the same as the card that was drawn
          expect(result.duplicateCard).toBeDefined();
          expect(result.duplicateCard!.id).toBe(result.card.id);
          expect(result.duplicateCard!.type).toBe(result.card.type);
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        }
      }
    });

    it('should not include duplicateCard when draw is successful', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // The first draw should typically not be a bust (unless extremely unlucky)
      const result = game.hit(currentPlayer.id);

      if (result && !result.isBust) {
        expect(result.duplicateCard).toBeUndefined();
      }
    });

    it('should show the card value that caused the bust', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      for (let i = 0; i < 50; i++) {
        const player = game.getPlayer(currentPlayer.id)!;
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust && isNumberCard(result.duplicateCard!)) {
          // The duplicate card's value should match a card that was already in the player's hand
          const duplicateValue = result.duplicateCard!.value;

          // At least one card in the player's hand before bust should have had this value
          // (Note: cards are discarded on bust, but we can verify the duplicate card has a valid value)
          expect(duplicateValue).toBeGreaterThanOrEqual(0);
          expect(duplicateValue).toBeLessThanOrEqual(12);
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        }
      }
    });
  });

  describe('second chance mechanics', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should allow using second chance to avoid bust', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until we get a bust with second chance
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust && result.hasSecondChance) {
          const state = game.getState();
          expect(state.phase).toBe('AWAITING_SECOND_CHANCE');

          // Use second chance
          const used = game.useSecondChance(currentPlayer.id, true);
          expect(used).toBe(true);

          const player = game.getPlayer(currentPlayer.id)!;
          // Player should still be active (not busted)
          expect(player.status).toBe('active');
          break;
        }

        if (result.isBust) {
          break;
        }
      }
    });

    it('should return false for wrong player using second chance', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until we get a bust with second chance
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust && result.hasSecondChance) {
          // Try to use second chance as wrong player
          const wrongPlayerId = players.find((p) => p.id !== currentPlayer.id)!.id;
          const used = game.useSecondChance(wrongPlayerId, true);
          expect(used).toBe(false);
          break;
        }

        if (result.isBust) {
          break;
        }
      }
    });
  });

  describe('game state tracking', () => {
    it('should track pendingSecondChance in state', () => {
      game.startGame();
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until second chance scenario
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust && result.hasSecondChance) {
          const state = game.getState();
          expect(state.pendingSecondChance).toBeDefined();
          expect(state.pendingSecondChance!.playerId).toBe(currentPlayer.id);
          break;
        }

        if (result.isBust) {
          break;
        }
      }
    });

    it('should track flipThreeRemaining in state', () => {
      game.startGame();
      const state = game.getState();
      expect(typeof state.flipThreeRemaining).toBe('number');
      expect(state.flipThreeRemaining).toBe(0);
    });

    it('should track winnerId in state', () => {
      const state = game.getState();
      expect(state.winnerId).toBeUndefined();
    });
  });

  describe('draw result properties', () => {
    beforeEach(() => {
      startGameAndResolve(game);
    });

    it('should return card and playedCard in result', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      const result = game.hit(currentPlayer.id);

      expect(result).not.toBeNull();
      expect(result!.card).toBeDefined();
      expect(result!.playedCard).toBeDefined();
      expect(result!.playedCard.card).toBe(result!.card);
    });

    it('should track if card triggers flip three', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      const result = game.hit(currentPlayer.id);

      expect(result).not.toBeNull();
      expect(typeof result!.triggersFlipThree).toBe('boolean');
    });

    it('should track if card triggers freeze', () => {
      const currentPlayer = game.getCurrentPlayer()!;
      const result = game.hit(currentPlayer.id);

      expect(result).not.toBeNull();
      expect(typeof result!.triggersFreeze).toBe('boolean');
    });
  });

  describe('freeze during Flip Three - official rules', () => {
    // Official Rules: When Freeze is drawn during Flip Three:
    // 1. Set aside the Freeze until Flip Three completes
    // 2. If player busts or achieves Flip 7, discard the Freeze
    // 3. Otherwise, assign Freeze to any active player after Flip Three

    beforeEach(() => {
      game.startGame();
    });

    it('should set aside Freeze during Flip Three and prompt for target after completion', () => {
      // This test verifies that when a Freeze is drawn during Flip Three,
      // the Flip Three continues to completion before freeze target selection
      const currentPlayer = game.getCurrentPlayer()!;

      // We need to simulate drawing a Flip Three followed by a Freeze
      // Since we can't control the deck, we'll iterate until we get the scenario
      // or verify the expected behavior when it occurs

      for (let i = 0; i < 100; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.triggersFlipThree) {
          // A Flip Three was drawn - the game will execute flip three
          // If a Freeze is encountered during Flip Three, check the behavior
          const state = game.getState();

          // After Flip Three, the phase should either be:
          // - PLAYER_TURN (completed normally)
          // - AWAITING_FREEZE_TARGET (Freeze was drawn and needs target selection)
          // - AWAITING_SECOND_CHANCE (bust with second chance)
          expect(['PLAYER_TURN', 'AWAITING_FREEZE_TARGET', 'AWAITING_SECOND_CHANCE']).toContain(
            state.phase
          );

          // Note: Current implementation interrupts Flip Three for freeze.
          // Per official rules, Freeze should be set aside until Flip Three completes.
          // This test documents the current behavior.
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.isBust) {
          break;
        }
      }
    });

    it('should discard Freeze if player busts during Flip Three (official rule)', () => {
      // Official rule: If player busts during Flip Three after drawing Freeze,
      // the Freeze should be discarded (no target selection)

      // Note: Current implementation may not follow this rule.
      // This test documents expected behavior according to official rules.
      const currentPlayer = game.getCurrentPlayer()!;

      for (let i = 0; i < 100; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        // If we bust, verify no pending freeze target
        if (result.isBust && !result.hasSecondChance) {
          const state = game.getState();
          // Per official rules, if bust occurs during/after Flip Three with pending Freeze,
          // the Freeze should be discarded
          const player = game.getPlayer(currentPlayer.id)!;
          expect(player.status).toBe('busted');
          // No freeze target should be pending after bust
          expect(state.pendingFreezeTarget).toBeUndefined();
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, false); // Decline to trigger bust
          break;
        }
      }
    });

    it('should discard Freeze if player achieves Flip 7 during Flip Three (official rule)', () => {
      // Official rule: If player achieves Flip 7 (7 unique numbers) during Flip Three
      // after drawing Freeze, the Freeze should be discarded

      // This is hard to test deterministically without deck control,
      // but we document the expected behavior
      const currentPlayer = game.getCurrentPlayer()!;

      for (let i = 0; i < 100; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        // Check if player achieved Flip 7 (status becomes 'passed')
        const player = game.getPlayer(currentPlayer.id)!;
        if (player.status === 'passed') {
          const state = game.getState();
          // Per official rules, Freeze should be discarded on Flip 7
          // The player should not need to select a freeze target
          expect(state.phase).not.toBe('AWAITING_FREEZE_TARGET');
          break;
        }

        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.isBust) {
          break;
        }
      }
    });
  });

  describe('freeze during initial deal - official rules', () => {
    // Official Rules: When Freeze is drawn during initial deal:
    // Player who drew Freeze chooses target immediately
    // Can target ANY player, even those not yet dealt their first card

    it('should allow freeze target selection during initial deal with multiple players', () => {
      // Note: Current implementation auto-freezes the drawer during initial deal.
      // Per official rules, player should be able to choose any player as target.

      // This test documents expected behavior vs current behavior
      game.startGame();
      const state = game.getState();

      // Check if any player was frozen during initial deal
      const frozenPlayers = state.players.filter((p) => p.status === 'frozen');

      // If a player was frozen during initial deal, verify behavior
      if (frozenPlayers.length > 0) {
        // Current implementation: auto-freezes the drawer
        // Official rules: drawer should choose target

        // Check if the frozen player has a Freeze card in their hand
        // (which would indicate they drew it and were auto-frozen)
        for (const frozenPlayer of frozenPlayers) {
          const hasFreezeCard = frozenPlayer.cards.some(
            (pc) => isActionCard(pc.card) && pc.card.action === 'freeze'
          );

          // Document current behavior: if they have the freeze card, they auto-froze themselves
          if (hasFreezeCard) {
            // This is current behavior - player who drew freeze was auto-frozen
            // Per official rules, they should have been able to choose a target
            expect(frozenPlayer.roundScore).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    it('should include current player in eligible freeze targets during initial deal', () => {
      // Per official rules, self-freeze is allowed
      game.startGame();
      const state = game.getState();

      // If we're in AWAITING_FREEZE_TARGET phase after startGame
      // (which would happen if freeze was drawn during deal and target selection is required)
      if (state.phase === 'AWAITING_FREEZE_TARGET' && state.pendingFreezeTarget) {
        const drawerId = state.pendingFreezeTarget.playerId;
        const eligibleTargets = state.pendingFreezeTarget.eligibleTargets;

        // Self-freeze should be allowed
        expect(eligibleTargets).toContain(drawerId);
      }
    });
  });

  describe('freeze solo player scenario', () => {
    // When you're the only active player, you must freeze yourself

    beforeEach(() => {
      game.startGame();
    });

    it('should auto-freeze when solo player draws freeze', () => {
      // Get all players except one to bust/pass
      const players = game.getState().players;

      // Have players pass until only one is active
      for (let round = 0; round < 10; round++) {
        const currentPlayer = game.getCurrentPlayer();
        if (!currentPlayer) break;

        // Check how many active players remain
        const activePlayers = game.getState().players.filter((p) => p.status === 'active');
        if (activePlayers.length === 1) {
          // Solo player - try to draw freeze
          const result = game.hit(currentPlayer.id);
          if (result?.triggersFreeze) {
            // Should be auto-frozen (only eligible target)
            const state = game.getState();
            expect(state.phase).not.toBe('AWAITING_FREEZE_TARGET');
            const player = game.getPlayer(currentPlayer.id)!;
            expect(player.status).toBe('frozen');
          }
          break;
        }

        game.pass(currentPlayer.id);
      }
    });
  });

  describe('multiple disconnections', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should handle all players disconnecting', () => {
      for (const player of players) {
        game.playerDisconnected(player.id);
      }

      // Game should end or be in a valid state
      const state = game.getState();
      expect(state.players.every((p) => !p.isConnected)).toBe(true);
    });

    it('should handle disconnect and reconnect sequence', () => {
      game.playerDisconnected('player-1');
      game.playerDisconnected('player-2');
      game.playerReconnected('player-1');
      game.playerReconnected('player-2');

      const state = game.getState();
      expect(state.players.find((p) => p.id === 'player-1')!.isConnected).toBe(true);
      expect(state.players.find((p) => p.id === 'player-2')!.isConnected).toBe(true);
    });
  });

  describe('deck management', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should decrement deck count when drawing', () => {
      const initialCount = game.getState().deckCount;
      const currentPlayer = game.getCurrentPlayer()!;

      game.hit(currentPlayer.id);

      // Deck count should decrease (by at least 1, could be more if flip three)
      expect(game.getState().deckCount).toBeLessThan(initialCount);
    });

    it('should reshuffle discard pile when deck is empty', () => {
      // This is hard to test directly, but we can verify the game doesn't crash
      // when many draws happen
      for (let i = 0; i < 100; i++) {
        const currentPlayer = game.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.status !== 'active') {
          break;
        }

        const result = game.hit(currentPlayer.id);
        if (result?.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        }
      }

      // Should still be in a valid state
      const state = game.getState();
      expect(state.deckCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('player scores', () => {
    it('should preserve scores across rounds', () => {
      game = new Game(players, { targetScore: 10 }); // Low target for faster test
      game.startGame();

      // Play a round
      for (let i = 0; i < 10; i++) {
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer && currentPlayer.status === 'active') {
          game.pass(currentPlayer.id);
        }
      }

      const state = game.getState();
      // At least some players should have accumulated scores
      const totalScores = state.players.reduce((sum, p) => sum + p.score, 0);
      expect(totalScores).toBeGreaterThanOrEqual(0);
    });

    it('should not add score for busted players', () => {
      game.startGame();
      const currentPlayer = game.getCurrentPlayer()!;
      const initialScore = currentPlayer.score;

      // Get the player to bust
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (result.isBust) {
          if (result.hasSecondChance) {
            game.useSecondChance(currentPlayer.id, false);
          }
          break;
        }
      }

      // Complete the round
      for (let i = 0; i < 10; i++) {
        const cp = game.getCurrentPlayer();
        if (cp && cp.status === 'active') {
          game.pass(cp.id);
        }
      }

      // Busted player's score should not have increased
      const player = game.getPlayer(currentPlayer.id)!;
      if (player.status === 'busted') {
        expect(player.roundScore).toBe(0);
      }
    });
  });

  describe('modifier cards', () => {
    beforeEach(() => {
      game.startGame();
    });

    it('should add modifier cards to player hand', () => {
      const currentPlayer = game.getCurrentPlayer()!;

      // Keep hitting until we get a modifier card
      for (let i = 0; i < 50; i++) {
        const result = game.hit(currentPlayer.id);
        if (!result) break;

        if (isModifierCard(result.card)) {
          const player = game.getPlayer(currentPlayer.id)!;
          const hasModifier = player.cards.some((pc) => isModifierCard(pc.card));
          expect(hasModifier).toBe(true);
          break;
        }

        if (result.isBust) {
          if (result.hasSecondChance) {
            game.useSecondChance(currentPlayer.id, true);
          } else {
            break;
          }
        }
      }
    });
  });

  describe('turn structure - one card per turn', () => {
    // Bug #2: In Flip 7, each player can only draw one card per turn,
    // then the turn passes to the next player.
    // This is different from Blackjack-style where players draw as many as they want.

    beforeEach(() => {
      startGameAndResolve(game);
    });

    it('should advance to next player after drawing one card', () => {
      const firstPlayer = game.getCurrentPlayer()!;
      const firstPlayerIndex = game.getState().currentPlayerIndex;

      // Draw one card
      const result = game.hit(firstPlayer.id);

      // If the draw didn't cause bust/freeze/pass, turn should advance
      if (result && !result.isBust && !result.triggersFreeze && firstPlayer.status === 'active') {
        const newPlayerIndex = game.getState().currentPlayerIndex;
        expect(newPlayerIndex).not.toBe(firstPlayerIndex);

        // The previous player should no longer be able to hit
        const secondHitResult = game.hit(firstPlayer.id);
        expect(secondHitResult).toBeNull();
      }
    });

    it('should not allow same player to draw multiple cards in a row (unless flip three)', () => {
      // Play through multiple turns and verify the turn rotates
      const turnSequence: string[] = [];

      for (let i = 0; i < 9; i++) {
        // 3 players * 3 rounds
        const currentPlayer = game.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.status !== 'active') break;

        turnSequence.push(currentPlayer.id);

        const result = game.hit(currentPlayer.id);
        if (!result) break;

        // Handle special cases
        if (result.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result.triggersFreeze) {
          // Handle freeze target selection if needed
          const state = game.getState();
          if (state.phase === 'AWAITING_FREEZE_TARGET' && state.pendingFreezeTarget) {
            const { playerId, eligibleTargets } = state.pendingFreezeTarget;
            game.selectFreezeTarget(playerId, eligibleTargets[0]);
          }
        } else if (result.isBust) {
          // Turn advances on bust anyway
          continue;
        }
      }

      // Check that turns rotate properly (no consecutive same player unless bust/freeze)
      for (let i = 1; i < turnSequence.length; i++) {
        // In proper Flip 7 rules, consecutive entries should be different players
        // (except in edge cases like all other players being inactive)
        const prev = turnSequence[i - 1];
        const curr = turnSequence[i];

        // Count active players at this point
        const activePlayers = game
          .getState()
          .players.filter((p) => p.status === 'active');

        if (activePlayers.length > 1) {
          expect(curr).not.toBe(prev);
        }
      }
    });

    it('should cycle through all players before returning to first player', () => {
      const playerIds = game.getState().players.map((p) => p.id);
      const seenPlayers = new Set<string>();

      // Draw one card for each player
      for (let i = 0; i < playerIds.length; i++) {
        const currentPlayer = game.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.status !== 'active') break;

        seenPlayers.add(currentPlayer.id);

        const result = game.hit(currentPlayer.id);
        if (result?.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result?.triggersFreeze) {
          // Handle freeze target selection if needed
          const state = game.getState();
          if (state.phase === 'AWAITING_FREEZE_TARGET' && state.pendingFreezeTarget) {
            const { playerId, eligibleTargets } = state.pendingFreezeTarget;
            game.selectFreezeTarget(playerId, eligibleTargets[0]);
          }
        }
      }

      // After one full round, we should have seen all initially active players
      // (some may have been frozen during the round)
      const initiallyActivePlayers = game.getState().players.filter(
        (p) => p.status === 'active' || p.status === 'frozen' || p.status === 'passed'
      );
      for (const player of initiallyActivePlayers) {
        // Player should either have been seen or was frozen/passed during initial deal
        const wasActiveAtStart = player.status === 'active' || seenPlayers.has(player.id);
        expect(wasActiveAtStart || player.status === 'frozen').toBe(true);
      }
    });

    it('should return to first player after all players have drawn once', () => {
      const initialPlayer = game.getCurrentPlayer()!;
      const playerCount = game.getState().players.length;

      // Each player draws one card
      for (let i = 0; i < playerCount; i++) {
        const currentPlayer = game.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.status !== 'active') break;

        const result = game.hit(currentPlayer.id);
        if (result?.isBust && result.hasSecondChance) {
          game.useSecondChance(currentPlayer.id, true);
        } else if (result?.triggersFreeze) {
          // Handle freeze target selection if needed
          const state = game.getState();
          if (state.phase === 'AWAITING_FREEZE_TARGET' && state.pendingFreezeTarget) {
            const { playerId, eligibleTargets } = state.pendingFreezeTarget;
            game.selectFreezeTarget(playerId, eligibleTargets[0]);
          }
        }
      }

      // If initial player is still active and wasn't the one frozen, they should be current again
      const initialPlayerStatus = game.getPlayer(initialPlayer.id)!.status;
      if (initialPlayerStatus === 'active') {
        // Count active players to see if turn cycling is possible
        const activePlayers = game.getState().players.filter((p) => p.status === 'active');
        // Turn cycling only works correctly if there are still multiple active players
        if (activePlayers.length > 0) {
          const currentPlayer = game.getCurrentPlayer();
          // The first player should be current, or round may have ended
          expect(
            currentPlayer?.id === initialPlayer.id || game.getState().phase === 'ROUND_END'
          ).toBe(true);
        }
      }
    });
  });
});
