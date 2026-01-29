import {
  Card,
  PlayedCard,
  Player,
  GameState,
  GamePhase,
  GameSettings,
  DEFAULT_GAME_SETTINGS,
  isNumberCard,
  isActionCard,
  isModifierCard,
  ModifierCard,
} from '@flip7/shared';
import { Deck } from './Deck';
import { v4 as uuidv4 } from 'uuid';

export interface GamePlayer {
  id: string;
  name: string;
  reconnectToken: string;
}

export interface DrawResult {
  card: Card;
  playedCard: PlayedCard;
  isBust: boolean;
  duplicateCard?: Card;
  triggersFlipThree: boolean;
  triggersFreeze: boolean;
  hasSecondChance: boolean;
  extraSecondChance?: Card; // Second Chance card to give away (player already has one)
}

export class Game {
  private deck: Deck;
  private discardPile: Card[] = [];
  private players: Player[] = [];
  private phase: GamePhase = 'LOBBY';
  private currentPlayerIndex: number = 0;
  private dealerIndex: number = 0;
  private round: number = 0;
  private settings: GameSettings;
  private pendingSecondChance?: {
    playerId: string;
    duplicateCard: Card;
  };
  private pendingFreezeTarget?: {
    playerId: string;
    eligibleTargets: string[];
  };
  private pendingFlipThreeFreeze?: {
    playerId: string;
  };
  private pendingDealIndex?: number; // Track where we are in initial deal when paused for freeze
  private flipThreeRemaining: number = 0;
  private winnerId?: string;
  private roundStartTimeout?: ReturnType<typeof setTimeout>;
  private onRoundStart?: () => void;

  constructor(
    gamePlayers: GamePlayer[],
    settings: Partial<GameSettings> = {},
    onRoundStart?: () => void
  ) {
    this.settings = { ...DEFAULT_GAME_SETTINGS, ...settings };
    this.deck = new Deck();
    this.onRoundStart = onRoundStart;

    this.players = gamePlayers.map((gp, index) => ({
      id: gp.id,
      name: gp.name,
      score: 0,
      roundScore: 0,
      cards: [],
      status: 'active',
      isHost: index === 0,
      isConnected: true,
      reconnectToken: gp.reconnectToken,
    }));
  }

  startGame(debugMode: boolean = false): void {
    if (!debugMode && this.players.length < 3) {
      throw new Error('Need at least 3 players to start');
    }

    this.dealerIndex = Math.floor(Math.random() * this.players.length);
    this.startNewRound();
  }

  private startNewRound(): void {
    this.round++;
    this.deck.reset();
    this.discardPile = [];
    this.pendingSecondChance = undefined;
    this.pendingFreezeTarget = undefined;
    this.pendingFlipThreeFreeze = undefined;
    this.pendingDealIndex = undefined;
    this.flipThreeRemaining = 0;

    // Reset player states for new round
    for (const player of this.players) {
      player.cards = [];
      player.roundScore = 0;
      player.status = player.isConnected ? 'active' : 'disconnected';
    }

    // Deal one card to each player
    // Per rules: if action cards come up during initial deal, resolve them immediately
    this.phase = 'DEALING';
    this.continueInitialDeal(0);
  }

  /**
   * Continue the initial deal from a given player index.
   * Can be paused for freeze target selection and resumed later.
   */
  private continueInitialDeal(startIndex: number): void {
    for (let i = startIndex; i < this.players.length; i++) {
      const player = this.players[i];
      if (player.status === 'active') {
        const pausedForFreeze = this.dealInitialCard(player, i);
        if (pausedForFreeze) {
          // Freeze target selection needed - pause deal and wait
          return;
        }
      }
    }

    // Deal complete - start the game
    this.finishInitialDeal();
  }

  /**
   * Finish the initial deal and start player turns.
   */
  private finishInitialDeal(): void {
    this.pendingDealIndex = undefined;

    // Start with player after dealer
    this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
    this.skipInactivePlayers();
    this.phase = 'PLAYER_TURN';

    // Notify listeners that a new round has started
    this.onRoundStart?.();
  }

