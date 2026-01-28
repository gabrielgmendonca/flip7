import React from 'react';
import { Player } from '@flip7/shared';
import './TurnOrder.css';

interface TurnOrderProps {
  players: Player[];
  currentPlayerIndex: number;
  currentPlayerId: string | null;
}

export function TurnOrder({ players, currentPlayerIndex, currentPlayerId }: TurnOrderProps) {
  return (
    <div className="turn-order">
      <span className="turn-order-label">Turn Order:</span>
      {players.map((player, index) => {
        const isCurrent = index === currentPlayerIndex;
        const isMe = player.id === currentPlayerId;
        const isInactive = player.status !== 'active';

        return (
          <React.Fragment key={player.id}>
            {index > 0 && <span className="turn-order-arrow">&rarr;</span>}
            <span
              className={`turn-order-player ${isCurrent ? 'current' : ''} ${isMe ? 'is-me' : ''} ${isInactive ? 'inactive' : ''}`}
            >
              {player.name}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
