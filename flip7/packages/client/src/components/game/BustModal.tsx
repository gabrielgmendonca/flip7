import React, { useEffect } from 'react';
import { Card as CardType } from '@flip7/shared';
import { Card } from '../common/Card';
import { useGame } from '../../context/GameContext';
import './Modal.css';

interface BustModalProps {
  playerName: string;
  duplicateCard: CardType;
  isMe: boolean;
}

export function BustModal({ playerName, duplicateCard, isMe }: BustModalProps) {
  const { clearBustInfo } = useGame();

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      clearBustInfo();
    }, 3000);

    return () => clearTimeout(timer);
  }, [clearBustInfo]);

  const cardValue = duplicateCard.type === 'number' ? duplicateCard.value : '?';

  return (
    <div className="modal-overlay" onClick={clearBustInfo}>
      <div className="modal bust-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isMe ? 'You Busted!' : `${playerName} Busted!`}</h2>
        <p>
          {isMe ? 'You drew' : `${playerName} drew`} a duplicate <strong>{cardValue}</strong>:
        </p>
        <div className="modal-card">
          <Card card={duplicateCard} size="large" />
        </div>
        <p className="bust-hint">Click anywhere to dismiss</p>
      </div>
    </div>
  );
}
