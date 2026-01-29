import { Server, Socket } from 'socket.io';
import { RoomManager } from '../../room/RoomManager';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  PublicGameState,
} from '@flip7/shared';

import { Game } from '../../game/Game';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Emit turn start event to all clients in the room.
 */
function emitTurnStart(io: TypedServer, roomCode: string, game: Game): void {
  const currentPlayer = game.getCurrentPlayer();
  if (currentPlayer) {
    const gameState = game.getState() as PublicGameState;
    io.to(roomCode).emit('game:turnStart', {
      playerId: currentPlayer.id,
      timeoutSeconds: gameState.settings.turnTimeoutSeconds,
    });
  }
}

/**
 * Broadcast round end and game end events if applicable.
 */
function broadcastRoundAndGameEnd(io: TypedServer, roomCode: string, gameState: PublicGameState): void {
  if (gameState.phase === 'ROUND_END') {
    io.to(roomCode).emit('game:roundEnd', {
      round: gameState.round,
      scores: gameState.players.map((p) => ({
        playerId: p.id,
        roundScore: p.roundScore,
        totalScore: p.score,
      })),
    });
  }

  if (gameState.phase === 'GAME_END' && gameState.winnerId) {
    io.to(roomCode).emit('game:ended', {
      winnerId: gameState.winnerId,
      finalScores: gameState.players.map((p) => ({
        playerId: p.id,
        score: p.score,
      })),
    });
  }
}

