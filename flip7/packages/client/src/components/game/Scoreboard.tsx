import React from 'react';
import { Player } from '@flip7/shared';
import './Scoreboard.css';

interface ScoreboardProps {
  players: Player[];
  currentPlayerId: string | null;
}

export function Scoreboard({ players, currentPlayerId }: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="scoreboard">
      <h3>Scoreboard</h3>
      <div className="score-list">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`score-item ${player.id === currentPlayerId ? 'is-me' : ''}`}
          >
            <span className="score-rank">#{index + 1}</span>
            <span className="score-name">{player.name}</span>
            <span className="score-value">{player.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
