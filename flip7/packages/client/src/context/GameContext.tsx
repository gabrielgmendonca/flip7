import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  PublicRoom,
  PublicGameState,
  RoomPlayer,
  GameSettings,
  Card,
  PlayedCard,
} from '@flip7/shared';
import { useSocket } from '../hooks/useSocket';

type Screen = 'home' | 'lobby' | 'game';

interface State {
  screen: Screen;
  playerId: string | null;
  playerName: string;
  room: PublicRoom | null;
  gameState: PublicGameState | null;
  reconnectToken: string | null;
  error: string | null;
  lastDrawnCard: { card: Card; playedCard: PlayedCard; isBust: boolean } | null;
  secondChancePrompt: { duplicateCard: Card } | null;
}

type Action =
  | { type: 'SET_PLAYER_NAME'; payload: string }
  | { type: 'ROOM_CREATED'; payload: { room: PublicRoom; playerId: string; reconnectToken: string } }
  | { type: 'ROOM_JOINED'; payload: { room: PublicRoom; playerId: string; reconnectToken: string } }
  | { type: 'PLAYER_JOINED'; payload: { player: RoomPlayer } }
  | { type: 'PLAYER_LEFT'; payload: { playerId: string } }
  | { type: 'HOST_CHANGED'; payload: { newHostId: string } }
  | { type: 'SETTINGS_UPDATED'; payload: { settings: GameSettings } }
  | { type: 'GAME_STARTED'; payload: { gameState: PublicGameState } }
  | { type: 'GAME_STATE_UPDATE'; payload: { gameState: PublicGameState } }
  | { type: 'CARD_DRAWN'; payload: { playerId: string; card: Card; playedCard: PlayedCard; isBust: boolean } }
  | { type: 'SECOND_CHANCE_PROMPT'; payload: { duplicateCard: Card } }
  | { type: 'CLEAR_SECOND_CHANCE' }
  | { type: 'RECONNECTED'; payload: { room: PublicRoom; gameState: PublicGameState | null; playerId: string } }
  | { type: 'LEFT_ROOM' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'CLEAR_DRAWN_CARD' };