  /**
   * Deal initial card(s) to a player.
   * Returns true if we need to pause for freeze target selection.
   */
  private dealInitialCard(player: Player, playerIndex: number): boolean {
    // Keep dealing until player has a non-action card (or gets frozen/busted)
    // Per rules: action cards during initial deal are resolved immediately
    let needsCard = true;

    while (needsCard && player.status === 'active') {
      const result = this.dealCardToPlayer(player);
      if (!result) {
        needsCard = false;
        continue;
      }

      if (result.triggersFreeze) {
        // Per official rules: player who drew freeze chooses target during initial deal
        const eligibleTargets = this.players
          .filter((p) => p.status === 'active' && p.isConnected)
          .map((p) => p.id);

        if (eligibleTargets.length === 1) {
          // Only one eligible target, freeze immediately
          const target = this.getPlayer(eligibleTargets[0]);
          if (target) {
            target.status = 'frozen';
            target.roundScore = this.calculatePlayerRoundScore(target);
          }
          needsCard = false;
        } else if (eligibleTargets.length > 1) {
          // Multiple targets - pause deal for selection
          this.pendingFreezeTarget = {
            playerId: player.id,
            eligibleTargets,
          };
          // Store where we are in the deal (continue from NEXT player after selection)
          this.pendingDealIndex = playerIndex + 1;
          this.phase = 'AWAITING_FREEZE_TARGET';
          return true; // Pause the deal
        }
        needsCard = false;
      } else if (result.triggersFlipThree) {
        // Flip Three during deal: draw 3 more cards
        const pausedForFreeze = this.executeFlipThreeDuringDeal(player, playerIndex);
        if (pausedForFreeze) {
          return true; // Pause the deal
        }
        needsCard = false; // Flip Three counts as receiving cards
      } else if (result.extraSecondChance) {
        // Extra Second Chance - give to another active player or discard
        this.giveSecondChanceToOtherPlayer(result.extraSecondChance);
        // Continue dealing - player still needs a starting card
      } else if (isActionCard(result.card) && result.card.action === 'second_chance') {
        // Got a Second Chance, keep dealing for a starting card
        // (player now has Second Chance but needs another card)
      } else {
        // Number or modifier card - done dealing
        needsCard = false;
      }
    }
    return false; // No pause needed
  }

  /**
   * Execute Flip Three during initial deal.
   * Returns true if we need to pause for freeze target selection.
   */
  private executeFlipThreeDuringDeal(player: Player, playerIndex: number): boolean {
    let freezeDrawn = false;

    for (let i = 0; i < 3 && player.status === 'active'; i++) {
      const result = this.dealCardToPlayer(player);
      if (!result) break;

      if (result.isBust && !result.hasSecondChance) {
        player.status = 'busted';
        player.roundScore = 0;
        break;
      } else if (result.isBust && result.hasSecondChance) {
        // During deal, auto-use Second Chance
        const secondChanceIndex = player.cards.findIndex(
          (pc) => isActionCard(pc.card) && pc.card.action === 'second_chance'
        );
        if (secondChanceIndex !== -1) {
          const [secondChancePlayedCard] = player.cards.splice(secondChanceIndex, 1);
          this.discardPile.push(secondChancePlayedCard.card);
          this.discardPile.push(result.card);
        }
      } else if (result.triggersFreeze) {
        // Per official rules: Freeze is SET ASIDE during Flip Three
        freezeDrawn = true;
        // Continue Flip Three - don't interrupt
      } else if (result.extraSecondChance) {
        this.giveSecondChanceToOtherPlayer(result.extraSecondChance);
      }
    }

    // Handle freeze after Flip Three completes during initial deal
    if (freezeDrawn) {
      if (player.status === 'busted') {
        // Per official rules: if player busted, Freeze is DISCARDED
        return false;
      } else if (player.status === 'active') {
        // Player didn't bust - resolve the freeze
        const eligibleTargets = this.players
          .filter((p) => p.status === 'active' && p.isConnected)
          .map((p) => p.id);

        if (eligibleTargets.length === 1) {
          // Only one eligible target, freeze immediately
          const target = this.getPlayer(eligibleTargets[0]);
          if (target) {
            target.status = 'frozen';
            target.roundScore = this.calculatePlayerRoundScore(target);
          }
        } else if (eligibleTargets.length > 1) {
          // Multiple targets - pause deal for selection
          this.pendingFreezeTarget = {
            playerId: player.id,
            eligibleTargets,
          };
          this.pendingDealIndex = playerIndex + 1;
          this.phase = 'AWAITING_FREEZE_TARGET';
          return true; // Pause the deal
        }
      }
    }

    return false;
  }

