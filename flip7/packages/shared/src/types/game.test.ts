import { describe, it, expect } from 'vitest';
import { calculateRoundScore, DEFAULT_GAME_SETTINGS } from './game';
import { PlayedCard, NumberCard, ModifierCard, ActionCard } from './card';

function makeNumberCard(value: number, id: string = `num-${value}`): PlayedCard {
  return {
    card: { type: 'number', value, id } as NumberCard,
    attachedModifiers: [],
  };
}

function makeModifierCard(modifier: ModifierCard['modifier'], id: string = `mod-${modifier}`): PlayedCard {
  return {
    card: { type: 'modifier', modifier, id } as ModifierCard,
    attachedModifiers: [],
  };
}

function makeActionCard(action: ActionCard['action'], id: string = `action-${action}`): PlayedCard {
  return {
    card: { type: 'action', action, id } as ActionCard,
    attachedModifiers: [],
  };
}

describe('calculateRoundScore', () => {
  describe('basic number card scoring', () => {
    it('should return 0 for empty cards', () => {
      expect(calculateRoundScore([])).toBe(0);
    });

    it('should sum number card values', () => {
      const cards = [makeNumberCard(3), makeNumberCard(5), makeNumberCard(7)];
      expect(calculateRoundScore(cards)).toBe(15);
    });

    it('should handle a single number card', () => {
      const cards = [makeNumberCard(12)];
      expect(calculateRoundScore(cards)).toBe(12);
    });

    it('should handle card value 0', () => {
      const cards = [makeNumberCard(0), makeNumberCard(5)];
      expect(calculateRoundScore(cards)).toBe(5);
    });
  });

  describe('modifier scoring', () => {
    it('should add flat modifier bonus', () => {
      const cards = [makeNumberCard(5), makeModifierCard(4)];
      expect(calculateRoundScore(cards)).toBe(9); // 5 + 4
    });

    it('should add multiple flat modifiers', () => {
      const cards = [makeNumberCard(5), makeModifierCard(2), makeModifierCard(6)];
      expect(calculateRoundScore(cards)).toBe(13); // 5 + 2 + 6
    });

    it('should double number total with x2 modifier', () => {
      const cards = [makeNumberCard(5), makeNumberCard(3), makeModifierCard('x2')];
      expect(calculateRoundScore(cards)).toBe(16); // (5 + 3) * 2
    });

    it('should apply x2 before adding flat modifiers', () => {
      const cards = [makeNumberCard(5), makeModifierCard('x2'), makeModifierCard(4)];
      expect(calculateRoundScore(cards)).toBe(14); // (5 * 2) + 4
    });

    it('should handle x2 with multiple numbers and modifiers', () => {
      const cards = [
        makeNumberCard(3),
        makeNumberCard(7),
        makeModifierCard('x2'),
        makeModifierCard(2),
        makeModifierCard(8),
      ];
      // (3 + 7) * 2 + 2 + 8 = 20 + 10 = 30
      expect(calculateRoundScore(cards)).toBe(30);
    });

    it('should handle x2 with 0 number total', () => {
      const cards = [makeNumberCard(0), makeModifierCard('x2')];
      expect(calculateRoundScore(cards)).toBe(0); // 0 * 2 = 0
    });

    it('should handle only modifiers (no numbers)', () => {
      const cards = [makeModifierCard(4), makeModifierCard(6)];
      expect(calculateRoundScore(cards)).toBe(10); // 0 + 4 + 6
    });

    it('should handle only x2 modifier (no numbers)', () => {
      const cards = [makeModifierCard('x2')];
      expect(calculateRoundScore(cards)).toBe(0); // 0 * 2 = 0
    });
  });

  describe('7 unique numbers bonus', () => {
    it('should add 15 point bonus for exactly 7 unique numbers', () => {
      const cards = [
        makeNumberCard(1),
        makeNumberCard(2),
        makeNumberCard(3),
        makeNumberCard(4),
        makeNumberCard(5),
        makeNumberCard(6),
        makeNumberCard(7),
      ];
      // 1+2+3+4+5+6+7 = 28, + 15 bonus = 43
      expect(calculateRoundScore(cards)).toBe(43);
    });

    it('should not add bonus for 6 unique numbers', () => {
      const cards = [
        makeNumberCard(1),
        makeNumberCard(2),
        makeNumberCard(3),
        makeNumberCard(4),
        makeNumberCard(5),
        makeNumberCard(6),
      ];
      // 1+2+3+4+5+6 = 21
      expect(calculateRoundScore(cards)).toBe(21);
    });

    it('should add bonus for more than 7 unique numbers', () => {
      const cards = [
        makeNumberCard(0),
        makeNumberCard(1),
        makeNumberCard(2),
        makeNumberCard(3),
        makeNumberCard(4),
        makeNumberCard(5),
        makeNumberCard(6),
        makeNumberCard(7),
      ];
      // 0+1+2+3+4+5+6+7 = 28, + 15 bonus = 43
      expect(calculateRoundScore(cards)).toBe(43);
    });

    it('should combine bonus with x2 and modifiers', () => {
      const cards = [
        makeNumberCard(1),
        makeNumberCard(2),
        makeNumberCard(3),
        makeNumberCard(4),
        makeNumberCard(5),
        makeNumberCard(6),
        makeNumberCard(7),
        makeModifierCard('x2'),
        makeModifierCard(4),
      ];
      // (1+2+3+4+5+6+7) * 2 + 4 + 15 = 56 + 4 + 15 = 75
      expect(calculateRoundScore(cards)).toBe(75);
    });
  });

  describe('action cards', () => {
    it('should not contribute to score', () => {
      const cards = [makeNumberCard(5), makeActionCard('freeze'), makeActionCard('second_chance')];
      expect(calculateRoundScore(cards)).toBe(5);
    });

    it('should not count toward unique numbers', () => {
      const cards = [
        makeNumberCard(1),
        makeNumberCard(2),
        makeNumberCard(3),
        makeNumberCard(4),
        makeNumberCard(5),
        makeNumberCard(6),
        makeActionCard('freeze'),
      ];
      // 1+2+3+4+5+6 = 21, no bonus (only 6 unique numbers)
      expect(calculateRoundScore(cards)).toBe(21);
    });
  });

  describe('edge cases', () => {
    it('should handle maximum possible hand', () => {
      const cards = [
        makeNumberCard(12),
        makeNumberCard(11),
        makeNumberCard(10),
        makeNumberCard(9),
        makeNumberCard(8),
        makeNumberCard(7),
        makeNumberCard(6),
        makeModifierCard('x2'),
        makeModifierCard(10),
        makeModifierCard(8),
        makeModifierCard(6),
        makeModifierCard(4),
        makeModifierCard(2),
      ];
      // Numbers: 12+11+10+9+8+7+6 = 63
      // x2: 63 * 2 = 126
      // Modifiers: 10+8+6+4+2 = 30
      // Bonus: 15
      // Total: 126 + 30 + 15 = 171
      expect(calculateRoundScore(cards)).toBe(171);
    });

    it('should handle only action cards', () => {
      const cards = [
        makeActionCard('freeze'),
        makeActionCard('flip_three'),
        makeActionCard('second_chance'),
      ];
      expect(calculateRoundScore(cards)).toBe(0);
    });
  });
});

describe('DEFAULT_GAME_SETTINGS', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_GAME_SETTINGS.targetScore).toBe(200);
    expect(DEFAULT_GAME_SETTINGS.maxPlayers).toBe(6);
    expect(DEFAULT_GAME_SETTINGS.turnTimeoutSeconds).toBe(30);
  });
});
