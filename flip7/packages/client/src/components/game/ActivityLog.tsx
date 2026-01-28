import React from 'react';
import { ActivityLogEntry } from '../../context/GameContext';
import './ActivityLog.css';

interface ActivityLogProps {
  entries: ActivityLogEntry[];
}

export function ActivityLog({ entries }: ActivityLogProps) {
  if (entries.length === 0) return null;

  return (
    <div className="activity-log">
      <h4>Activity</h4>
      <div className="activity-list">
        {entries.slice(0, 10).map((entry, index) => (
          <div key={entry.id} className={`activity-entry ${index === 0 ? 'latest' : ''}`}>
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