  private giveSecondChanceToOtherPlayer(card: Card): void {
    // Find an active player who doesn't have a Second Chance
    const eligiblePlayer = this.players.find(
      (p) =>
        p.status === 'active' &&
        !p.cards.some((pc) => isActionCard(pc.card) && pc.card.action === 'second_chance')
    );

    if (eligiblePlayer) {
      eligiblePlayer.cards.push({ card, attachedModifiers: [] });
    } else {
      // No eligible player - discard it
      this.discardPile.push(card);
    }
  }

  private dealCardToPlayer(player: Player): DrawResult | null {
    const card = this.deck.draw();
    if (card) {
      return this.processDrawnCard(player, card);
    }
    return null;
  }

  private processDrawnCard(player: Player, card: Card): DrawResult {
    const result: DrawResult = {
      card,
      playedCard: { card, attachedModifiers: [] },
      isBust: false,
      triggersFlipThree: false,
      triggersFreeze: false,
      hasSecondChance: false,
    };

    if (isNumberCard(card)) {
      // Check for duplicate
      const hasDuplicate = player.cards.some(
        (pc) => isNumberCard(pc.card) && pc.card.value === card.value
      );

      if (hasDuplicate) {
        result.isBust = true;
        result.duplicateCard = card;

        // Check if player has Second Chance card
        const secondChanceIndex = player.cards.findIndex(
          (pc) => isActionCard(pc.card) && pc.card.action === 'second_chance'
        );

        if (secondChanceIndex !== -1) {
          result.hasSecondChance = true;
        }
      } else {
        // Per rules: modifiers don't attach to specific cards, they're standalone score bonuses
        player.cards.push(result.playedCard);

        // Check for 7 unique numbers
        const uniqueNumbers = new Set(
          player.cards
            .filter((pc) => isNumberCard(pc.card))
            .map((pc) => (pc.card as any).value)
        );

        if (uniqueNumbers.size >= 7) {
          // Auto-complete round for this player with bonus
          player.status = 'passed';
        }
      }
    } else if (isActionCard(card)) {
      switch (card.action) {
        case 'freeze':
          player.cards.push(result.playedCard);
          result.triggersFreeze = true;
          break;
        case 'flip_three':
          player.cards.push(result.playedCard);
          result.triggersFlipThree = true;
          break;
        case 'second_chance':
          // Per rules: player can only have one Second Chance card
          const hasSecondChance = player.cards.some(
            (pc) => isActionCard(pc.card) && pc.card.action === 'second_chance'
          );
          if (hasSecondChance) {
            // Extra Second Chance - must be given to another player or discarded
            result.extraSecondChance = card;
          } else {
            player.cards.push(result.playedCard);
          }
          break;
      }
    } else if (isModifierCard(card)) {
      // Per rules: modifiers are standalone cards that add to your score
      player.cards.push(result.playedCard);
    }

    return result;
  }

  hit(playerId: string): DrawResult | null {
    const player = this.getPlayer(playerId);
    if (!player || player.status !== 'active') {
      return null;
    }

    if (this.phase !== 'PLAYER_TURN' || this.getCurrentPlayer()?.id !== playerId) {
      return null;
    }

    const card = this.deck.draw();
    if (!card) {
      // Deck empty, reshuffle discard
      this.deck.addCards(this.discardPile);
      this.discardPile = [];
      this.deck.shuffle();
      const newCard = this.deck.draw();
      if (!newCard) {
        return null;
      }
      return this.handleDrawnCard(player, newCard);
    }

    return this.handleDrawnCard(player, card);
  }

