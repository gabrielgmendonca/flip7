import React, { useEffect, useState } from 'react';
import './ScoreAnimation.css';

interface ScoreAnimationProps {
  score: number;
  previousScore: number;
}

export function ScoreAnimation({ score, previousScore }: ScoreAnimationProps) {
  const [animations, setAnimations] = useState<{ id: number; value: number }[]>([]);
  const [lastScore, setLastScore] = useState(previousScore);

  useEffect(() => {
    if (score !== lastScore && score > lastScore) {
      const change = score - lastScore;
      const newAnim = { id: Date.now(), value: change };
      setAnimations((prev) => [...prev, newAnim]);
      setLastScore(score);

      // Remove animation after it completes
      setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== newAnim.id));
      }, 1500);
    } else if (score !== lastScore) {
      setLastScore(score);
    }
  }, [score, lastScore]);

  return (
    <div className="score-animation-container">
      {animations.map((anim) => (
        <span key={anim.id} className="score-float">
          +{anim.value}
        </span>
      ))}
    </div>
  );
}
