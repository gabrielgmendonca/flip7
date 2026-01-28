import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { PlayedCardComponent, CardBack } from '../common/Card';
import { PlayerArea } from './PlayerArea';
import { Scoreboard } from './Scoreboard';
import { SecondChanceModal } from './SecondChanceModal';
import { GameOverModal } from './GameOverModal';
import { TurnTimer } from './TurnTimer';
import { ActivityLog } from './ActivityLog';
import { RoundSummaryModal } from './RoundSummaryModal';
import { HelpModal } from './HelpModal';
import './GameBoard.css';
import './Modal.css';
import './HelpModal.css';

export function GameBoard() {
  const { state, dispatch, hit, pass, leaveRoom } = useGame();
  const { gameState, playerId, secondChancePrompt, lastDrawnCard, turnTimer, activityLog, pendingAction, roundEndData, showRoundSummary } = state;

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  if (!gameState) return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId && gameState.phase === 'PLAYER_TURN';
  const myPlayer = gameState.players.find((p) => p.id === playerId);
  const canAct = isMyTurn && myPlayer?.status === 'active';

  const otherPlayers = gameState.players.filter((p) => p.id !== playerId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canAct) return;
      if (e.key.toLowerCase() === 'h') {
        hit();
      } else if (e.key.toLowerCase() === 'p') {
        pass();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canAct, hit, pass]);

  return (
    <div className="game-board">
      <div className="game-header">
        <div className="round-info">
          <span>Round {gameState.round}</span>
          <span className="deck-count">{gameState.deckCount} cards left</span>
        </div>
        <button className="secondary leave-btn" onClick={() => setShowLeaveConfirm(true)}>
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
              lastDrawnCardId={lastDrawnCard?.playedCard.card.id}
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
              <>
                <span className={isMyTurn ? 'your-turn' : ''}>
                  {isMyTurn ? "Your Turn!" : `${currentPlayer?.name}'s Turn`}
                </span>
                {turnTimer && (
                  <TurnTimer
                    startTime={turnTimer.startTime}
                    timeoutSeconds={turnTimer.timeoutSeconds}
                  />
                )}
              </>
            )}
            {gameState.phase === 'ROUND_END' && <span>Round Over</span>}
            {gameState.phase === 'AWAITING_SECOND_CHANCE' && (
              <span>Awaiting Second Chance decision...</span>
            )}
          </div>

          {canAct && (
            <div className="action-buttons">
              <button className="primary hit-btn" onClick={hit} disabled={pendingAction} title="Press H">
                {pendingAction ? <span className="btn-spinner" /> : <>HIT <span className="shortcut-hint">(H)</span></>}
              </button>
              <button className="secondary pass-btn" onClick={pass} disabled={pendingAction} title="Press P">
                {pendingAction ? <span className="btn-spinner" /> : <>PASS <span className="shortcut-hint">(P)</span></>}
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
              lastDrawnCardId={lastDrawnCard?.playedCard.card.id}
              showBustRisk={canAct}
            />
          </div>
        )}
      </div>

      <Scoreboard players={gameState.players} currentPlayerId={playerId} targetScore={gameState.settings.targetScore} />
      <ActivityLog entries={activityLog} />

      <button className="help-btn" onClick={() => setShowHelp(true)}>
        ? Help
      </button>

      {secondChancePrompt && <SecondChanceModal duplicateCard={secondChancePrompt.duplicateCard} />}
      {showRoundSummary && roundEndData && (
        <RoundSummaryModal
          data={roundEndData}
          currentPlayerId={playerId}
          onContinue={() => dispatch({ type: 'SHOW_ROUND_SUMMARY', payload: false })}
        />
      )}
      {gameState.phase === 'GAME_END' && gameState.winnerId && (
        <GameOverModal winnerId={gameState.winnerId} players={gameState.players} />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {showLeaveConfirm && (
        <div className="modal-overlay">
          <div className="modal leave-confirm-modal">
            <h2>Leave Game?</h2>
            <p>Are you sure you want to leave? You won't be able to rejoin this game.</p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setShowLeaveConfirm(false)}>
                Cancel
              </button>
              <button className="danger" onClick={leaveRoom}>
                Leave Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
