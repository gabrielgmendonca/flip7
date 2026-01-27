import React from 'react';
import { useGame } from '../../context/GameContext';
import { PlayedCardComponent, CardBack } from '../common/Card';
import { PlayerArea } from './PlayerArea';
import { Scoreboard } from './Scoreboard';
import { SecondChanceModal } from './SecondChanceModal';
import { GameOverModal } from './GameOverModal';
import './GameBoard.css';

export function GameBoard() {
  const { state, hit, pass, leaveRoom } = useGame();
  const { gameState, playerId, secondChancePrompt } = state;

  if (!gameState) return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId && gameState.phase === 'PLAYER_TURN';
  const myPlayer = gameState.players.find((p) => p.id === playerId);
  const canAct = isMyTurn && myPlayer?.status === 'active';

  const otherPlayers = gameState.players.filter((p) => p.id !== playerId);

  return (
    <div className="game-board">
      <div className="game-header">
        <div className="round-info">
          <span>Round {gameState.round}</span>
          <span className="deck-count">{gameState.deckCount} cards left</span>
        </div>
        <button className="secondary leave-btn" onClick={leaveRoom}>
          Leave Game
        </button>
      </div>

      <div className="game-main">
        <div className="opponents-area">
          {otherPlayers.map((player) => (
            <PlayerArea
              key={player.id}
              player={player}
              isCurrentTurn={currentPlayer?.id === player.id}
              isCompact
            />
          ))}
        </div>

        <div className="center-area">
          <div className="deck-area">
            <CardBack size="large" />
            <span className="deck-label">Deck</span>
          </div>

          <div className="turn-indicator">
            {gameState.phase === 'PLAYER_TURN' && (
              <span className={isMyTurn ? 'your-turn' : ''}>
                {isMyTurn ? "Your Turn!" : `${currentPlayer?.name}'s Turn`}
              </span>
            )}
            {gameState.phase === 'ROUND_END' && <span>Round Over</span>}
            {gameState.phase === 'AWAITING_SECOND_CHANCE' && (
              <span>Awaiting Second Chance decision...</span>
            )}
          </div>

          {canAct && (
            <div className="action-buttons">
              <button className="primary hit-btn" onClick={hit}>
                HIT
              </button>
              <button className="secondary pass-btn" onClick={pass}>
                PASS
              </button>
            </div>
          )}
        </div>

        {myPlayer && (
          <div className="my-area">
            <PlayerArea
              player={myPlayer}
              isCurrentTurn={isMyTurn}
              isMe
            />
          </div>
        )}
      </div>

      <Scoreboard players={gameState.players} currentPlayerId={playerId} />

      {secondChancePrompt && <SecondChanceModal duplicateCard={secondChancePrompt.duplicateCard} />}
      {gameState.phase === 'GAME_END' && gameState.winnerId && (
        <GameOverModal winnerId={gameState.winnerId} players={gameState.players} />
      )}
    </div>
  );
}
