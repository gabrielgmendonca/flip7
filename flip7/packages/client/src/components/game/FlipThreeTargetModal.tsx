import React from 'react';
import { Player } from '@flip7/shared';
import { useGame } from '../../context/GameContext';
import './Modal.css';

interface FlipThreeTargetModalProps {
  eligibleTargets: string[];
  players: Player[];
  currentPlayerId: string | null;
}

export function FlipThreeTargetModal({ eligibleTargets, players, currentPlayerId }: FlipThreeTargetModalProps) {
  const { selectFlipThreeTarget } = useGame();

  const eligiblePlayers = players.filter((p) => eligibleTargets.includes(p.id));

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Choose Player for Flip Three</h2>
        <p>Select a player who must draw 3 cards. They may bust if they draw a duplicate!</p>
        <div className="freeze-target-list">
          {eligiblePlayers.map((player) => (
            <button
              key={player.id}
              className={`freeze-target-btn ${player.id === currentPlayerId ? 'self' : ''}`}
              onClick={() => selectFlipThreeTarget(player.id)}
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
