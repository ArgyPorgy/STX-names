import { useState, useEffect, useCallback } from 'react';
import { AppConfig, UserSession, showConnect, disconnect } from '@stacks/connect';
import { APP_METADATA, NETWORK_TYPE, getNetwork } from '../config';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// Helper to get the correct address based on network
const getAddressForNetwork = (userData: any): string | null => {
  if (!userData?.profile?.stxAddress) return null;
  
  if (NETWORK_TYPE === 'testnet') {
    return userData.profile.stxAddress.testnet || null;
  } else if (NETWORK_TYPE === 'mainnet') {
    return userData.profile.stxAddress.mainnet || null;
  }
  // For devnet, try testnet first, then mainnet
  return userData.profile.stxAddress.testnet || userData.profile.stxAddress.mainnet || null;
};

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
      const address = getAddressForNetwork(userData);
      setAuthState({
        isConnected: true,
        isLoading: false,
        address,
        userData,
      });
    } else if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((userData) => {
        const address = getAddressForNetwork(userData);
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
      network: getNetwork(), // Specify the network (testnet/mainnet/devnet)
      onFinish: () => {
        const userData = userSession.loadUserData();
        const address = getAddressForNetwork(userData);
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

