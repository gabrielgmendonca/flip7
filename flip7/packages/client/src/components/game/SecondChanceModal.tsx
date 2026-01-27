import React from 'react';
import { Card as CardType } from '@flip7/shared';
import { Card } from '../common/Card';
import { useGame } from '../../context/GameContext';
import './Modal.css';

interface SecondChanceModalProps {
  duplicateCard: CardType;
}

export function SecondChanceModal({ duplicateCard }: SecondChanceModalProps) {
  const { useSecondChance } = useGame();

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Second Chance!</h2>
        <p>You drew a duplicate card:</p>
        <div className="modal-card">
          <Card card={duplicateCard} size="large" />
        </div>
        <p>Would you like to use your Second Chance card to discard this duplicate and continue?</p>
        <div className="modal-actions">
          <button className="danger" onClick={() => useSecondChance(false)}>
            No, Bust
          </button>
          <button className="success" onClick={() => useSecondChance(true)}>
            Yes, Use Second Chance
          </button>
        </div>
      </div>
    </div>
  );
}
