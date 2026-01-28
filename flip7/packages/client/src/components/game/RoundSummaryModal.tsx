import React from 'react';
import { RoundEndData } from '../../context/GameContext';
import { Confetti } from '../common/Confetti';
import './Modal.css';
import './RoundSummaryModal.css';

interface RoundSummaryModalProps {
  data: RoundEndData;
  currentPlayerId: string | null;
  onContinue: () => void;
}

export function RoundSummaryModal({ data, currentPlayerId, onContinue }: RoundSummaryModalProps) {
  const sortedScores = [...data.scores].sort((a, b) => b.totalScore - a.totalScore);
  const hasWinner = sortedScores.length > 0 && sortedScores[0].roundScore > 0;

  return (
    <div className="modal-overlay">
      {hasWinner && <Confetti />}
      <div className="modal round-summary-modal">
        <h2>Round {data.round} Complete</h2>

        <div className="round-scores">
          {sortedScores.map((score, index) => {
            const isMe = score.playerId === currentPlayerId;
            const scoreChange = score.roundScore;
            return (
              <div key={score.playerId} className={`round-score-item ${isMe ? 'is-me' : ''}`}>
                <span className="round-rank">#{index + 1}</span>
                <span className="round-player-name">{score.playerName}</span>
                <div className="round-score-details">
                  <span className={`round-score-change ${scoreChange > 0 ? 'positive' : scoreChange === 0 ? 'zero' : ''}`}>
                    {scoreChange > 0 ? '+' : ''}{scoreChange}
                  </span>
                  <span className="round-total-score">{score.totalScore}</span>
                </div>
              </div>
            );
          })}
        </div>

        <button className="primary" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
