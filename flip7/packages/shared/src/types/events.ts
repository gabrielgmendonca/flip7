import { Card, PlayedCard } from './card';
import { GameSettings, PublicGameState, Player } from './game';
import { PublicRoom, RoomPlayer } from './room';

// Client -> Server events
export interface ClientToServerEvents {
  // Room events
  'room:create': (data: { playerName: string }) => void;
  'room:join': (data: { roomCode: string; playerName: string }) => void;
  'room:leave': () => void;
  'room:kick': (data: { playerId: string }) => void;
  'room:updateSettings': (data: Partial<GameSettings>) => void;

  // Game events
  'game:start': () => void;
  'game:startDebug': () => void;
  'game:action': (data: { action: 'hit' | 'pass' }) => void;
  'game:useSecondChance': (data: { use: boolean }) => void;
  'game:selectFreezeTarget': (data: { targetPlayerId: string }) => void;
  'game:rematch': () => void;

  // Connection events
  'connection:reconnect': (data: { token: string; roomCode: string }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  // Room events
  'room:created': (data: { room: PublicRoom; playerId: string; reconnectToken: string }) => void;
  'room:joined': (data: { room: PublicRoom; playerId: string; reconnectToken: string }) => void;
  'room:playerJoined': (data: { player: RoomPlayer }) => void;
  'room:playerLeft': (data: { playerId: string }) => void;
  'room:playerKicked': (data: { playerId: string }) => void;
  'room:hostChanged': (data: { newHostId: string }) => void;
  'room:settingsUpdated': (data: { settings: GameSettings }) => void;
  'room:error': (data: { message: string }) => void;

  // Game events
  'game:started': (data: { gameState: PublicGameState }) => void;
  'game:stateUpdate': (data: { gameState: PublicGameState }) => void;
  'game:turnStart': (data: { playerId: string; timeoutSeconds: number }) => void;
  'game:cardDrawn': (data: {
    playerId: string;
    card: Card;
    playedCard: PlayedCard;
    isBust: boolean;
  }) => void;
  'game:playerPassed': (data: { playerId: string; roundScore: number }) => void;
  'game:playerBusted': (data: { playerId: string; duplicateCard: Card }) => void;
  'game:playerFrozen': (data: { playerId: string; frozenScore: number }) => void;
  'game:secondChancePrompt': (data: { playerId: string; duplicateCard: Card }) => void;
  'game:secondChanceUsed': (data: { playerId: string; discardedCard: Card }) => void;
  'game:freezeTargetPrompt': (data: { playerId: string; eligibleTargets: string[] }) => void;
  'game:flipThreeStart': (data: { playerId: string; cardsRemaining: number }) => void;
  'game:roundEnd': (data: {
    round: number;
    scores: { playerId: string; roundScore: number; totalScore: number }[];
  }) => void;
  'game:ended': (data: { winnerId: string; finalScores: { playerId: string; score: number }[] }) => void;

  // Connection events
  'connection:reconnected': (data: {
    room: PublicRoom;
    gameState: PublicGameState | null;
    playerId: string;
  }) => void;
  'connection:playerReconnected': (data: { playerId: string }) => void;
  'connection:playerDisconnected': (data: { playerId: string }) => void;
}

// Inter-server events (if needed for scaling)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data
export interface SocketData {
  playerId: string;
  playerName: string;
  roomCode: string | null;
  reconnectToken: string;
}
