import { describe, it, expect } from 'vitest';
import {
  isNumberCard,
  isActionCard,
  isModifierCard,
  getCardPoints,
  NumberCard,
  ActionCard,
  ModifierCard,
  PlayedCard,
} from './card';

describe('Type Guards', () => {
  describe('isNumberCard', () => {
    it('should return true for number cards', () => {
      const card: NumberCard = { type: 'number', value: 5, id: '1' };
      expect(isNumberCard(card)).toBe(true);
    });

    it('should return false for action cards', () => {
      const card: ActionCard = { type: 'action', action: 'freeze', id: '1' };
      expect(isNumberCard(card)).toBe(false);
    });

    it('should return false for modifier cards', () => {
      const card: ModifierCard = { type: 'modifier', modifier: 4, id: '1' };
      expect(isNumberCard(card)).toBe(false);
    });
  });

  describe('isActionCard', () => {
    it('should return true for action cards', () => {
      const card: ActionCard = { type: 'action', action: 'freeze', id: '1' };
      expect(isActionCard(card)).toBe(true);
    });

    it('should return true for all action types', () => {
      const freeze: ActionCard = { type: 'action', action: 'freeze', id: '1' };
      const flipThree: ActionCard = { type: 'action', action: 'flip_three', id: '2' };
      const secondChance: ActionCard = { type: 'action', action: 'second_chance', id: '3' };

      expect(isActionCard(freeze)).toBe(true);
      expect(isActionCard(flipThree)).toBe(true);
      expect(isActionCard(secondChance)).toBe(true);
    });

    it('should return false for number cards', () => {
      const card: NumberCard = { type: 'number', value: 5, id: '1' };
      expect(isActionCard(card)).toBe(false);
    });

    it('should return false for modifier cards', () => {
      const card: ModifierCard = { type: 'modifier', modifier: 'x2', id: '1' };
      expect(isActionCard(card)).toBe(false);
    });
  });

  describe('isModifierCard', () => {
    it('should return true for modifier cards', () => {
      const card: ModifierCard = { type: 'modifier', modifier: 6, id: '1' };
      expect(isModifierCard(card)).toBe(true);
    });

    it('should return true for x2 modifier', () => {
      const card: ModifierCard = { type: 'modifier', modifier: 'x2', id: '1' };
      expect(isModifierCard(card)).toBe(true);
    });

    it('should return false for number cards', () => {
      const card: NumberCard = { type: 'number', value: 5, id: '1' };
      expect(isModifierCard(card)).toBe(false);
    });

    it('should return false for action cards', () => {
      const card: ActionCard = { type: 'action', action: 'freeze', id: '1' };
      expect(isModifierCard(card)).toBe(false);
    });
  });
});

describe('getCardPoints', () => {
  it('should return the value of a number card', () => {
    const playedCard: PlayedCard = {
      card: { type: 'number', value: 7, id: '1' },
      attachedModifiers: [],
    };
    expect(getCardPoints(playedCard)).toBe(7);
  });

  it('should return 0 for card value 0', () => {
    const playedCard: PlayedCard = {
      card: { type: 'number', value: 0, id: '1' },
      attachedModifiers: [],
    };
    expect(getCardPoints(playedCard)).toBe(0);
  });

  it('should return 0 for action cards', () => {
    const playedCard: PlayedCard = {
      card: { type: 'action', action: 'freeze', id: '1' },
      attachedModifiers: [],
    };
    expect(getCardPoints(playedCard)).toBe(0);
  });

  it('should return 0 for modifier cards', () => {
    const playedCard: PlayedCard = {
      card: { type: 'modifier', modifier: 8, id: '1' },
      attachedModifiers: [],
    };
    expect(getCardPoints(playedCard)).toBe(0);
  });

  it('should work for all number card values 0-12', () => {
    for (let value = 0; value <= 12; value++) {
      const playedCard: PlayedCard = {
        card: { type: 'number', value, id: `${value}` },
        attachedModifiers: [],
      };
      expect(getCardPoints(playedCard)).toBe(value);
    }
  });
});
