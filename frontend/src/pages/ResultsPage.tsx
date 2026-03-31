import React from 'react';
import { NavBar } from '../components/NavBar';

export const ResultsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black-deep text-white">
      <NavBar />
      <div className="mx-auto max-w-content p-4">
        <h1 className="font-mono text-[24px]">ResultsPage</h1>
      </div>
    </div>
  );
};
