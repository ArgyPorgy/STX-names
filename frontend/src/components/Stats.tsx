import React, { useState, useEffect } from 'react';
import { useContract, ContractStats } from '../hooks/useContract';
import { microStxToStx, CONTRACT_ADDRESS, CONTRACT_NAME, NETWORK_TYPE } from '../config';
import './Stats.css';

export const Stats: React.FC = () => {
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const { getContractStats } = useContract();

  // Check if contract address is configured
  if (!CONTRACT_ADDRESS) {
    return (
      <section className="stats">
        <div className="stats-container">
          <div className="api-error-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div className="error-content">
              <strong>Contract Not Deployed</strong>
              <p>
                Deploy the contract to {NETWORK_TYPE} first, then set <code>VITE_CONTRACT_ADDRESS</code> in <code>frontend/.env</code>
              </p>
              <p className="error-hint">
                Run: <code>npm run deploy:testnet</code> to deploy
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setApiError(null);
        const data = await getContractStats();
        setStats(data);
      } catch (err: any) {
        const errorMessage = err?.message || String(err);
        if (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('Failed to fetch')) {
          setApiError('connection');
        } else {
          setApiError('unknown');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [getContractStats]);

  return (
    <section className="stats">
      <div className="stats-container">
        <div className="stats-header">
          <h2 className="stats-title">Registry Stats</h2>
          <div className="network-badge">
            <span className="network-dot" />
            {NETWORK_TYPE}
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-label">Registered Usernames</span>
              <span className="stat-value">
                {isLoading ? (
                  <span className="loading-placeholder" />
                ) : (
                  stats?.totalUsernames.toLocaleString() || '0'
                )}
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-label">Registration Fee</span>
              <span className="stat-value">
                {isLoading ? (
                  <span className="loading-placeholder" />
                ) : (
                  `${microStxToStx(stats?.registrationFee || BigInt(0))} STX`
                )}
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Fees Collected</span>
              <span className="stat-value">
                {isLoading ? (
                  <span className="loading-placeholder" />
                ) : (
                  `${microStxToStx(stats?.totalFeesCollected || BigInt(0))} STX`
                )}
              </span>
            </div>
          </div>
        </div>

        {apiError === 'connection' && NETWORK_TYPE === 'devnet' && (
          <div className="api-error-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div className="error-content">
              <strong>Local Devnet Not Running</strong>
              <p>
                Start a local Stacks devnet to view stats. Run in a terminal:
              </p>
              <code>clarinet devnet</code>
              <p className="error-hint">
                Or switch to <strong>testnet</strong> in your environment variables.
              </p>
            </div>
          </div>
        )}

        <div className="contract-info">
          <span className="contract-label">Contract Address</span>
          <code className="contract-address">
            {CONTRACT_ADDRESS}.{CONTRACT_NAME}
          </code>
        </div>
      </div>
    </section>
  );
};

