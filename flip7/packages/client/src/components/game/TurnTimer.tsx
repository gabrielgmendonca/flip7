import React, { useEffect, useState } from 'react';
import './TurnTimer.css';

interface TurnTimerProps {
  startTime: number;
  timeoutSeconds: number;
}

export function TurnTimer({ startTime, timeoutSeconds }: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);

  useEffect(() => {
    const updateTimer = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, timeoutSeconds - elapsed);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [startTime, timeoutSeconds]);

  const percentage = (timeLeft / timeoutSeconds) * 100;
  const isLow = timeLeft <= 5;

  return (
    <div className="turn-timer">
      <div className="timer-bar-container">
        <div
          className={`timer-bar ${isLow ? 'timer-bar-low' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`timer-text ${isLow ? 'timer-text-low' : ''}`}>
        {Math.ceil(timeLeft)}s
      </span>
    </div>
  );
}
