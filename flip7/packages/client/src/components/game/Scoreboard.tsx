import React, { useState } from 'react';
import { Player } from '@flip7/shared';
import './Scoreboard.css';

interface ScoreboardProps {
  players: Player[];
  currentPlayerId: string | null;
  targetScore: number;
}

export function Scoreboard({ players, currentPlayerId, targetScore }: ScoreboardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={`scoreboard ${isCollapsed ? 'collapsed' : ''}`}>
      <h3 className="scoreboard-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        Scoreboard <span className="target-label">/{targetScore}</span>
        <span className="collapse-indicator">{isCollapsed ? '\u25B2' : '\u25BC'}</span>
      </h3>
      <div className="score-list">
        {sortedPlayers.map((player, index) => {
          const progress = Math.min((player.score / targetScore) * 100, 100);
          const isClose = progress >= 75;
          return (
            <div
              key={player.id}
              className={`score-item ${player.id === currentPlayerId ? 'is-me' : ''}`}
            >
              <span className="score-rank">#{index + 1}</span>
              <span className="score-name">{player.name}</span>
              <span className="score-value">{player.score}</span>
              <div className="score-progress-bar">
                <div
                  className={`score-progress-fill ${isClose ? 'close-to-win' : ''}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
