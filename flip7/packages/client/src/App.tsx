import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Home } from './components/home/Home';
import { Lobby } from './components/lobby/Lobby';
import { GameBoard } from './components/game/GameBoard';
import { ToastContainer } from './components/common/ToastContainer';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function AppContent() {
  const { state, removeToast } = useGame();

  const renderScreen = () => {
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
  };

  return (
    <>
      {renderScreen()}
      <ToastContainer toasts={state.toasts} onRemove={removeToast} />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
