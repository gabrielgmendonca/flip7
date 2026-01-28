import React from 'react';
import { Card as CardType, PlayedCard, isNumberCard, isActionCard, isModifierCard } from '@flip7/shared';
import './Card.css';

interface CardProps {
  card: CardType;
  attachedModifiers?: CardType[];
  isNew?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function Card({ card, attachedModifiers = [], isNew = false, size = 'medium' }: CardProps) {
  const getCardClass = () => {
    let className = `game-card game-card-${size}`;
    if (isNew) className += ' game-card-new';

    if (isNumberCard(card)) {
      className += ' game-card-number';
    } else if (isActionCard(card)) {
      className += ' game-card-action';
    } else if (isModifierCard(card)) {
      className += ' game-card-modifier';
    }

    return className;
  };

  const getTooltip = (): string => {
    if (isNumberCard(card)) {
      const modDesc = attachedModifiers.map(mod =>
        isModifierCard(mod) ? (mod.modifier === 'x2' ? 'x2' : `+${mod.modifier}`) : ''
      ).filter(Boolean).join(', ');
      return modDesc ? `${card.value} (${modDesc})` : `Number ${card.value}`;
    }
    if (isActionCard(card)) {
      const descriptions: Record<string, string> = {
        freeze: 'Freeze: Skip your next turn but keep your cards safe',
        flip_three: 'Flip 3: Draw 3 cards at once',
        second_chance: 'Second Chance: If you bust, choose to keep or discard the duplicate',
      };
      return descriptions[card.action] || card.action;
    }
    if (isModifierCard(card)) {
      if (card.modifier === 'x2') {
        return 'x2: Doubles the value of the attached number card';
      }
      return `+${card.modifier}: Adds ${card.modifier} points to the attached number card`;
    }
    return '';
  };

  const renderCardContent = () => {
    if (isNumberCard(card)) {
      return (
        <div className="card-content">
          <span className="card-value">{card.value}</span>
          {attachedModifiers.length > 0 && (
            <div className="card-modifiers">
              {attachedModifiers.map((mod, i) => (
                <span key={i} className="modifier-badge">
                  {isModifierCard(mod) && (mod.modifier === 'x2' ? 'x2' : `+${mod.modifier}`)}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (isActionCard(card)) {
      const actionLabels = {
        freeze: 'FREEZE',
        flip_three: 'FLIP 3',
        second_chance: '2ND CHANCE',
      };
      return (
        <div className="card-content">
          <span className="card-action">{actionLabels[card.action]}</span>
        </div>
      );
    }

    if (isModifierCard(card)) {
      return (
        <div className="card-content">
          <span className="card-modifier-value">
            {card.modifier === 'x2' ? 'x2' : `+${card.modifier}`}
          </span>
        </div>
      );
    }

    return null;
  };

  return <div className={getCardClass()} title={getTooltip()}>{renderCardContent()}</div>;
}

interface PlayedCardProps {
  playedCard: PlayedCard;
  isNew?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function PlayedCardComponent({ playedCard, isNew = false, size = 'medium' }: PlayedCardProps) {
  return (
    <Card
      card={playedCard.card}
      attachedModifiers={playedCard.attachedModifiers}
      isNew={isNew}
      size={size}
    />
  );
}

export function CardBack({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  return (
    <div className={`game-card game-card-${size} game-card-back`}>
      <div className="card-content">
        <span className="card-back-text">FLIP 7</span>
      </div>
    </div>
  );
}
