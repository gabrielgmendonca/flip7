import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import './Lobby.css';

export function Lobby() {
  const { state, leaveRoom, startGame, kickPlayer, updateSettings } = useGame();
  const { room, playerId } = state;
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const isHost = room.hostId === playerId;
  const canStart = room.players.length >= 3;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1>Game Lobby</h1>
        <div className="room-code-container">
          <span className="room-code-label">Room Code:</span>
          <span className="room-code">{room.code}</span>
          <button className={`secondary ${copied ? 'copied' : ''}`} onClick={handleCopyCode}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="lobby-content">
        <div className="players-section">
          <h2>Players ({room.players.length}/{room.settings.maxPlayers})</h2>
          <ul className="player-list">
            {room.players.map((player) => (
              <li key={player.id} className={`player-item ${!player.isConnected ? 'disconnected' : ''}`}>
                <span className="player-name">
                  {player.name}
                  {player.isHost && <span className="host-badge">Host</span>}
                  {player.id === playerId && <span className="you-badge">You</span>}
                </span>
                {isHost && player.id !== playerId && (
                  <button className="danger kick-btn" onClick={() => kickPlayer(player.id)}>
                    Kick
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {isHost && (
          <div className="settings-section">
            <h2>Game Settings</h2>
            <div className="setting-item">
              <label>Target Score:</label>
              <input
                type="number"
                value={room.settings.targetScore}
                onChange={(e) => updateSettings({ targetScore: parseInt(e.target.value) || 200 })}
                min={50}
                max={500}
                step={50}
              />
            </div>
            <div className="setting-item">
              <label>Turn Timeout (seconds):</label>
              <input
                type="number"
                value={room.settings.turnTimeoutSeconds}
                onChange={(e) => updateSettings({ turnTimeoutSeconds: parseInt(e.target.value) || 30 })}
                min={10}
                max={120}
                step={5}
              />
            </div>
          </div>
        )}
      </div>

      <div className="lobby-actions">
        <button className="secondary" onClick={leaveRoom}>
          Leave Room
        </button>
        {isHost && (
          <button className="primary" onClick={startGame} disabled={!canStart}>
            {canStart ? 'Start Game' : 'Need 3+ Players'}
          </button>
        )}
      </div>
    </div>
  );
}
