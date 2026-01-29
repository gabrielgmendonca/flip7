import { Card, PlayedCard } from './card';

export type GamePhase =
  | 'LOBBY'
  | 'DEALING'
  | 'PLAYER_TURN'
  | 'AWAITING_SECOND_CHANCE'
  | 'AWAITING_FREEZE_TARGET'
  | 'ROUND_END'
  | 'GAME_END';

export type PlayerStatus = 'active' | 'passed' | 'busted' | 'frozen' | 'disconnected';

export interface Player {
  id: string;
  name: string;
  score: number;
  roundScore: number;
  cards: PlayedCard[];
  status: PlayerStatus;
  isHost: boolean;
  isConnected: boolean;
  reconnectToken?: string;
}

export interface GameSettings {
  targetScore: number;
  maxPlayers: number;
  turnTimeoutSeconds: number;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  targetScore: 200,
  maxPlayers: 6,
  turnTimeoutSeconds: 30,
};

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  deckCount: number;
  discardPile: Card[];
  round: number;
  settings: GameSettings;
  pendingSecondChance?: {
    playerId: string;
    duplicateCard: Card;
  };
  pendingFreezeTarget?: {
    playerId: string;
    eligibleTargets: string[];
  };
  flipThreeRemaining?: number;
  winnerId?: string;
}

export interface PublicGameState extends Omit<GameState, 'pendingSecondChance'> {
  pendingSecondChance?: {
    playerId: string;
    duplicateCard: Card;
  };
}

export function calculateRoundScore(cards: PlayedCard[]): number {
  // Per official rules:
  // 1. Sum all number card values
  // 2. If X2 present, double that sum
  // 3. Add all +modifier values
  // 4. Add Flip 7 bonus if applicable

  let numberTotal = 0;
  const numberCardValues = new Set<number>();
  let hasX2 = false;
  let modifierBonus = 0;

  for (const playedCard of cards) {
    if (playedCard.card.type === 'number') {
      numberCardValues.add(playedCard.card.value);
      numberTotal += playedCard.card.value;
    } else if (playedCard.card.type === 'modifier') {
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
