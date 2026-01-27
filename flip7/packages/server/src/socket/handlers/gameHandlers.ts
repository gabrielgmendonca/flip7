import { Server, Socket } from 'socket.io';
import { RoomManager } from '../../room/RoomManager';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  PublicGameState,
} from '@flip7/shared';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerGameHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomManager: RoomManager
): void {
  socket.on('game:start', () => {
    console.log('game:start received from', socket.id);
    console.log('socket.data:', socket.data);

    const game = roomManager.startGame(socket.id);

    if (!game) {
      console.log('startGame returned null');
      socket.emit('room:error', { message: 'Unable to start game. You may not be the host or need more players.' });
      return;
    }

    console.log('Game started successfully');

    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      return;
    }

    const gameState = game.getState() as PublicGameState;
    io.to(roomCode).emit('game:started', { gameState });

    // Send turn start to current player
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer) {
      io.to(roomCode).emit('game:turnStart', {
        playerId: currentPlayer.id,
        timeoutSeconds: gameState.settings.turnTimeoutSeconds,
      });
    }
  });

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
        const player = game.getPlayer(socket.id);
        io.to(roomCode).emit('game:playerFrozen', {
          playerId: socket.id,
          frozenScore: player?.roundScore || 0,
        });
      }

      if (result.triggersFlipThree) {
        io.to(roomCode).emit('game:flipThreeStart', {
          playerId: socket.id,
          cardsRemaining: 3,
        });
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

    // Send next turn start if game continues
    if (gameState.phase === 'PLAYER_TURN') {
      const nextPlayer = game.getCurrentPlayer();
      if (nextPlayer) {
        io.to(roomCode).emit('game:turnStart', {
          playerId: nextPlayer.id,
          timeoutSeconds: gameState.settings.turnTimeoutSeconds,
        });
      }
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
      const nextPlayer = game.getCurrentPlayer();
      if (nextPlayer) {
        io.to(roomCode).emit('game:turnStart', {
          playerId: nextPlayer.id,
          timeoutSeconds: newGameState.settings.turnTimeoutSeconds,
        });
      }
    }
  });
}
