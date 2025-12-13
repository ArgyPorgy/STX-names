import { useState, useCallback } from 'react';
import {
  openContractCall,
  ContractCallOptions,
} from '@stacks/connect';
import {
  cvToValue,
  stringAsciiCV,
  principalCV,
  uintCV,
  ClarityValue,
  deserializeCV,
  serializeCV,
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
  const apiUrl = getApiUrl();

  // Helper to call read-only functions using Stacks API
  const callReadOnly = useCallback(async (
    functionName: string,
    functionArgs: ClarityValue[] = []
  ) => {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured. Please set VITE_CONTRACT_ADDRESS in frontend/.env');
    }
    
    try {
      // Convert Clarity values to hex strings for API
      const args = functionArgs.map(arg => {
        const serialized = serializeCV(arg);
        const hex = Array.from(serialized)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        return '0x' + hex;
      });

      // Call Stacks API read-only endpoint (this endpoint supports CORS)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${apiUrl}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: CONTRACT_ADDRESS,
          arguments: args,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || errorData.reason || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse the result - API returns result in hex format
      if (data.okay !== false && data.result) {
        // Result is a hex string (with or without 0x prefix)
        const hexString = data.result.startsWith('0x') ? data.result.slice(2) : data.result;
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
        }
        const cv = deserializeCV(bytes);
        return cvToValue(cv);
      } else {
        // Check for error in response
        const errorMsg = data.error || data.reason || 'Contract call failed';
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      // Suppress repeated network errors to reduce console noise
      const errorMessage = err?.message || String(err);
      
      if (err.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      if (errorMessage.includes('ERR_NETWORK_CHANGED') || 
          errorMessage.includes('ERR_TIMED_OUT') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('Network error')) {
        // Suppress repeated network errors - they're usually transient
        throw new Error('Network error');
      }
      
      // Only log other errors in development
      if (import.meta.env.DEV) {
        if (errorMessage.includes('NoSuchContract')) {
          console.warn(
            `⚠️ Contract not found: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}. ` +
            `The deployment transaction may still be pending.`
          );
        } else if (!errorMessage.includes('Network error')) {
          console.error(`Error calling ${functionName}:`, err);
        }
      }
      
      throw err;
    }
  }, [apiUrl]);

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

  // Get contract stats
  const getContractStats = useCallback(async (): Promise<ContractStats> => {
    try {
      const [totalUsernames, totalFeesCollected, registrationFee] = await Promise.all([
        callReadOnly('get-total-usernames'),
        callReadOnly('get-total-fees-collected'),
        callReadOnly('get-registration-fee'),
      ]);

      return {
        totalUsernames: Number(totalUsernames),
        totalFeesCollected: BigInt(totalFeesCollected as string),
        registrationFee: BigInt(registrationFee as string),
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
    if (!CONTRACT_ADDRESS) {
      setError('Contract address not configured. Please set VITE_CONTRACT_ADDRESS in frontend/.env');
      return;
    }
    
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

