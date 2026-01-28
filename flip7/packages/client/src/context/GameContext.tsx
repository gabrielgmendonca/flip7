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

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ActivityLogEntry {
  id: string;
  message: string;
  timestamp: number;
}

export interface RoundEndData {
  round: number;
  scores: { playerId: string; playerName: string; roundScore: number; totalScore: number; previousScore: number }[];
}

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
  showReconnectedToast: boolean;
  turnTimer: { startTime: number; timeoutSeconds: number } | null;
  toasts: ToastItem[];
  activityLog: ActivityLogEntry[];
  pendingAction: boolean;
  roundEndData: RoundEndData | null;
  showRoundSummary: boolean;
  soundEnabled: boolean;
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
  | { type: 'CLEAR_DRAWN_CARD' }
  | { type: 'CLEAR_RECONNECTED_TOAST' }
  | { type: 'TURN_START'; payload: { timeoutSeconds: number } }
  | { type: 'CLEAR_TURN_TIMER' }
  | { type: 'ADD_TOAST'; payload: { message: string; type: 'success' | 'error' | 'info' } }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'ADD_ACTIVITY'; payload: string }
  | { type: 'SET_PENDING_ACTION'; payload: boolean }
  | { type: 'SET_ROUND_END_DATA'; payload: RoundEndData }
  | { type: 'SHOW_ROUND_SUMMARY'; payload: boolean }
  | { type: 'PLAYER_PASSED'; payload: { playerId: string; playerName: string; roundScore: number } }
  | { type: 'PLAYER_BUSTED'; payload: { playerId: string; playerName: string } }
  | { type: 'PLAYER_FROZEN'; payload: { playerId: string; playerName: string; frozenScore: number } }
  | { type: 'TOGGLE_SOUND' };

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
  showReconnectedToast: false,
  turnTimer: null,
  toasts: [],
  activityLog: [],
  pendingAction: false,
  roundEndData: null,
  showRoundSummary: false,
  soundEnabled: localStorage.getItem('flip7_sound_enabled') !== 'false',
};

