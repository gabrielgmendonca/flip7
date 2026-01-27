export type CardType = 'number' | 'action' | 'modifier';

export type ActionType = 'freeze' | 'flip_three' | 'second_chance';

export type ModifierValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'x2';

export interface NumberCard {
  type: 'number';
  value: number; // 0-12
  id: string;
}

export interface ActionCard {
  type: 'action';
  action: ActionType;
  id: string;
}

export interface ModifierCard {
  type: 'modifier';
  modifier: ModifierValue;
  id: string;
}

export type Card = NumberCard | ActionCard | ModifierCard;

export interface PlayedCard {
  card: Card;
  attachedModifiers: ModifierCard[];
}

export function isNumberCard(card: Card): card is NumberCard {
  return card.type === 'number';
}

export function isActionCard(card: Card): card is ActionCard {
  return card.type === 'action';
}

export function isModifierCard(card: Card): card is ModifierCard {
  return card.type === 'modifier';
}

export function getCardPoints(playedCard: PlayedCard): number {
  const { card } = playedCard;

  // Per official rules: modifiers don't attach to individual cards.
  // This function returns just the base card value.
  // Use calculateRoundScore for full scoring with modifiers.
  if (!isNumberCard(card)) {
    return 0;
  }

  return card.value;
}
