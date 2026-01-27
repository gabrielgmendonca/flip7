import { Card, NumberCard, ActionCard, ModifierCard } from '@flip7/shared';
import { v4 as uuidv4 } from 'uuid';

export class Deck {
  private cards: Card[] = [];

  constructor() {
    this.createDeck();
    this.shuffle();
  }

  private createDeck(): void {
    this.cards = [];

    // Number cards: 0-12
    // Per official rules: there is one 0 card, one 1 card, two 2 cards, etc.
    // Total: 1+1+2+3+4+5+6+7+8+9+10+11+12 = 79 cards
    for (let value = 0; value <= 12; value++) {
      const count = value === 0 ? 1 : value; // One 0 card, otherwise quantity equals value
      for (let i = 0; i < count; i++) {
        const card: NumberCard = {
          type: 'number',
          value,
          id: uuidv4(),
        };
        this.cards.push(card);
      }
    }

    // Action cards (10 total)
    // Freeze: 4 cards
    for (let i = 0; i < 4; i++) {
      const card: ActionCard = {
        type: 'action',
        action: 'freeze',
        id: uuidv4(),
      };
      this.cards.push(card);
    }

    // Flip Three: 3 cards
    for (let i = 0; i < 3; i++) {
      const card: ActionCard = {
        type: 'action',
        action: 'flip_three',
        id: uuidv4(),
      };
      this.cards.push(card);
    }

    // Second Chance: 3 cards
    for (let i = 0; i < 3; i++) {
      const card: ActionCard = {
        type: 'action',
        action: 'second_chance',
        id: uuidv4(),
      };
      this.cards.push(card);
    }

    // Modifier cards (5 total to reach 94)
    // Per rules: +2 to +10 and X2 exist
    const modifiers: Array<ModifierCard['modifier']> = [2, 4, 6, 8, 'x2'];
    for (const modifier of modifiers) {
      const card: ModifierCard = {
        type: 'modifier',
        modifier,
        id: uuidv4(),
      };
      this.cards.push(card);
    }

    // Total: 79 (numbers) + 10 (actions) + 5 (modifiers) = 94 cards
  }

  shuffle(): void {
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(): Card | null {
    return this.cards.pop() || null;
  }

  drawMultiple(count: number): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.draw();
      if (card) {
        drawn.push(card);
      }
    }
    return drawn;
  }

  get count(): number {
    return this.cards.length;
  }

  isEmpty(): boolean {
    return this.cards.length === 0;
  }

  // Add cards back to deck (for reshuffling discard pile)
  addCards(cards: Card[]): void {
    this.cards.push(...cards);
  }

  reset(): void {
    this.createDeck();
    this.shuffle();
  }
}
