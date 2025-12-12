import React from 'react';
import './Footer.css';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo">
            <svg viewBox="0 0 100 100" className="footer-logo-svg">
              <defs>
                <linearGradient id="footerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5546ff" />
                  <stop offset="100%" stopColor="#fc6432" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="48" fill="url(#footerGrad)" />
              <text x="50" y="65" fontFamily="Arial Black" fontSize="36" fontWeight="bold" fill="white" textAnchor="middle">STX</text>
            </svg>
            <span>STX Names</span>
          </div>
          <p className="footer-tagline">
            On-chain username registry for the Stacks ecosystem
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-section">
            <h4>Resources</h4>
            <a href="https://docs.stacks.co" target="_blank" rel="noopener noreferrer">
              Stacks Docs
            </a>
            <a href="https://explorer.stacks.co" target="_blank" rel="noopener noreferrer">
              Explorer
            </a>
            <a href="https://www.hiro.so/wallet" target="_blank" rel="noopener noreferrer">
              Hiro Wallet
            </a>
          </div>

          <div className="footer-section">
            <h4>Contract</h4>
            <a href="#register">Register</a>
            <a href="#lookup">Lookup</a>
            <a href="#manage">Manage</a>
          </div>

          <div className="footer-section">
            <h4>Community</h4>
            <a href="https://github.com/stacks-network" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://discord.gg/stacks" target="_blank" rel="noopener noreferrer">
              Discord
            </a>
            <a href="https://twitter.com/staboratory" target="_blank" rel="noopener noreferrer">
              Twitter
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>Built on Stacks — Bitcoin L2</p>
          <p className="footer-year">© {new Date().getFullYear()} STX Names</p>
        </div>
      </div>
    </footer>
  );
};

