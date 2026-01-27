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

  return <div className={getCardClass()}>{renderCardContent()}</div>;
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