  private handleDrawnCard(player: Player, card: Card): DrawResult {
    const result = this.processDrawnCard(player, card);

    // Handle extra Second Chance (player already has one)
    if (result.extraSecondChance) {
      this.giveSecondChanceToOtherPlayer(result.extraSecondChance);
    }

    if (result.isBust) {
      if (result.hasSecondChance) {
        this.pendingSecondChance = {
          playerId: player.id,
          duplicateCard: card,
        };
        this.phase = 'AWAITING_SECOND_CHANCE';
      } else {
        player.status = 'busted';
        player.roundScore = 0;
        this.discardPile.push(...player.cards.map((pc) => pc.card));
        this.discardPile.push(card);
        this.advanceToNextPlayer();
      }
    } else if (result.triggersFreeze) {
      // Get all active players as eligible freeze targets
      const eligibleTargets = this.players
        .filter((p) => p.status === 'active' && p.isConnected)
        .map((p) => p.id);

      if (eligibleTargets.length === 1) {
        // Only one eligible target (must be self), freeze immediately
        const target = this.getPlayer(eligibleTargets[0]);
        if (target) {
          target.status = 'frozen';
          target.roundScore = this.calculatePlayerRoundScore(target);
        }
        this.advanceToNextPlayer();
      } else {
        // Multiple targets available, wait for selection
        this.pendingFreezeTarget = {
          playerId: player.id,
          eligibleTargets,
        };
        this.phase = 'AWAITING_FREEZE_TARGET';
      }
    } else if (result.triggersFlipThree) {
      this.flipThreeRemaining = 3;
      // Continue drawing for flip three
      this.executeFlipThree(player);
    } else if (player.status === 'passed') {
      // Got 7 unique numbers
      player.roundScore = this.calculatePlayerRoundScore(player);
      this.advanceToNextPlayer();
    } else {
      // Normal successful draw - advance to next player (Flip 7 rules: one card per turn)
      this.advanceToNextPlayer();
    }

    return result;
  }

  private executeFlipThree(player: Player): void {
    while (this.flipThreeRemaining > 0 && player.status === 'active') {
      this.flipThreeRemaining--;
      const card = this.deck.draw();
      if (card) {
        const result = this.processDrawnCard(player, card);

        // Handle extra Second Chance (player already has one)
        if (result.extraSecondChance) {
          this.giveSecondChanceToOtherPlayer(result.extraSecondChance);
        }

        if (result.isBust && !result.hasSecondChance) {
          player.status = 'busted';
          player.roundScore = 0;
          break;
        } else if (result.isBust && result.hasSecondChance) {
          this.pendingSecondChance = {
            playerId: player.id,
            duplicateCard: card,
          };
          this.phase = 'AWAITING_SECOND_CHANCE';
          return;
        } else if (result.triggersFreeze) {
          // Per official rules: Freeze is SET ASIDE during Flip Three
          // It will be resolved after Flip Three completes (or discarded if busted/Flip7)
          this.pendingFlipThreeFreeze = { playerId: player.id };
          // Continue Flip Three - don't interrupt
        }

        // Check if got 7 unique numbers (processDrawnCard sets status to 'passed')
        if ((player.status as string) === 'passed') {
          player.roundScore = this.calculatePlayerRoundScore(player);
          break;
        }
      }
    }

    this.flipThreeRemaining = 0;

    // Handle pending Flip Three freeze after Flip Three completes
    if (this.pendingFlipThreeFreeze && this.pendingFlipThreeFreeze.playerId === player.id) {
      if (player.status === 'busted' || player.status === 'passed') {
        // Per official rules: if player busted or achieved Flip 7, Freeze is DISCARDED
        this.pendingFlipThreeFreeze = undefined;
      } else if (player.status === 'active') {
        // Player didn't bust and didn't achieve Flip 7 - resolve the freeze
        const eligibleTargets = this.players
          .filter((p) => p.status === 'active' && p.isConnected)
          .map((p) => p.id);

        if (eligibleTargets.length === 1) {
          // Only one eligible target, freeze immediately
          const target = this.getPlayer(eligibleTargets[0]);
          if (target) {
            target.status = 'frozen';
            target.roundScore = this.calculatePlayerRoundScore(target);
          }
          this.pendingFlipThreeFreeze = undefined;
        } else if (eligibleTargets.length > 1) {
          // Multiple targets available, wait for selection
          this.pendingFreezeTarget = {
            playerId: player.id,
            eligibleTargets,
          };
          this.pendingFlipThreeFreeze = undefined;
          this.phase = 'AWAITING_FREEZE_TARGET';
          return;
        } else {
          // No eligible targets
          this.pendingFlipThreeFreeze = undefined;
        }
      }
    }

    if (player.status === 'busted' || player.status === 'frozen' || player.status === 'passed') {
      this.advanceToNextPlayer();
    }
  }