const initialState: State = {
  screen: 'home',
  playerId: null,
  playerName: localStorage.getItem('flip7_player_name') || '',
  room: null,
  gameState: null,
  reconnectToken: localStorage.getItem('flip7_reconnect_token'),
  error: null,
  lastDrawnCard: null,
  secondChancePrompt: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PLAYER_NAME':
      localStorage.setItem('flip7_player_name', action.payload);
      return { ...state, playerName: action.payload };

    case 'ROOM_CREATED':
    case 'ROOM_JOINED':
      localStorage.setItem('flip7_reconnect_token', action.payload.reconnectToken);
      localStorage.setItem('flip7_room_code', action.payload.room.code);
      return {
        ...state,
        screen: 'lobby',
        room: action.payload.room,
        playerId: action.payload.playerId,
        reconnectToken: action.payload.reconnectToken,
        error: null,
      };

    case 'PLAYER_JOINED':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: [...state.room.players, action.payload.player],
        },
      };

    case 'PLAYER_LEFT':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: state.room.players.filter(p => p.id !== action.payload.playerId),
        },
      };

    case 'HOST_CHANGED':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          hostId: action.payload.newHostId,
          players: state.room.players.map(p => ({
            ...p,
            isHost: p.id === action.payload.newHostId,
          })),
        },
      };

    case 'SETTINGS_UPDATED':
      if (!state.room) return state;
      return {
        ...state,
        room: { ...state.room, settings: action.payload.settings },
      };

    case 'GAME_STARTED':
      return {
        ...state,
        screen: 'game',
        gameState: action.payload.gameState,
      };

    case 'GAME_STATE_UPDATE':
      return {
        ...state,
        gameState: action.payload.gameState,
      };

    case 'CARD_DRAWN':
      return {
        ...state,
        lastDrawnCard: {
          card: action.payload.card,
          playedCard: action.payload.playedCard,
          isBust: action.payload.isBust,
        },
      };

    case 'SECOND_CHANCE_PROMPT':
      return {
        ...state,
        secondChancePrompt: { duplicateCard: action.payload.duplicateCard },
      };

    case 'CLEAR_SECOND_CHANCE':
      return { ...state, secondChancePrompt: null };

    case 'CLEAR_DRAWN_CARD':
      return { ...state, lastDrawnCard: null };

    case 'RECONNECTED':
      localStorage.setItem('flip7_room_code', action.payload.room.code);
      return {
        ...state,
        screen: action.payload.gameState ? 'game' : 'lobby',
        room: action.payload.room,
        gameState: action.payload.gameState,
        playerId: action.payload.playerId,
        error: null,
      };

    case 'LEFT_ROOM':
      localStorage.removeItem('flip7_reconnect_token');
      localStorage.removeItem('flip7_room_code');
      return {
        ...state,
        screen: 'home',
        room: null,
        gameState: null,
        playerId: null,
        reconnectToken: null,
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

interface GameContextType {
  state: State;
  dispatch: React.Dispatch<Action>;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  hit: () => void;
  pass: () => void;
  useSecondChance: (use: boolean) => void;
  kickPlayer: (playerId: string) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  isConnected: boolean;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isConnected, emit, on } = useSocket();

  useEffect(() => {
    const unsubs = [
      on('room:created', (data) => dispatch({ type: 'ROOM_CREATED', payload: data })),
      on('room:joined', (data) => dispatch({ type: 'ROOM_JOINED', payload: data })),
      on('room:playerJoined', (data) => dispatch({ type: 'PLAYER_JOINED', payload: data })),
      on('room:playerLeft', (data) => dispatch({ type: 'PLAYER_LEFT', payload: data })),
      on('room:playerKicked', (data) => {
        if (data.playerId === state.playerId) {
          dispatch({ type: 'LEFT_ROOM' });
          dispatch({ type: 'SET_ERROR', payload: 'You were kicked from the room.' });
        } else {
          dispatch({ type: 'PLAYER_LEFT', payload: data });
        }
      }),
      on('room:hostChanged', (data) => dispatch({ type: 'HOST_CHANGED', payload: data })),
      on('room:settingsUpdated', (data) => dispatch({ type: 'SETTINGS_UPDATED', payload: data })),
      on('room:error', (data) => {
        // If reconnect failed, clear storage and go to home
        if (data.message.includes('reconnect') || data.message.includes('Session')) {
          localStorage.removeItem('flip7_reconnect_token');
          localStorage.removeItem('flip7_room_code');
        }
        dispatch({ type: 'SET_ERROR', payload: data.message });
      }),
      on('game:started', (data) => dispatch({ type: 'GAME_STARTED', payload: data })),
      on('game:stateUpdate', (data) => dispatch({ type: 'GAME_STATE_UPDATE', payload: data })),
      on('game:cardDrawn', (data) => dispatch({ type: 'CARD_DRAWN', payload: data })),
      on('game:secondChancePrompt', (data) => dispatch({ type: 'SECOND_CHANCE_PROMPT', payload: data })),
      on('game:secondChanceUsed', () => dispatch({ type: 'CLEAR_SECOND_CHANCE' })),
      on('connection:reconnected', (data) => dispatch({ type: 'RECONNECTED', payload: data })),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [on, state.playerId]);

  const createRoom = () => {
    if (!state.playerName.trim()) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter your name.' });
      return;
    }
    emit('room:create', { playerName: state.playerName });
  };

  const joinRoom = (code: string) => {
    if (!state.playerName.trim()) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter your name.' });
      return;
    }
    emit('room:join', { roomCode: code.toUpperCase(), playerName: state.playerName });
  };

  const leaveRoom = () => {
    emit('room:leave');
    dispatch({ type: 'LEFT_ROOM' });
  };

  const startGame = () => {
    emit('game:start');
  };

  const hit = () => {
    emit('game:action', { action: 'hit' });
  };

  const pass = () => {
    emit('game:action', { action: 'pass' });
  };

  const useSecondChance = (use: boolean) => {
    emit('game:useSecondChance', { use });
    dispatch({ type: 'CLEAR_SECOND_CHANCE' });
  };

  const kickPlayer = (playerId: string) => {
    emit('room:kick', { playerId });
  };

  const updateSettings = (settings: Partial<GameSettings>) => {
    emit('room:updateSettings', settings);
  };

  return (
    <GameContext.Provider
      value={{
        state,
        dispatch,
        createRoom,
        joinRoom,
        leaveRoom,
        startGame,
        hit,
        pass,
        useSecondChance,
        kickPlayer,
        updateSettings,
        isConnected,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
