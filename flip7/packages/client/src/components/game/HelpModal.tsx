import React from 'react';
import './Modal.css';
import './HelpModal.css';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <h2>How to Play</h2>

        <div className="help-section">
          <h3>Basic Rules</h3>
          <ul>
            <li><strong>HIT</strong> to draw a card from the deck</li>
            <li><strong>PASS</strong> to bank your round score and end your turn</li>
            <li>Drawing a <strong>duplicate number</strong> = BUST (lose all round points)</li>
            <li>Collect <strong>7 unique numbers</strong> (0-12) for a +15 bonus</li>
            <li>First player to reach the <strong>target score</strong> wins!</li>
          </ul>
        </div>

        <div className="help-section">
          <h3>Special Cards</h3>
          <ul>
            <li><strong>Freeze</strong> - Locks in your current round score, then you must pass</li>
            <li><strong>Second Chance</strong> - If you bust, you can discard the duplicate and keep playing</li>
            <li><strong>Flip Three</strong> - Draw 3 more cards automatically</li>
          </ul>
        </div>

        <div className="help-section">
          <h3>Modifier Cards</h3>
          <ul>
            <li><strong>+2 to +10</strong> - Adds that value to your round score</li>
            <li><strong>x2</strong> - Doubles the sum of your number cards</li>
          </ul>
        </div>

        <div className="help-section">
          <h3>Keyboard Shortcuts</h3>
          <ul>
            <li><strong>H</strong> - Hit (draw a card)</li>
            <li><strong>P</strong> - Pass (bank your score)</li>
          </ul>
        </div>

        <button className="primary" onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  );
}