  useSecondChance(playerId: string, use: boolean): boolean {
    if (this.phase !== 'AWAITING_SECOND_CHANCE') {
      return false;
    }

    if (!this.pendingSecondChance || this.pendingSecondChance.playerId !== playerId) {
      return false;
    }

    const player = this.getPlayer(playerId);
    if (!player) {
      return false;
    }

    const duplicateCard = this.pendingSecondChance.duplicateCard;

    if (use) {
      // Use Second Chance: discard the duplicate and the Second Chance card
      const secondChanceIndex = player.cards.findIndex(
        (pc) => isActionCard(pc.card) && pc.card.action === 'second_chance'
      );

      if (secondChanceIndex !== -1) {
        const [secondChancePlayedCard] = player.cards.splice(secondChanceIndex, 1);
        this.discardPile.push(secondChancePlayedCard.card);
        this.discardPile.push(duplicateCard);
      }

      this.pendingSecondChance = undefined;
      this.phase = 'PLAYER_TURN';

      // If in flip three, continue
      if (this.flipThreeRemaining > 0) {
        this.executeFlipThree(player);
      }

      return true;
    } else {
      // Don't use Second Chance: bust
      player.status = 'busted';
      player.roundScore = 0;
      this.discardPile.push(...player.cards.map((pc) => pc.card));
      this.discardPile.push(duplicateCard);

      this.pendingSecondChance = undefined;
      this.flipThreeRemaining = 0;
      this.phase = 'PLAYER_TURN';
      this.advanceToNextPlayer();

      return true;
    }
  }

  pass(playerId: string): boolean {
    const player = this.getPlayer(playerId);
    if (!player || player.status !== 'active') {
      return false;
    }

    if (this.phase !== 'PLAYER_TURN' || this.getCurrentPlayer()?.id !== playerId) {
      return false;
    }

    player.status = 'passed';
    player.roundScore = this.calculatePlayerRoundScore(player);
    this.advanceToNextPlayer();

    return true;
  }

  selectFreezeTarget(playerId: string, targetPlayerId: string): boolean {
    if (this.phase !== 'AWAITING_FREEZE_TARGET') {
      return false;
    }

    if (!this.pendingFreezeTarget || this.pendingFreezeTarget.playerId !== playerId) {
      return false;
    }

    if (!this.pendingFreezeTarget.eligibleTargets.includes(targetPlayerId)) {
      return false;
    }

    const target = this.getPlayer(targetPlayerId);
    if (!target || target.status !== 'active') {
      return false;
    }

    // Freeze the target player
    target.status = 'frozen';
    target.roundScore = this.calculatePlayerRoundScore(target);

    // Clear pending state
    this.pendingFreezeTarget = undefined;

    // Check if we're in the middle of initial deal
    if (this.pendingDealIndex !== undefined) {
      // Continue the initial deal from where we left off
      this.phase = 'DEALING';
      this.continueInitialDeal(this.pendingDealIndex);
      return true;
    }

    this.phase = 'PLAYER_TURN';

    // If we were in the middle of flip three, continue it
    if (this.flipThreeRemaining > 0) {
      const player = this.getPlayer(playerId);
      if (player && player.status === 'active') {
        this.executeFlipThree(player);
      } else {
        this.flipThreeRemaining = 0;
        this.advanceToNextPlayer();
      }
    } else {
      this.advanceToNextPlayer();
    }

    return true;
  }

