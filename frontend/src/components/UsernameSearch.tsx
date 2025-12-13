import React, { useState, useEffect, useCallback } from 'react';
import { useContract, UsernameInfo } from '../hooks/useContract';
import { useAuth } from '../hooks/useAuth';
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
  microStxToStx,
  getExplorerUrl,
} from '../config';
import './UsernameSearch.css';

type SearchStatus = 'idle' | 'searching' | 'available' | 'taken' | 'invalid' | 'error';

export const UsernameSearch: React.FC = () => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [usernameInfo, setUsernameInfo] = useState<UsernameInfo | null>(null);
  const [registrationFee, setRegistrationFee] = useState<bigint>(BigInt(1_000_000));
  const [txId, setTxId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { isConnected, address } = useAuth();
  const {
    isLoading,
    isUsernameAvailable,
    getUsernameInfo,
    getRegistrationFee,
    getAddressUsername,
    registerUsername,
  } = useContract();

  const [userCurrentUsername, setUserCurrentUsername] = useState<string | null>(null);

  // Fetch registration fee on mount
  useEffect(() => {
    getRegistrationFee().then(setRegistrationFee);
  }, [getRegistrationFee]);

  // Check if user already has a username
  useEffect(() => {
    if (address) {
      getAddressUsername(address).then(setUserCurrentUsername);
    } else {
      setUserCurrentUsername(null);
    }
  }, [address, getAddressUsername]);

  // Validate username
  const validateUsername = useCallback((name: string): string | null => {
    if (name.length === 0) return null;
    if (name.length < USERNAME_MIN_LENGTH) {
      return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
    }
    if (name.length > USERNAME_MAX_LENGTH) {
      return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
    }
    if (!USERNAME_PATTERN.test(name)) {
      return 'Only lowercase letters, numbers, underscores, and hyphens allowed';
    }
    return null;
  }, []);

  // Debounced search
  useEffect(() => {
    const error = validateUsername(username);
    setValidationError(error);

    if (!username || error) {
      setStatus('idle');
      setUsernameInfo(null);
      return;
    }

    setStatus('searching');
    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(username);
        if (available) {
          setStatus('available');
          setUsernameInfo(null);
        } else {
          setStatus('taken');
          const info = await getUsernameInfo(username);
          setUsernameInfo(info);
        }
      } catch {
        setStatus('error');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username, isUsernameAvailable, getUsernameInfo, validateUsername]);

  const handleRegister = async () => {
    if (!username || status !== 'available') return;

    try {
      await registerUsername(
        username,
        (id) => {
          setTxId(id);
          setStatus('idle');
          setUsername('');
        },
        () => {
          // User cancelled
        }
      );
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'searching':
        return <span className="status-icon searching" />;
      case 'available':
        return (
          <svg className="status-icon available" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'taken':
        return (
          <svg className="status-icon taken" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <section id="register" className="username-search">
      <div className="search-container">
        <div className="search-header">
          <h1 className="search-title">
            Claim Your <span className="gradient-text">Stacks Username</span>
          </h1>
          <p className="search-subtitle">
            Register a unique, on-chain username tied to your Stacks address.
            Own your identity on Bitcoin L2.
          </p>
        </div>

        {userCurrentUsername && (
          <div className="current-username-banner">
            <span className="banner-icon">✓</span>
            <span>
              You already own <strong>@{userCurrentUsername}</strong>
            </span>
          </div>
        )}

        <div className={`search-input-wrapper ${status} ${validationError ? 'invalid' : ''}`}>
          <span className="input-prefix">@</span>
          <input
            type="text"
            className="search-input"
            placeholder="yourname"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={USERNAME_MAX_LENGTH}
            disabled={isLoading}
          />
          <div className="input-status">
            {getStatusIcon()}
          </div>
        </div>

        {validationError && (
          <div className="validation-error">{validationError}</div>
        )}

        <div className="search-results">
          {status === 'available' && (
            <div className="result-card available animate-fade-in">
              <div className="result-header">
                <div className="result-status">
                  <span className="status-badge available">Available</span>
                  <span className="result-username">@{username}</span>
                </div>
                <div className="result-fee">
                  <span className="fee-label">Registration Fee</span>
                  <span className="fee-amount">{microStxToStx(registrationFee)} STX</span>
                </div>
              </div>

              {!isConnected ? (
                <div className="connect-prompt">
                  <p>Connect your wallet to register this username</p>
                </div>
              ) : userCurrentUsername ? (
                <div className="already-owned-prompt">
                  <p>You already own a username. Release it first to register a new one.</p>
                </div>
              ) : (
                <button
                  className="btn btn-register"
                  onClick={handleRegister}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="loading-spinner" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Register @{username}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {status === 'taken' && usernameInfo && (
            <div className="result-card taken animate-fade-in">
              <div className="result-header">
                <div className="result-status">
                  <span className="status-badge taken">Taken</span>
                  <span className="result-username">@{username}</span>
                </div>
              </div>
              <div className="owner-info">
                <span className="owner-label">Owned by</span>
                <code className="owner-address">{usernameInfo.owner}</code>
              </div>
              <div className="registration-info">
                <span>Registered at block #{usernameInfo.registeredAt}</span>
              </div>
            </div>
          )}
        </div>

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

        <div className="search-features">
          <div className="feature">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10h8M10 8v4M16 10v4M4 16v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                <circle cx="6" cy="12" r="1" />
                <circle cx="18" cy="12" r="1" />
              </svg>
            </div>
            <div className="feature-text">
              <strong>On-Chain</strong>
              <span>Stored permanently on Bitcoin L2</span>
            </div>
          </div>
          <div className="feature">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="feature-text">
              <strong>Self-Custody</strong>
              <span>You control your username</span>
            </div>
          </div>
          <div className="feature">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12c0 1.66-1 3-2.5 3S16 13.66 16 12s1-3 2.5-3 2.5 1.34 2.5 3z" />
                <path d="M8 12c0 1.66-1 3-2.5 3S3 13.66 3 12s1-3 2.5-3S8 10.34 8 12z" />
                <path d="M12 8l4 4-4 4M16 12H8" />
              </svg>
            </div>
            <div className="feature-text">
              <strong>Transferable</strong>
              <span>Send to any Stacks address</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

