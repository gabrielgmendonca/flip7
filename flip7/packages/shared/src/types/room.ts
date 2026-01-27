import { GameState, GameSettings } from './game';

export interface Room {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  settings: GameSettings;
  gameState: GameState | null;
  createdAt: Date;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
}

export interface PublicRoom {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  settings: GameSettings;
  hasActiveGame: boolean;
}
