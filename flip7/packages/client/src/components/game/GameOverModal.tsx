import React from 'react';
import { Player } from '@flip7/shared';
import { useGame } from '../../context/GameContext';
import './Modal.css';

interface GameOverModalProps {
  winnerId: string;
  players: Player[];
}

export function GameOverModal({ winnerId, players }: GameOverModalProps) {
  const { state, leaveRoom } = useGame();
  const winner = players.find((p) => p.id === winnerId);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const isWinner = winnerId === state.playerId;

  return (
    <div className="modal-overlay">
      <div className="modal game-over-modal">
        <h2>{isWinner ? 'You Win!' : 'Game Over'}</h2>
        <div className="winner-announcement">
          <span className="winner-name">{winner?.name}</span>
          <span className="winner-label">wins with {winner?.score} points!</span>
        </div>

        <div className="final-standings">
          <h3>Final Standings</h3>
          <ol className="standings-list">
            {sortedPlayers.map((player, index) => (
              <li
                key={player.id}
                className={`standing-item ${player.id === state.playerId ? 'is-me' : ''} ${player.id === winnerId ? 'is-winner' : ''}`}
              >
                <span className="standing-rank">{index + 1}</span>
                <span className="standing-name">{player.name}</span>
                <span className="standing-score">{player.score}</span>
              </li>
            ))}
          </ol>
        </div>

        <button className="primary" onClick={leaveRoom}>
          Return to Home
        </button>
      </div>
    </div>
  );
}
