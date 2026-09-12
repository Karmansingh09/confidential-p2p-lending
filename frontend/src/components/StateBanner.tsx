import React from 'react';

export const StateBanner: React.FC = () => {
  return (
    <div className="state-banner">
      <div className="state-banner-content">
        <span className="state-banner-badge">LOCAL MOCK MODE</span>
        <span className="state-banner-text">
          Frontend Prototype (Commit #13) &bull; Disconnected from Midnight Network &bull; Displaying public terms only &bull; No wallet or private keys connected.
        </span>
      </div>
    </div>
  );
};
