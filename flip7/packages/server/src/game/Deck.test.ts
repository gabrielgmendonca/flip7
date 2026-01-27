import { describe, it, expect, beforeEach } from 'vitest';
import { Deck } from './Deck';
import { isNumberCard, isActionCard, isModifierCard } from '@flip7/shared';

describe('Deck', () => {
  let deck: Deck;

  beforeEach(() => {
    deck = new Deck();
  });

  describe('deck composition', () => {
    it('should create a deck with exactly 94 cards', () => {
      expect(deck.count).toBe(94);
    });

    it('should have correct number of number cards (79 total)', () => {
      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }
      const numberCards = allCards.filter(isNumberCard);
      expect(numberCards.length).toBe(79);
    });

    it('should have correct distribution of number cards', () => {
      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }
      const numberCards = allCards.filter(isNumberCard);

      const valueCounts = new Map<number, number>();
      for (const card of numberCards) {
        valueCounts.set(card.value, (valueCounts.get(card.value) || 0) + 1);
      }

      // One 0 card
      expect(valueCounts.get(0)).toBe(1);
      // Quantity equals value for 1-12
      for (let value = 1; value <= 12; value++) {
        expect(valueCounts.get(value)).toBe(value);
      }
    });

    it('should have exactly 10 action cards', () => {
      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }
      const actionCards = allCards.filter(isActionCard);
      expect(actionCards.length).toBe(10);
    });

    it('should have correct distribution of action cards', () => {
      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }
      const actionCards = allCards.filter(isActionCard);

      const actionCounts = new Map<string, number>();
      for (const card of actionCards) {
        actionCounts.set(card.action, (actionCounts.get(card.action) || 0) + 1);
      }

      expect(actionCounts.get('freeze')).toBe(4);
      expect(actionCounts.get('flip_three')).toBe(3);
      expect(actionCounts.get('second_chance')).toBe(3);
    });

    it('should have exactly 5 modifier cards', () => {
      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }
      const modifierCards = allCards.filter(isModifierCard);
      expect(modifierCards.length).toBe(5);
    });

    it('should have correct modifier values', () => {
      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }
      const modifierCards = allCards.filter(isModifierCard);

      const modifierValues = modifierCards.map((c) => c.modifier).sort();
      expect(modifierValues).toEqual([2, 4, 6, 8, 'x2'].sort());
    });

    it('should give each card a unique id', () => {
      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }
      const ids = new Set(allCards.map((c) => c.id));
      expect(ids.size).toBe(94);
    });
  });

  describe('draw', () => {
    it('should return a card and decrease count', () => {
      const initialCount = deck.count;
      const card = deck.draw();

      expect(card).not.toBeNull();
      expect(deck.count).toBe(initialCount - 1);
    });

    it('should return null when deck is empty', () => {
      while (!deck.isEmpty()) {
        deck.draw();
      }
      expect(deck.draw()).toBeNull();
    });

    it('should return different cards (not always the same)', () => {
      const cards = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const card = deck.draw();
        if (card) cards.add(card.id);
      }
      expect(cards.size).toBeGreaterThan(1);
    });
  });

  describe('drawMultiple', () => {
    it('should return requested number of cards', () => {
      const cards = deck.drawMultiple(5);
      expect(cards.length).toBe(5);
      expect(deck.count).toBe(89);
    });

    it('should return all remaining cards if requested more than available', () => {
      // Draw most cards first
      deck.drawMultiple(90);
      const remaining = deck.drawMultiple(10);
      expect(remaining.length).toBe(4);
      expect(deck.isEmpty()).toBe(true);
    });

    it('should return empty array for 0 count', () => {
      const cards = deck.drawMultiple(0);
      expect(cards.length).toBe(0);
      expect(deck.count).toBe(94);
    });
  });

  describe('isEmpty', () => {
    it('should return false for new deck', () => {
      expect(deck.isEmpty()).toBe(false);
    });

    it('should return true after drawing all cards', () => {
      deck.drawMultiple(94);
      expect(deck.isEmpty()).toBe(true);
    });
  });

  describe('addCards', () => {
    it('should add cards back to deck', () => {
      const drawnCards = deck.drawMultiple(5);
      const countAfterDraw = deck.count;

      deck.addCards(drawnCards);
      expect(deck.count).toBe(countAfterDraw + 5);
    });

    it('should allow drawing added cards', () => {
      // Empty the deck first
      deck.drawMultiple(94);
      expect(deck.isEmpty()).toBe(true);

      // Add some cards back
      const cardsToAdd = [
        { type: 'number' as const, value: 5, id: 'test-1' },
        { type: 'number' as const, value: 7, id: 'test-2' },
      ];
      deck.addCards(cardsToAdd);

      expect(deck.count).toBe(2);
      const card1 = deck.draw();
      const card2 = deck.draw();

      expect(card1).not.toBeNull();
      expect(card2).not.toBeNull();
      expect(deck.isEmpty()).toBe(true);
    });
  });

  describe('shuffle', () => {
    it('should change card order', () => {
      // Get initial order
      const deck1 = new Deck();
      const deck2 = new Deck();

      // Get a bunch of cards from each in original order
      const order1: string[] = [];
      const order2: string[] = [];

      for (let i = 0; i < 20; i++) {
        order1.push(deck1.draw()!.id);
      }

      deck2.shuffle(); // Shuffle deck2

      for (let i = 0; i < 20; i++) {
        order2.push(deck2.draw()!.id);
      }

      // Orders should be different (with very high probability)
      const matching = order1.filter((id, i) => id === order2[i]).length;
      expect(matching).toBeLessThan(15); // Expect at least some difference
    });
  });

  describe('reset', () => {
    it('should restore deck to 94 cards', () => {
      deck.drawMultiple(50);
      expect(deck.count).toBe(44);

      deck.reset();
      expect(deck.count).toBe(94);
    });

    it('should recreate all card types', () => {
      deck.drawMultiple(94);
      deck.reset();

      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }

      expect(allCards.filter(isNumberCard).length).toBe(79);
      expect(allCards.filter(isActionCard).length).toBe(10);
      expect(allCards.filter(isModifierCard).length).toBe(5);
    });

    it('should generate new unique IDs after reset', () => {
      const card1 = deck.draw()!;
      const firstId = card1.id;

      deck.reset();

      const allCards = [];
      while (!deck.isEmpty()) {
        allCards.push(deck.draw()!);
      }

      // None of the new cards should have the same ID
      const hasOldId = allCards.some((c) => c.id === firstId);
      expect(hasOldId).toBe(false);
    });
  });

  describe('count getter', () => {
    it('should accurately track remaining cards', () => {
      expect(deck.count).toBe(94);

      deck.draw();
      expect(deck.count).toBe(93);

      deck.drawMultiple(10);
      expect(deck.count).toBe(83);

      deck.addCards([{ type: 'number', value: 1, id: 'test' }]);
      expect(deck.count).toBe(84);
    });
  });
});