let toastIdCounter = 0;
let activityIdCounter = 0;

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
        activityLog: [],
        roundEndData: null,
        showRoundSummary: false,
      };

    case 'GAME_STATE_UPDATE':
      return {
        ...state,
        gameState: action.payload.gameState,
        // Clear turn timer if the phase is not PLAYER_TURN
        turnTimer: action.payload.gameState.phase === 'PLAYER_TURN' ? state.turnTimer : null,
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
        showReconnectedToast: true,
      };

    case 'CLEAR_RECONNECTED_TOAST':
      return { ...state, showReconnectedToast: false };

    case 'TURN_START':
      return {
        ...state,
        turnTimer: {
          startTime: Date.now(),
          timeoutSeconds: action.payload.timeoutSeconds,
        },
      };

    case 'CLEAR_TURN_TIMER':
      return { ...state, turnTimer: null };

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

    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [
          ...state.toasts,
          { id: `toast-${++toastIdCounter}`, message: action.payload.message, type: action.payload.type },
        ].slice(-5), // Keep max 5 toasts
      };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };

    case 'ADD_ACTIVITY':
      return {
        ...state,
        activityLog: [
          { id: `activity-${++activityIdCounter}`, message: action.payload, timestamp: Date.now() },
          ...state.activityLog,
        ].slice(0, 20), // Keep max 20 entries
      };

    case 'SET_PENDING_ACTION':
      return { ...state, pendingAction: action.payload };

    case 'SET_ROUND_END_DATA':
      return { ...state, roundEndData: action.payload };

    case 'SHOW_ROUND_SUMMARY':
      return { ...state, showRoundSummary: action.payload };

    case 'PLAYER_PASSED':
      return {
        ...state,
        activityLog: [
          { id: `activity-${++activityIdCounter}`, message: `${action.payload.playerName} passed with ${action.payload.roundScore} points`, timestamp: Date.now() },
          ...state.activityLog,
        ].slice(0, 20),
      };

    case 'PLAYER_BUSTED':
      return {
        ...state,
        activityLog: [
          { id: `activity-${++activityIdCounter}`, message: `${action.payload.playerName} busted!`, timestamp: Date.now() },
          ...state.activityLog,
        ].slice(0, 20),
      };

    case 'PLAYER_FROZEN':
      return {
        ...state,
        activityLog: [
          { id: `activity-${++activityIdCounter}`, message: `${action.payload.playerName} froze with ${action.payload.frozenScore} points`, timestamp: Date.now() },
          ...state.activityLog,
        ].slice(0, 20),
      };

    case 'TOGGLE_SOUND':
      const newSoundEnabled = !state.soundEnabled;
      localStorage.setItem('flip7_sound_enabled', String(newSoundEnabled));
      return { ...state, soundEnabled: newSoundEnabled };

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
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  rematch: () => void;
  toggleSound: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isConnected, emit, on } = useSocket();

  useEffect(() => {
    const getPlayerName = (playerId: string) => {
      const player = state.gameState?.players.find((p) => p.id === playerId);
      return player?.name || 'Unknown';
    };

    const unsubs = [
      on('room:created', (data) => dispatch({ type: 'ROOM_CREATED', payload: data })),
      on('room:joined', (data) => dispatch({ type: 'ROOM_JOINED', payload: data })),
      on('room:playerJoined', (data) => dispatch({ type: 'PLAYER_JOINED', payload: data })),
      on('room:playerLeft', (data) => dispatch({ type: 'PLAYER_LEFT', payload: data })),
      on('room:playerKicked', (data) => {
        if (data.playerId === state.playerId) {
          dispatch({ type: 'LEFT_ROOM' });
          dispatch({ type: 'ADD_TOAST', payload: { message: 'You were kicked from the room.', type: 'error' } });
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
        dispatch({ type: 'ADD_TOAST', payload: { message: data.message, type: 'error' } });
      }),
      on('game:started', (data) => {
        dispatch({ type: 'GAME_STARTED', payload: data });
        dispatch({ type: 'ADD_ACTIVITY', payload: 'Game started!' });
      }),
      on('game:stateUpdate', (data) => {
        dispatch({ type: 'GAME_STATE_UPDATE', payload: data });
        dispatch({ type: 'SET_PENDING_ACTION', payload: false });
      }),
      on('game:cardDrawn', (data) => {
        dispatch({ type: 'CARD_DRAWN', payload: data });
        const playerName = getPlayerName(data.playerId);
        const cardDesc = data.card.type === 'number' ? data.card.value.toString() :
          data.card.type === 'action' ? data.card.action :
          data.card.modifier === 'x2' ? 'x2' : `+${data.card.modifier}`;
        dispatch({ type: 'ADD_ACTIVITY', payload: `${playerName} drew ${cardDesc}` });
      }),
      on('game:secondChancePrompt', (data) => dispatch({ type: 'SECOND_CHANCE_PROMPT', payload: data })),
      on('game:secondChanceUsed', () => dispatch({ type: 'CLEAR_SECOND_CHANCE' })),
      on('game:turnStart', (data) => dispatch({ type: 'TURN_START', payload: data })),
      on('game:playerPassed', (data) => {
        dispatch({ type: 'PLAYER_PASSED', payload: { ...data, playerName: getPlayerName(data.playerId) } });
      }),
      on('game:playerBusted', (data) => {
        dispatch({ type: 'PLAYER_BUSTED', payload: { playerId: data.playerId, playerName: getPlayerName(data.playerId) } });
      }),
      on('game:playerFrozen', (data) => {
        dispatch({ type: 'PLAYER_FROZEN', payload: { ...data, playerName: getPlayerName(data.playerId) } });
      }),
      on('game:roundEnd', (data) => {
        const scoresWithNames = data.scores.map((s) => ({
          ...s,
          playerName: getPlayerName(s.playerId),
          previousScore: s.totalScore - s.roundScore,
        }));
        dispatch({ type: 'SET_ROUND_END_DATA', payload: { round: data.round, scores: scoresWithNames } });
        dispatch({ type: 'SHOW_ROUND_SUMMARY', payload: true });
        dispatch({ type: 'ADD_ACTIVITY', payload: `Round ${data.round} ended` });
      }),
      on('connection:reconnected', (data) => {
        dispatch({ type: 'RECONNECTED', payload: data });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Connection restored', type: 'success' } });
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [on, state.playerId, state.gameState?.players]);

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
    dispatch({ type: 'SET_PENDING_ACTION', payload: true });
    emit('game:action', { action: 'hit' });
  };

  const pass = () => {
    dispatch({ type: 'SET_PENDING_ACTION', payload: true });
    emit('game:action', { action: 'pass' });
  };

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    dispatch({ type: 'ADD_TOAST', payload: { message, type } });
  };

  const removeToast = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
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

  const rematch = () => {
    emit('game:rematch');
  };

  const toggleSound = () => {
    dispatch({ type: 'TOGGLE_SOUND' });
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
        addToast,
        removeToast,
        rematch,
        toggleSound,
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
