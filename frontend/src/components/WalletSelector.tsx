import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { connectWalletKit } from '../utils/walletkit';
import './WalletSelector.css';

type WalletType = 'stacks-connect' | 'walletkit';

interface WalletSelectorProps {
  onClose: () => void;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ onClose }) => {
  const { connect: connectStacksConnect } = useAuth();
  const [connecting, setConnecting] = useState<WalletType | null>(null);

  const handleConnect = async (walletType: WalletType) => {
    setConnecting(walletType);
    try {
      if (walletType === 'stacks-connect') {
        connectStacksConnect();
        onClose();
      } else if (walletType === 'walletkit') {
        // WalletKit connection
        // Note: Full implementation pending WalletKit Stacks adapter
        try {
          await connectWalletKit();
          onClose();
        } catch (error: any) {
          console.error('WalletKit connection error:', error);
          alert(error.message || 'WalletKit integration coming soon! Please use Hiro Wallet for now.');
          setConnecting(null);
        }
      }
    } catch (error) {
      console.error('Connection error:', error);
      setConnecting(null);
    }
  };

  return (
    <div className="wallet-selector-overlay" onClick={onClose}>
      <div className="wallet-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wallet-selector-header">
          <h2>Connect Wallet</h2>
          <button className="wallet-selector-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="wallet-selector-content">
          <button
            className={`wallet-option ${connecting === 'stacks-connect' ? 'connecting' : ''}`}
            onClick={() => handleConnect('stacks-connect')}
            disabled={connecting !== null}
          >
            <div className="wallet-option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="wallet-option-info">
              <div className="wallet-option-name">Hiro Wallet</div>
              <div className="wallet-option-description">Connect using Stacks Connect</div>
            </div>
            {connecting === 'stacks-connect' && (
              <div className="wallet-option-spinner" />
            )}
          </button>

          <button
            className={`wallet-option ${connecting === 'walletkit' ? 'connecting' : ''}`}
            onClick={() => handleConnect('walletkit')}
            disabled={connecting !== null}
          >
            <div className="wallet-option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
                <circle cx="16" cy="14" r="2" />
              </svg>
            </div>
            <div className="wallet-option-info">
              <div className="wallet-option-name">WalletKit</div>
              <div className="wallet-option-description">Connect using WalletKit (Reown)</div>
            </div>
            {connecting === 'walletkit' && (
              <div className="wallet-option-spinner" />
            )}
          </button>
        </div>
        <div className="wallet-selector-footer">
          <p>By connecting, you agree to the Terms of Service</p>
        </div>
      </div>
    </div>
  );
};

