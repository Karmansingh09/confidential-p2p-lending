import React from 'react';
import { DashboardPage } from './pages/DashboardPage.js';
import './App.css';

export const App: React.FC = () => {
  return (
    <div className="app-root">
      <DashboardPage />
    </div>
  );
};

export default App;
