import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Home } from './components/home/Home';
import { Lobby } from './components/lobby/Lobby';
import { GameBoard } from './components/game/GameBoard';
import { Toast } from './components/common/Toast';

function AppContent() {
  const { state, dispatch } = useGame();

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
      {state.showReconnectedToast && (
        <Toast
          message="Connection restored"
          type="success"
          onClose={() => dispatch({ type: 'CLEAR_RECONNECTED_TOAST' })}
        />
      )}
    </>
  );
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
