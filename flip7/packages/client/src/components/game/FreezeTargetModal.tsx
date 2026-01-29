import React from 'react';
import { Player } from '@flip7/shared';
import { useGame } from '../../context/GameContext';
import './Modal.css';

interface FreezeTargetModalProps {
  eligibleTargets: string[];
  players: Player[];
  currentPlayerId: string | null;
}

export function FreezeTargetModal({ eligibleTargets, players, currentPlayerId }: FreezeTargetModalProps) {
  const { selectFreezeTarget } = useGame();

  const eligiblePlayers = players.filter((p) => eligibleTargets.includes(p.id));

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Choose Player to Freeze</h2>
        <p>Select a player to freeze. Frozen players keep their current score but cannot draw more cards this round.</p>
        <div className="freeze-target-list">
          {eligiblePlayers.map((player) => (
            <button
              key={player.id}
              className={`freeze-target-btn ${player.id === currentPlayerId ? 'self' : ''}`}
              onClick={() => selectFreezeTarget(player.id)}
            >
              <span className="player-name">
                {player.name}
                {player.id === currentPlayerId && ' (You)'}
              </span>
              <span className="player-score">Current: {player.cards.reduce((sum, pc) => {
                if (pc.card.type === 'number') return sum + pc.card.value;
                if (pc.card.type === 'modifier' && pc.card.modifier !== 'x2') return sum + pc.card.modifier;
                return sum;
              }, 0)} pts</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
