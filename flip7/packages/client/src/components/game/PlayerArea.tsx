import React from 'react';
import { Player, isNumberCard } from '@flip7/shared';
import { PlayedCardComponent } from '../common/Card';
import './PlayerArea.css';

interface PlayerAreaProps {
  player: Player;
  isCurrentTurn: boolean;
  isMe?: boolean;
  isCompact?: boolean;
}

export function PlayerArea({ player, isCurrentTurn, isMe = false, isCompact = false }: PlayerAreaProps) {
  const uniqueNumbers = new Set(
    player.cards.filter((pc) => isNumberCard(pc.card)).map((pc) => (pc.card as any).value)
  );

  const statusLabel = {
    active: '',
    passed: 'Passed',
    busted: 'Busted!',
    frozen: 'Frozen',
    disconnected: 'Disconnected',
  };

  return (
    <div className={`player-area ${isMe ? 'player-area-me' : ''} ${isCompact ? 'player-area-compact' : ''} ${isCurrentTurn ? 'current-turn' : ''}`}>
      <div className="player-header">
        <div className="player-info">
          <span className="player-name">{player.name}</span>
          {isMe && <span className="me-indicator">(You)</span>}
        </div>
        <div className="player-stats">
          <span className="round-score">
            Round: <strong>{player.roundScore}</strong>
          </span>
          <span className="unique-count">
            Unique: <strong>{uniqueNumbers.size}/7</strong>
          </span>
        </div>
        {player.status !== 'active' && (
          <span className={`status-badge status-${player.status}`}>
            {statusLabel[player.status]}
          </span>
        )}
      </div>

      <div className={`player-cards ${isCompact ? 'cards-compact' : ''}`}>
        {player.cards.length === 0 ? (
          <span className="no-cards">No cards</span>
        ) : (
          player.cards.map((playedCard, index) => (
            <PlayedCardComponent
              key={playedCard.card.id}
              playedCard={playedCard}
              size={isCompact ? 'small' : 'medium'}
            />
          ))
        )}
      </div>
    </div>
  );
}
