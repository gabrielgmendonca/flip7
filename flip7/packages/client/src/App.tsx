import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Home } from './components/home/Home';
import { Lobby } from './components/lobby/Lobby';
import { GameBoard } from './components/game/GameBoard';

function AppContent() {
  const { state } = useGame();

  switch (state.screen) {
    case 'home':
      return <Home />;
    case 'lobby':
      return <Lobby />;
    case 'game':
      return <GameBoard />;
    default:
      return <Home />;
  }
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
