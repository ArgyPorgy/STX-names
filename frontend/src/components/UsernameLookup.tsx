import React, { useState } from 'react';
import { useContract, UsernameInfo } from '../hooks/useContract';
import { USERNAME_MAX_LENGTH, USERNAME_PATTERN } from '../config';
import './UsernameLookup.css';

export const UsernameLookup: React.FC = () => {
  const [searchType, setSearchType] = useState<'username' | 'address'>('username');
  const [searchValue, setSearchValue] = useState('');
  const [result, setResult] = useState<{
    username?: string;
    info?: UsernameInfo;
    notFound?: boolean;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { getUsernameInfo, getAddressUsername } = useContract();

  const handleSearch = async () => {
    if (!searchValue.trim()) return;

    setIsSearching(true);
    setResult(null);

    try {
      if (searchType === 'username') {
        const info = await getUsernameInfo(searchValue.toLowerCase());
        if (info) {
          setResult({ username: searchValue.toLowerCase(), info });
        } else {
          setResult({ notFound: true });
        }
      } else {
        const username = await getAddressUsername(searchValue);
        if (username) {
          const info = await getUsernameInfo(username);
          setResult({ username, info: info || undefined });
        } else {
          setResult({ notFound: true });
        }
      }
    } catch (err) {
      console.error('Lookup failed:', err);
      setResult({ notFound: true });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section id="lookup" className="username-lookup">
      <div className="lookup-container">
        <div className="lookup-header">
          <h2 className="lookup-title">Lookup Username</h2>
          <p className="lookup-subtitle">
            Search for a username or find the username associated with an address
          </p>
        </div>

        <div className="lookup-tabs">
          <button
            className={`tab ${searchType === 'username' ? 'active' : ''}`}
            onClick={() => {
              setSearchType('username');
              setSearchValue('');
              setResult(null);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            By Username
          </button>
          <button
            className={`tab ${searchType === 'address' ? 'active' : ''}`}
            onClick={() => {
              setSearchType('address');
              setSearchValue('');
              setResult(null);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            By Address
          </button>
        </div>

        <div className="lookup-input-wrapper">
          <input
            type="text"
            className="lookup-input"
            placeholder={searchType === 'username' ? 'Enter username...' : 'Enter Stacks address...'}
            value={searchValue}
            onChange={(e) => setSearchValue(searchType === 'username' ? e.target.value.toLowerCase() : e.target.value)}
            onKeyPress={handleKeyPress}
            maxLength={searchType === 'username' ? USERNAME_MAX_LENGTH : 100}
          />
          <button
            className="btn btn-search"
            onClick={handleSearch}
            disabled={isSearching || !searchValue.trim()}
          >
            {isSearching ? (
              <span className="loading-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            )}
          </button>
        </div>

        {result && (
          <div className="lookup-result animate-fade-in">
            {result.notFound ? (
              <div className="result-not-found">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <span>
                  {searchType === 'username'
                    ? 'Username not registered'
                    : 'No username found for this address'}
                </span>
              </div>
            ) : (
              <div className="result-found">
                <div className="result-username-display">
                  <span className="at-symbol">@</span>
                  <span className="username-text">{result.username}</span>
                </div>
                {result.info && (
                  <div className="result-details">
                    <div className="detail-row">
                      <span className="detail-label">Owner</span>
                      <code className="detail-value">{result.info.owner}</code>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Registered at block</span>
                      <span className="detail-value">#{result.info.registeredAt}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Last updated</span>
                      <span className="detail-value">Block #{result.info.updatedAt}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

