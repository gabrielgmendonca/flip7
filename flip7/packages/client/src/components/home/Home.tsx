import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import './Home.css';

export function Home() {
  const { state, dispatch, createRoom, joinRoom, isConnected } = useGame();
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PLAYER_NAME', payload: e.target.value });
  };

  const handleJoin = () => {
    if (joinCode.trim()) {
      joinRoom(joinCode);
    }
  };

  return (
    <div className="home">
      <div className="home-container">
        <h1 className="game-title">Flip 7</h1>
        <p className="game-subtitle">A Press-Your-Luck Card Game</p>

        {!isConnected && (
          <div className="connection-warning">
            Connecting to server...
          </div>
        )}

        {state.error && (
          <div className="error-message">
            {state.error}
            <button onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>Dismiss</button>
          </div>
        )}

        <div className="name-input-container">
          <label htmlFor="playerName">Your Name</label>
          <input
            id="playerName"
            type="text"
            value={state.playerName}
            onChange={handleNameChange}
            placeholder="Enter your name"
            maxLength={20}
          />
        </div>

        {mode === 'menu' ? (
          <div className="menu-buttons">
            <button
              className="primary"
              onClick={createRoom}
              disabled={!isConnected || !state.playerName.trim()}
            >
              Create Room
            </button>
            <button
              className="secondary"
              onClick={() => setMode('join')}
              disabled={!isConnected || !state.playerName.trim()}
            >
              Join Room
            </button>
          </div>
        ) : (
          <div className="join-form">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={6}
              className="room-code-input"
            />
            <div className="join-buttons">
              <button className="secondary" onClick={() => setMode('menu')}>
                Back
              </button>
              <button
                className="primary"
                onClick={handleJoin}
                disabled={!joinCode.trim()}
              >
                Join
              </button>
            </div>
          </div>
        )}

        <div className="rules-summary">
          <h3>How to Play</h3>
          <ul>
            <li><strong>HIT</strong> to draw a card, <strong>PASS</strong> to bank your points</li>
            <li>Drawing a <strong>duplicate number</strong> = BUST (0 points)</li>
            <li>Collect <strong>7 unique numbers</strong> for +15 bonus points</li>
            <li>First to <strong>200 points</strong> wins!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
