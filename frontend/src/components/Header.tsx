import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WalletSelector } from './WalletSelector';
import './Header.css';

export const Header: React.FC = () => {
  const { isConnected, address, disconnect, isLoading } = useAuth();
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 100 100" className="logo-svg">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5546ff" />
                  <stop offset="100%" stopColor="#fc6432" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="48" fill="url(#logoGrad)" />
              <text x="50" y="65" fontFamily="Arial Black" fontSize="36" fontWeight="bold" fill="white" textAnchor="middle">STX</text>
            </svg>
          </div>
          <span className="logo-text">STX Names</span>
        </div>

        <nav className="nav">
          <a href="#register" className="nav-link">Register</a>
          <a href="#lookup" className="nav-link">Lookup</a>
          <a href="#manage" className="nav-link">Manage</a>
        </nav>

        <div className="wallet-section">
          {isLoading ? (
            <div className="wallet-loading">
              <span className="loading-spinner" />
            </div>
          ) : isConnected ? (
            <div className="wallet-connected">
              <div className="wallet-address">
                <span className="address-dot" />
                {truncateAddress(address || '')}
              </div>
              <button className="btn btn-disconnect" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <button className="btn btn-connect" onClick={() => setShowWalletSelector(true)}>
              <svg className="wallet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
                <circle cx="16" cy="14" r="2" />
              </svg>
              Connect Wallet
            </button>
          )}
        </div>
      </div>
      {showWalletSelector && (
        <WalletSelector onClose={() => setShowWalletSelector(false)} />
      )}
    </header>
  );
};

