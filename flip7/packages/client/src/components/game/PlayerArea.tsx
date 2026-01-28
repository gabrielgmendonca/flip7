import React, { useRef } from 'react';
import { Player, isNumberCard } from '@flip7/shared';
import { PlayedCardComponent } from '../common/Card';
import { ScoreAnimation } from './ScoreAnimation';
import './PlayerArea.css';
import './ScoreAnimation.css';

interface PlayerAreaProps {
  player: Player;
  isCurrentTurn: boolean;
  isMe?: boolean;
  isCompact?: boolean;
  lastDrawnCardId?: string;
  showBustRisk?: boolean;
}

export function PlayerArea({ player, isCurrentTurn, isMe = false, isCompact = false, lastDrawnCardId, showBustRisk = false }: PlayerAreaProps) {
  const prevRoundScoreRef = useRef(player.roundScore);

  const uniqueNumbers = new Set(
    player.cards.filter((pc) => isNumberCard(pc.card)).map((pc) => (pc.card as any).value)
  );

  const allNumbers = Array.from({ length: 13 }, (_, i) => i);

  const statusLabel = {
    active: '',
    passed: 'Passed',
    busted: 'Busted!',
    frozen: 'Frozen',
    disconnected: 'Disconnected',
  };

  // Update previous score ref after render
  const previousRoundScore = prevRoundScoreRef.current;
  React.useEffect(() => {
    prevRoundScoreRef.current = player.roundScore;
  }, [player.roundScore]);

  return (
    <div className={`player-area ${isMe ? 'player-area-me' : ''} ${isCompact ? 'player-area-compact' : ''} ${isCurrentTurn ? 'current-turn' : ''}`}>
      <div className="player-header">
        <div className="player-info">
          <span className="player-name">{player.name}</span>
          {isMe && <span className="me-indicator">(You)</span>}
        </div>
        <div className="player-stats">
          <span className="round-score" style={{ position: 'relative' }}>
            Round: <strong>{player.roundScore}</strong>
            <ScoreAnimation score={player.roundScore} previousScore={previousRoundScore} />
          </span>
          <span className={`unique-count ${uniqueNumbers.size === 6 ? 'flip-seven-ready' : ''}`}>
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
              isNew={playedCard.card.id === lastDrawnCardId}
            />
          ))
        )}
      </div>

      {showBustRisk && uniqueNumbers.size > 0 && (
        <div className="bust-risk">
          <span className="bust-risk-label">Bust risk:</span>
          <div className="bust-risk-numbers">
            {allNumbers.map((num) => (
              <span
                key={num}
                className={`bust-risk-num ${uniqueNumbers.has(num) ? 'danger' : 'safe'}`}
                title={uniqueNumbers.has(num) ? `Drawing ${num} will bust!` : `${num} is safe`}
              >
                {num}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