  private calculatePlayerRoundScore(player: Player): number {
    // Per official rules:
    // 1. Sum all number card values
    // 2. If X2 present, double that sum
    // 3. Add all +modifier values
    // 4. Add Flip 7 bonus if applicable

    let numberTotal = 0;
    const numberCardValues = new Set<number>();
    let hasX2 = false;
    let modifierBonus = 0;

    for (const playedCard of player.cards) {
      if (isNumberCard(playedCard.card)) {
        numberCardValues.add(playedCard.card.value);
        numberTotal += playedCard.card.value;
      } else if (isModifierCard(playedCard.card)) {
        if (playedCard.card.modifier === 'x2') {
          hasX2 = true;
        } else {
          modifierBonus += playedCard.card.modifier;
        }
      }
    }

    // Apply X2 to number card total first
    let total = hasX2 ? numberTotal * 2 : numberTotal;

    // Then add modifier bonuses
    total += modifierBonus;

    // 7 unique numbers bonus
    if (numberCardValues.size >= 7) {
      total += 15;
    }

    return total;
  }

  private advanceToNextPlayer(): void {
    // Check if round is over
    const activePlayers = this.players.filter(
      (p) => p.status === 'active' && p.isConnected
    );

    if (activePlayers.length === 0) {
      this.endRound();
      return;
    }

    // Find next active player
    let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
    let attempts = 0;

    while (attempts < this.players.length) {
      const nextPlayer = this.players[nextIndex];
      if (nextPlayer.status === 'active' && nextPlayer.isConnected) {
        this.currentPlayerIndex = nextIndex;
        return;
      }
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
    }

    // No active players found, end round
    this.endRound();
  }

  private skipInactivePlayers(): void {
    let attempts = 0;
    while (attempts < this.players.length) {
      const currentPlayer = this.players[this.currentPlayerIndex];
      if (currentPlayer.status === 'active' && currentPlayer.isConnected) {
        return;
      }
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
    }
  }

  private endRound(): void {
    this.phase = 'ROUND_END';

    // Add round scores to total scores
    for (const player of this.players) {
      if (player.status === 'passed' || player.status === 'frozen') {
        player.score += player.roundScore;
      }
    }

    // Check for winner
    const winner = this.players.find((p) => p.score >= this.settings.targetScore);

    if (winner) {
      this.phase = 'GAME_END';
      this.winnerId = winner.id;

      // If multiple players over target, highest score wins
      const overTarget = this.players.filter((p) => p.score >= this.settings.targetScore);
      if (overTarget.length > 1) {
        overTarget.sort((a, b) => b.score - a.score);
        this.winnerId = overTarget[0].id;
      }
    } else {
      // Start next round
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
      this.roundStartTimeout = setTimeout(() => {
        this.roundStartTimeout = undefined;
        this.startNewRound();
      }, 3000);
    }
  }

  /**
   * Clean up any pending timeouts. Call this when the game is being destroyed.
   */
  cleanup(): void {
    if (this.roundStartTimeout) {
      clearTimeout(this.roundStartTimeout);
      this.roundStartTimeout = undefined;
    }
  }

  /**
   * Update a player's ID (used for reconnection with new socket ID).
   */
  updatePlayerId(oldId: string, newId: string): void {
    const player = this.players.find((p) => p.id === oldId);
    if (player) {
      player.id = newId;
    }

    // Update pendingSecondChance if it references the old ID
    if (this.pendingSecondChance?.playerId === oldId) {
      this.pendingSecondChance.playerId = newId;
    }
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.find((p) => p.id === playerId);
  }

  getCurrentPlayer(): Player | undefined {
    return this.players[this.currentPlayerIndex];
  }

  playerDisconnected(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isConnected = false;
      if (player.status === 'active') {
        player.status = 'disconnected';
      }

      // If it was their turn, advance
      if (this.getCurrentPlayer()?.id === playerId && this.phase === 'PLAYER_TURN') {
        this.advanceToNextPlayer();
      }
    }
  }

  playerReconnected(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isConnected = true;
      if (player.status === 'disconnected') {
        player.status = 'active';
      }
    }
  }

  getState(): GameState {
    return {
      phase: this.phase,
      players: this.players.map((p) => ({ ...p })),
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      deckCount: this.deck.count,
      discardPile: [...this.discardPile],
      round: this.round,
      settings: { ...this.settings },
      pendingSecondChance: this.pendingSecondChance,
      pendingFreezeTarget: this.pendingFreezeTarget,
      flipThreeRemaining: this.flipThreeRemaining,
      winnerId: this.winnerId,
    };
  }

  isGameOver(): boolean {
    return this.phase === 'GAME_END';
  }
}
