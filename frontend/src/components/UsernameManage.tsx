import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useContract, UsernameInfo } from '../hooks/useContract';
import { getExplorerUrl } from '../config';
import './UsernameManage.css';

export const UsernameManage: React.FC = () => {
  const { isConnected, address } = useAuth();
  const {
    isLoading,
    getAddressUsername,
    getUsernameInfo,
    transferUsername,
    releaseUsername,
    approveTransfer,
  } = useContract();

  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [usernameInfo, setUsernameInfo] = useState<UsernameInfo | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeAction, setActiveAction] = useState<'transfer' | 'approve' | 'release' | null>(null);
  const [transferAddress, setTransferAddress] = useState('');
  const [releaseUsernameInput, setReleaseUsernameInput] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [releaseTxId, setReleaseTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's username on connect
  useEffect(() => {
    const fetchUsername = async () => {
      if (!address) {
        setCurrentUsername(null);
        setUsernameInfo(null);
        return;
      }

      setIsLoadingData(true);
      try {
        const username = await getAddressUsername(address);
        setCurrentUsername(username);

        if (username) {
          const info = await getUsernameInfo(username);
          setUsernameInfo(info);
        }
      } catch (err) {
        console.error('Failed to fetch username:', err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchUsername();
  }, [address, getAddressUsername, getUsernameInfo]);

  const handleTransfer = async () => {
    if (!currentUsername || !transferAddress.trim()) return;

    setError(null);
    try {
      await transferUsername(
        currentUsername,
        transferAddress.trim(),
        (id) => {
          setTxId(id);
          setActiveAction(null);
          setTransferAddress('');
        },
        () => {
          // Cancelled
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  const handleApprove = async () => {
    if (!currentUsername || !transferAddress.trim()) return;

    setError(null);
    try {
      await approveTransfer(
        currentUsername,
        transferAddress.trim(),
        (id) => {
          setTxId(id);
          setActiveAction(null);
          setTransferAddress('');
        },
        () => {
          // Cancelled
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const handleRelease = async () => {
    if (!currentUsername) return;

    setError(null);
    try {
      await releaseUsername(
        currentUsername,
        (id) => {
          setTxId(id);
          setActiveAction(null);
          setCurrentUsername(null);
          setUsernameInfo(null);
        },
        () => {
          // Cancelled
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release failed');
    }
  };

  const handleReleaseByUsername = async () => {
    if (!releaseUsernameInput.trim()) return;

    setError(null);
    setReleaseTxId(null);
    try {
      await releaseUsername(
        releaseUsernameInput.trim().toLowerCase(),
        (id) => {
          setReleaseTxId(id);
          setReleaseUsernameInput('');
          // Refresh current username if it was released
          if (currentUsername === releaseUsernameInput.trim().toLowerCase()) {
            setCurrentUsername(null);
            setUsernameInfo(null);
          }
        },
        () => {
          // Cancelled
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release failed');
    }
  };

  if (!isConnected) {
    return (
      <section id="manage" className="username-manage">
        <div className="manage-container">
          <div className="manage-header">
            <h2 className="manage-title">Manage Username</h2>
            <p className="manage-subtitle">
              Transfer, approve transfers, or release your username
            </p>
          </div>
          <div className="connect-required">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Connect your wallet to manage your username</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="manage" className="username-manage">
      <div className="manage-container">
        <div className="manage-header">
          <h2 className="manage-title">Manage Username</h2>
          <p className="manage-subtitle">
            Transfer, approve transfers, or release your username
          </p>
        </div>

        {isLoadingData ? (
          <div className="loading-state">
            <span className="loading-spinner large" />
            <span>Loading your username...</span>
          </div>
        ) : !currentUsername ? (
          <div className="no-username">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>You don't have a registered username</span>
            <a href="#register" className="register-link">Register one now →</a>
          </div>
        ) : (
          <>
            <div className="current-username-card">
              <div className="username-display">
                <span className="label">Your Username</span>
                <div className="username-value">
                  <span className="at">@</span>
                  <span className="name">{currentUsername}</span>
                </div>
              </div>
              {usernameInfo && (
                <div className="username-meta">
                  <span>Registered at block #{usernameInfo.registeredAt}</span>
                </div>
              )}
            </div>

            <div className="action-buttons">
              <button
                className={`action-btn ${activeAction === 'transfer' ? 'active' : ''}`}
                onClick={() => setActiveAction(activeAction === 'transfer' ? null : 'transfer')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Transfer
              </button>
              <button
                className={`action-btn ${activeAction === 'approve' ? 'active' : ''}`}
                onClick={() => setActiveAction(activeAction === 'approve' ? null : 'approve')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Approve Transfer
              </button>
              <button
                className={`action-btn danger ${activeAction === 'release' ? 'active' : ''}`}
                onClick={() => setActiveAction(activeAction === 'release' ? null : 'release')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Release
              </button>
            </div>

            {activeAction === 'transfer' && (
              <div className="action-form animate-fade-in">
                <h3>Transfer Username</h3>
                <p>Transfer your username directly to another address. This is immediate.</p>
                <input
                  type="text"
                  placeholder="Recipient Stacks address"
                  value={transferAddress}
                  onChange={(e) => setTransferAddress(e.target.value)}
                  className="address-input"
                />
                <div className="form-actions">
                  <button
                    className="btn btn-cancel"
                    onClick={() => {
                      setActiveAction(null);
                      setTransferAddress('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-confirm"
                    onClick={handleTransfer}
                    disabled={isLoading || !transferAddress.trim()}
                  >
                    {isLoading ? <span className="loading-spinner" /> : 'Transfer'}
                  </button>
                </div>
              </div>
            )}

            {activeAction === 'approve' && (
              <div className="action-form animate-fade-in">
                <h3>Approve Transfer</h3>
                <p>Allow another address to claim your username. They must call claim-transfer.</p>
                <input
                  type="text"
                  placeholder="Approved Stacks address"
                  value={transferAddress}
                  onChange={(e) => setTransferAddress(e.target.value)}
                  className="address-input"
                />
                <div className="form-actions">
                  <button
                    className="btn btn-cancel"
                    onClick={() => {
                      setActiveAction(null);
                      setTransferAddress('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-confirm"
                    onClick={handleApprove}
                    disabled={isLoading || !transferAddress.trim()}
                  >
                    {isLoading ? <span className="loading-spinner" /> : 'Approve'}
                  </button>
                </div>
              </div>
            )}

            {activeAction === 'release' && (
              <div className="action-form danger animate-fade-in">
                <h3>Release Username</h3>
                <p>
                  <strong>Warning:</strong> This will permanently release your username.
                  Anyone will be able to register it after this action.
                </p>
                <div className="release-confirm">
                  <span>Release <strong>@{currentUsername}</strong>?</span>
                </div>
                <div className="form-actions">
                  <button
                    className="btn btn-cancel"
                    onClick={() => setActiveAction(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleRelease}
                    disabled={isLoading}
                  >
                    {isLoading ? <span className="loading-spinner" /> : 'Release Username'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="error-message animate-fade-in">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </div>
            )}

            {txId && (
              <div className="tx-success animate-fade-in">
                <svg className="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12l3 3 5-6" />
                </svg>
                <div className="tx-info">
                  <span className="tx-label">Transaction submitted!</span>
                  <a
                    href={getExplorerUrl(txId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-link"
                  >
                    View on Explorer →
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {/* Release Username by Input Section */}
        <div className="release-by-username-section">
          <div className="release-by-username-header">
            <h3>Release Username</h3>
            <p>Enter a username to release it. You must be the owner of the username.</p>
          </div>
          <div className="release-by-username-form">
            <div className="input-wrapper">
              <span className="input-prefix">@</span>
              <input
                type="text"
                className="username-input"
                placeholder="username"
                value={releaseUsernameInput}
                onChange={(e) => setReleaseUsernameInput(e.target.value.toLowerCase())}
                maxLength={30}
              />
            </div>
            <button
              className="btn btn-release"
              onClick={handleReleaseByUsername}
              disabled={isLoading || !releaseUsernameInput.trim()}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner" />
                  Processing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Release Username
                </>
              )}
            </button>
          </div>
          
          {releaseTxId && (
            <div className="tx-success animate-fade-in">
              <svg className="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-6" />
              </svg>
              <div className="tx-info">
                <span className="tx-label">Transaction submitted!</span>
                <a
                  href={getExplorerUrl(releaseTxId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  View on Explorer →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

