import { useState, useCallback, useRef } from 'react';
import {
  openContractCall,
  ContractCallOptions,
} from '@stacks/connect';
import {
  callReadOnlyFunction,
  cvToValue,
  stringAsciiCV,
  principalCV,
  uintCV,
  ClarityValue,
} from '@stacks/transactions';
import { CONTRACT_ADDRESS, CONTRACT_NAME, getNetwork, getApiUrl } from '../config';

export interface UsernameInfo {
  owner: string;
  registeredAt: number;
  updatedAt: number;
}

export interface ContractStats {
  totalUsernames: number;
  totalFeesCollected: bigint;
  registrationFee: bigint;
}

export const useContract = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const network = getNetwork();
  
  // Rate limiting: track last request time using ref
  const lastRequestTimeRef = useRef(0);
  const MIN_REQUEST_INTERVAL = 1000; // 1000ms (1 second) between requests to avoid rate limiting
  
  // Helper to call read-only functions with rate limiting
  const callReadOnly = useCallback(async (
    functionName: string,
    functionArgs: ClarityValue[] = []
  ) => {
    try {
      // Rate limiting: wait if requests are too frequent
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTimeRef.current;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
      }
      lastRequestTimeRef.current = Date.now();

      const result = await callReadOnlyFunction({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        functionArgs,
        senderAddress: CONTRACT_ADDRESS,
      });
      return cvToValue(result);
    } catch (err: any) {
      // Suppress 429 (rate limit) errors silently - they're expected when making many requests
      const errorMessage = err?.message || err?.toString() || '';
      if (
        errorMessage.includes('429') || 
        errorMessage.includes('Too Many Requests') ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_FAILED')
      ) {
        // Silently return null/default values instead of throwing
        // These errors are logged by the browser console but we handle them gracefully
        return null;
      }
      // Only log unexpected errors (shouldn't happen now)
      // console.error(`Error calling ${functionName}:`, err);
      // Don't throw - return null instead to prevent UI errors
      return null;
    }
  }, [network]);

  // Check if username is available
  const isUsernameAvailable = useCallback(async (username: string): Promise<boolean> => {
    try {
      const result = await callReadOnly('is-username-available', [stringAsciiCV(username)]);
      return result as boolean;
    } catch {
      return false;
    }
  }, [callReadOnly]);

  // Get username info
  const getUsernameInfo = useCallback(async (username: string): Promise<UsernameInfo | null> => {
    try {
      const result = await callReadOnly('get-username-info', [stringAsciiCV(username)]);
      if (result && typeof result === 'object') {
        return {
          owner: result.owner,
          registeredAt: Number(result['registered-at']),
          updatedAt: Number(result['updated-at']),
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [callReadOnly]);

  // Get username by address
  const getAddressUsername = useCallback(async (address: string): Promise<string | null> => {
    try {
      const result = await callReadOnly('get-address-username', [principalCV(address)]);
      if (result && typeof result === 'object' && 'username' in result) {
        return result.username as string;
      }
      return null;
    } catch {
      return null;
    }
  }, [callReadOnly]);

  // Get registration fee
  const getRegistrationFee = useCallback(async (): Promise<bigint> => {
    try {
      const result = await callReadOnly('get-registration-fee');
      return BigInt(result as string);
    } catch {
      return BigInt(1_000_000); // Default 1 STX
    }
  }, [callReadOnly]);

  // Get contract stats - sequential calls to avoid rate limiting
  const getContractStats = useCallback(async (): Promise<ContractStats> => {
    try {
      // Call sequentially with delays to avoid rate limiting
      const totalUsernames = await callReadOnly('get-total-usernames');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const totalFeesCollected = await callReadOnly('get-total-fees-collected');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const registrationFee = await callReadOnly('get-registration-fee');

      return {
        totalUsernames: totalUsernames ? Number(totalUsernames) : 0,
        totalFeesCollected: totalFeesCollected ? BigInt(totalFeesCollected as string) : BigInt(0),
        registrationFee: registrationFee ? BigInt(registrationFee as string) : BigInt(1_000_000),
      };
    } catch {
      return {
        totalUsernames: 0,
        totalFeesCollected: BigInt(0),
        registrationFee: BigInt(1_000_000),
      };
    }
  }, [callReadOnly]);

  // Check if address has username
  const hasUsername = useCallback(async (address: string): Promise<boolean> => {
    try {
      const result = await callReadOnly('has-username', [principalCV(address)]);
      return result as boolean;
    } catch {
      return false;
    }
  }, [callReadOnly]);

  // Register username
  const registerUsername = useCallback(async (
    username: string,
    onFinish?: (txId: string) => void,
    onCancel?: () => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const options: ContractCallOptions = {
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'register-username',
        functionArgs: [stringAsciiCV(username)],
        postConditionMode: 0x01, // Allow
        onFinish: (data) => {
          setIsLoading(false);
          onFinish?.(data.txId);
        },
        onCancel: () => {
          setIsLoading(false);
          onCancel?.();
        },
      };

      await openContractCall(options);
    } catch (err) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to register username';
      setError(message);
      throw err;
    }
  }, [network]);

  // Transfer username
  const transferUsername = useCallback(async (
    username: string,
    newOwner: string,
    onFinish?: (txId: string) => void,
    onCancel?: () => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const options: ContractCallOptions = {
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'transfer-username',
        functionArgs: [stringAsciiCV(username), principalCV(newOwner)],
        postConditionMode: 0x01,
        onFinish: (data) => {
          setIsLoading(false);
          onFinish?.(data.txId);
        },
        onCancel: () => {
          setIsLoading(false);
          onCancel?.();
        },
      };

      await openContractCall(options);
    } catch (err) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to transfer username';
      setError(message);
      throw err;
    }
  }, [network]);

  // Release username
  const releaseUsername = useCallback(async (
    username: string,
    onFinish?: (txId: string) => void,
    onCancel?: () => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const options: ContractCallOptions = {
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'release-username',
        functionArgs: [stringAsciiCV(username)],
        postConditionMode: 0x01,
        onFinish: (data) => {
          setIsLoading(false);
          onFinish?.(data.txId);
        },
        onCancel: () => {
          setIsLoading(false);
          onCancel?.();
        },
      };

      await openContractCall(options);
    } catch (err) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to release username';
      setError(message);
      throw err;
    }
  }, [network]);

  // Approve transfer
  const approveTransfer = useCallback(async (
    username: string,
    approvedFor: string,
    onFinish?: (txId: string) => void,
    onCancel?: () => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const options: ContractCallOptions = {
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'approve-transfer',
        functionArgs: [stringAsciiCV(username), principalCV(approvedFor)],
        postConditionMode: 0x01,
        onFinish: (data) => {
          setIsLoading(false);
          onFinish?.(data.txId);
        },
        onCancel: () => {
          setIsLoading(false);
          onCancel?.();
        },
      };

      await openContractCall(options);
    } catch (err) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to approve transfer';
      setError(message);
      throw err;
    }
  }, [network]);

  // Claim transfer
  const claimTransfer = useCallback(async (
    username: string,
    onFinish?: (txId: string) => void,
    onCancel?: () => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const options: ContractCallOptions = {
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'claim-transfer',
        functionArgs: [stringAsciiCV(username)],
        postConditionMode: 0x01,
        onFinish: (data) => {
          setIsLoading(false);
          onFinish?.(data.txId);
        },
        onCancel: () => {
          setIsLoading(false);
          onCancel?.();
        },
      };

      await openContractCall(options);
    } catch (err) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to claim transfer';
      setError(message);
      throw err;
    }
  }, [network]);

  return {
    isLoading,
    error,
    isUsernameAvailable,
    getUsernameInfo,
    getAddressUsername,
    getRegistrationFee,
    getContractStats,
    hasUsername,
    registerUsername,
    transferUsername,
    releaseUsername,
    approveTransfer,
    claimTransfer,
  };
};

