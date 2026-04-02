import React from 'react';

interface NowPlayingBarProps {
  /** 0–1 fraction of progress */
  progress: number;
}

export const NowPlayingBar: React.FC<NowPlayingBarProps> = ({ progress }) => (
  <div className="w-full h-1 bg-surface-container-highest">
    <div
      className="h-full bg-primary transition-all duration-500"
      style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
    />
  </div>
);