export function registerGameHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomManager: RoomManager
): void {
  const handleGameStart = (debugMode: boolean) => {
    console.log('game:start received from', socket.id, 'debugMode:', debugMode);
    console.log('socket.data:', socket.data);

    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return;
    }

    // Callback to broadcast state when a new round starts (after timeout)
    const onRoundStart = () => {
      const game = roomManager.getGame(roomCode);
      if (!game) return;

      const gameState = game.getState() as PublicGameState;
      io.to(roomCode).emit('game:stateUpdate', { gameState });
      emitTurnStart(io, roomCode, game);
    };

    const game = roomManager.startGame(socket.id, onRoundStart, debugMode);

    if (!game) {
      console.log('startGame returned null');
      socket.emit('room:error', { message: 'Unable to start game. You may not be the host or need more players.' });
      return;
    }

    console.log('Game started successfully');

    const gameState = game.getState() as PublicGameState;
    io.to(roomCode).emit('game:started', { gameState });
    emitTurnStart(io, roomCode, game);
  };

  socket.on('game:start', () => handleGameStart(false));
  socket.on('game:startDebug', () => handleGameStart(true));

  socket.on('game:action', ({ action }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return;
    }

    const game = roomManager.getGame(roomCode);
    if (!game) {
      return;
    }

    const currentPlayer = game.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit('room:error', { message: "It's not your turn." });
      return;
    }

    if (action === 'hit') {
      const result = game.hit(socket.id);

      if (!result) {
        socket.emit('room:error', { message: 'Unable to draw card.' });
        return;
      }

      io.to(roomCode).emit('game:cardDrawn', {
        playerId: socket.id,
        card: result.card,
        playedCard: result.playedCard,
        isBust: result.isBust,
      });

      if (result.isBust && result.hasSecondChance) {
        io.to(roomCode).emit('game:secondChancePrompt', {
          playerId: socket.id,
          duplicateCard: result.duplicateCard!,
        });
        return;
      }

      if (result.isBust) {
        io.to(roomCode).emit('game:playerBusted', {
          playerId: socket.id,
          duplicateCard: result.duplicateCard!,
        });
      }

      if (result.triggersFreeze) {
        const updatedState = game.getState();
        if (updatedState.pendingFreezeTarget) {
          // Player needs to select a freeze target
          io.to(roomCode).emit('game:freezeTargetPrompt', {
            playerId: socket.id,
            eligibleTargets: updatedState.pendingFreezeTarget.eligibleTargets,
          });
        } else {
          // Auto-frozen (only one eligible target)
          const player = game.getPlayer(socket.id);
          io.to(roomCode).emit('game:playerFrozen', {
            playerId: socket.id,
            frozenScore: player?.roundScore || 0,
          });
        }
      }

      if (result.triggersFlipThree) {
        const updatedState = game.getState();
        if (updatedState.pendingFlipThreeTarget) {
          // Player needs to select a Flip Three target
          io.to(roomCode).emit('game:flipThreeTargetPrompt', {
            playerId: socket.id,
            eligibleTargets: updatedState.pendingFlipThreeTarget.eligibleTargets,
          });
        } else {
          // Auto-targeted (only one eligible target)
          io.to(roomCode).emit('game:flipThreeStart', {
            playerId: socket.id,
            targetPlayerId: socket.id, // Will be the only target
            cardsRemaining: 3,
          });
        }
      }
    } else if (action === 'pass') {
      const success = game.pass(socket.id);

      if (!success) {
        socket.emit('room:error', { message: 'Unable to pass.' });
        return;
      }

      const player = game.getPlayer(socket.id);
      io.to(roomCode).emit('game:playerPassed', {
        playerId: socket.id,
        roundScore: player?.roundScore || 0,
      });
    }

    // Send updated game state
    const gameState = game.getState() as PublicGameState;
    io.to(roomCode).emit('game:stateUpdate', { gameState });

    // Check for round end or game end
    broadcastRoundAndGameEnd(io, roomCode, gameState);

    // Send next turn start if game continues
    if (gameState.phase === 'PLAYER_TURN') {
      emitTurnStart(io, roomCode, game);
    }
  });

  socket.on('game:useSecondChance', ({ use }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return;
    }

    const game = roomManager.getGame(roomCode);
    if (!game) {
      return;
    }

    const gameState = game.getState();
    if (!gameState.pendingSecondChance || gameState.pendingSecondChance.playerId !== socket.id) {
      socket.emit('room:error', { message: 'No Second Chance pending for you.' });
      return;
    }

    const success = game.useSecondChance(socket.id, use);

    if (!success) {
      socket.emit('room:error', { message: 'Unable to use Second Chance.' });
      return;
    }

    if (use) {
      io.to(roomCode).emit('game:secondChanceUsed', {
        playerId: socket.id,
        discardedCard: gameState.pendingSecondChance.duplicateCard,
      });
    } else {
      io.to(roomCode).emit('game:playerBusted', {
        playerId: socket.id,
        duplicateCard: gameState.pendingSecondChance.duplicateCard,
      });
    }

    // Send updated game state
    const newGameState = game.getState() as PublicGameState;
    io.to(roomCode).emit('game:stateUpdate', { gameState: newGameState });

    // Send next turn start
    if (newGameState.phase === 'PLAYER_TURN') {
      emitTurnStart(io, roomCode, game);
    }
  });

  socket.on('game:selectFreezeTarget', ({ targetPlayerId }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return;
    }

    const game = roomManager.getGame(roomCode);
    if (!game) {
      return;
    }

    const gameState = game.getState();
    if (!gameState.pendingFreezeTarget || gameState.pendingFreezeTarget.playerId !== socket.id) {
      socket.emit('room:error', { message: 'No freeze target selection pending for you.' });
      return;
    }

    const success = game.selectFreezeTarget(socket.id, targetPlayerId);

    if (!success) {
      socket.emit('room:error', { message: 'Unable to select freeze target.' });
      return;
    }

    const targetPlayer = game.getPlayer(targetPlayerId);
    io.to(roomCode).emit('game:playerFrozen', {
      playerId: targetPlayerId,
      frozenScore: targetPlayer?.roundScore || 0,
    });

    // Send updated game state
    const newGameState = game.getState() as PublicGameState;
    io.to(roomCode).emit('game:stateUpdate', { gameState: newGameState });

    // Check for round end or game end
    broadcastRoundAndGameEnd(io, roomCode, newGameState);

    // Send next turn start if game continues
    if (newGameState.phase === 'PLAYER_TURN') {
      emitTurnStart(io, roomCode, game);
    }
  });

  socket.on('game:selectFlipThreeTarget', ({ targetPlayerId }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return;
    }

    const game = roomManager.getGame(roomCode);
    if (!game) {
      return;
    }

    const gameState = game.getState();
    if (!gameState.pendingFlipThreeTarget || gameState.pendingFlipThreeTarget.playerId !== socket.id) {
      socket.emit('room:error', { message: 'No Flip Three target selection pending for you.' });
      return;
    }

    const success = game.selectFlipThreeTarget(socket.id, targetPlayerId);

    if (!success) {
      socket.emit('room:error', { message: 'Unable to select Flip Three target.' });
      return;
    }

    const targetPlayer = game.getPlayer(targetPlayerId);
    io.to(roomCode).emit('game:flipThreeStart', {
      playerId: socket.id,
      targetPlayerId: targetPlayerId,
      cardsRemaining: 3,
    });

    // Send updated game state
    const newGameState = game.getState() as PublicGameState;
    io.to(roomCode).emit('game:stateUpdate', { gameState: newGameState });

    // Check for round end or game end
    broadcastRoundAndGameEnd(io, roomCode, newGameState);

    // Send next turn start if game continues
    if (newGameState.phase === 'PLAYER_TURN') {
      emitTurnStart(io, roomCode, game);
    }
  });

  socket.on('game:rematch', () => {
    console.log('game:rematch received from', socket.id);

    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return;
    }

    // Callback to broadcast state when a new round starts (after timeout)
    const onRoundStart = () => {
      const game = roomManager.getGame(roomCode);
      if (!game) return;

      const gameState = game.getState() as PublicGameState;
      io.to(roomCode).emit('game:stateUpdate', { gameState });
      emitTurnStart(io, roomCode, game);
    };

    const game = roomManager.rematch(socket.id, onRoundStart);

    if (!game) {
      socket.emit('room:error', { message: 'Unable to start rematch. You may not be the host or need more players.' });
      return;
    }

    const gameState = game.getState() as PublicGameState;
    io.to(roomCode).emit('game:started', { gameState });
    emitTurnStart(io, roomCode, game);
  });
}
