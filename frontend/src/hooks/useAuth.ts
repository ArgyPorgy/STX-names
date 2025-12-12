import { useState, useEffect, useCallback } from 'react';
import { AppConfig, UserSession, showConnect, disconnect } from '@stacks/connect';
import { APP_METADATA } from '../config';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

export interface AuthState {
  isConnected: boolean;
  isLoading: boolean;
  address: string | null;
  userData: any | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isConnected: false,
    isLoading: true,
    address: null,
    userData: null,
  });

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      const address = userData.profile?.stxAddress?.testnet || userData.profile?.stxAddress?.mainnet;
      setAuthState({
        isConnected: true,
        isLoading: false,
        address,
        userData,
      });
    } else if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((userData) => {
        const address = userData.profile?.stxAddress?.testnet || userData.profile?.stxAddress?.mainnet;
        setAuthState({
          isConnected: true,
          isLoading: false,
          address,
          userData,
        });
      });
    } else {
      setAuthState({
        isConnected: false,
        isLoading: false,
        address: null,
        userData: null,
      });
    }
  }, []);

  const connect = useCallback(() => {
    showConnect({
      appDetails: {
        name: APP_METADATA.name,
        icon: window.location.origin + APP_METADATA.icon,
      },
      onFinish: () => {
        const userData = userSession.loadUserData();
        const address = userData.profile?.stxAddress?.testnet || userData.profile?.stxAddress?.mainnet;
        setAuthState({
          isConnected: true,
          isLoading: false,
          address,
          userData,
        });
      },
      onCancel: () => {
        console.log('User cancelled connection');
      },
      userSession,
    });
  }, []);

  const disconnectWallet = useCallback(() => {
    disconnect();
    userSession.signUserOut();
    setAuthState({
      isConnected: false,
      isLoading: false,
      address: null,
      userData: null,
    });
  }, []);

  return {
    ...authState,
    connect,
    disconnect: disconnectWallet,
    userSession,
  };
};

