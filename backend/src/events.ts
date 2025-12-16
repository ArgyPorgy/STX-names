import { db } from './db.js';

interface ChainhookEvent {
  apply: Array<{
    block_identifier: {
      index: number;
      hash: string;
    };
    parent_block_identifier: {
      index: number;
      hash: string;
    };
    timestamp: number;
    transactions: Array<{
      transaction_identifier: {
        hash: string;
      };
      metadata?: {
        sender?: string;
      };
      operations: Array<{
        operation_identifier: { index: number };
        type: string;
        status: string;
        contract_call?: {
          contract_identifier: string;
          function_name: string;
          function_args: Array<{
            name?: string;
            type: string;
            repr?: string;
            hex?: string;
          }>;
        };
      }>;
    }>;
  }>;
  rollback?: Array<any>;
}

// Helper to parse Clarity value from repr string
function parseClarityValue(repr: string, type: string): string | null {
  if (!repr) return null;
  
  // Remove quotes from string-ascii values
  if (type.includes('string') || type.includes('ascii')) {
    return repr.replace(/^"|"$/g, '');
  }
  
  // Extract principal address
  if (type.includes('principal')) {
    // Format: SP123... or 'ST123...'
    return repr.replace(/^'|'$/g, '').split('.')[0];
  }
  
  return repr;
}

export async function handleRegisterUsernameEvent(event: ChainhookEvent): Promise<void> {
  try {
    for (const apply of event.apply || []) {
      const blockHeight = apply.block_identifier.index;
      const timestamp = Math.floor(apply.timestamp / 1000); // Convert to seconds

      for (const tx of apply.transactions || []) {
        const txId = tx.transaction_identifier.hash;

        // Find the register-username contract call
        for (const op of tx.operations || []) {
          if (
            op.contract_call?.function_name === 'register-username' &&
            op.status === 'success'
          ) {
            // Extract username from function arguments
            // register-username takes one argument: (username (string-ascii 30))
            const args = op.contract_call.function_args || [];
            const usernameArg = args[0];

            if (usernameArg && usernameArg.repr) {
              const username = parseClarityValue(usernameArg.repr, usernameArg.type);
              
              // Get sender from transaction metadata
              // The owner is tx-sender (the address that called the contract function)
              const sender = tx.metadata?.sender || (tx as any).sender;
              
              if (username && sender) {
                // Parse sender address (remove contract identifier if present)
                const ownerAddress = typeof sender === 'string' 
                  ? sender.split('.')[0] 
                  : String(sender);

                await db.insertUsername({
                  username: String(username),
                  owner: ownerAddress,
                  registeredAt: timestamp,
                  txId,
                  blockHeight,
                });

                console.log(`Registered username: ${username} -> ${ownerAddress} (tx: ${txId})`);
              } else {
                // Log for debugging if we can't extract required data
                console.warn(`Incomplete register-username data: username=${username}, sender=${sender}`);
                console.log('Transaction data:', JSON.stringify(tx, null, 2));
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error handling register-username event:', error);
    console.error('Event data:', JSON.stringify(event, null, 2));
    throw error;
  }
}

export async function handleTransferUsernameEvent(event: ChainhookEvent): Promise<void> {
  try {
    for (const apply of event.apply || []) {
      const blockHeight = apply.block_identifier.index;
      const timestamp = Math.floor(apply.timestamp / 1000);

      for (const tx of apply.transactions || []) {
        const txId = tx.transaction_identifier.hash;

        for (const op of tx.operations || []) {
          if (
            op.contract_call?.function_name === 'transfer-username' &&
            op.status === 'success'
          ) {
            // transfer-username takes two arguments: (username (string-ascii 30)) (new-owner principal)
            const args = op.contract_call.function_args || [];
            const usernameArg = args[0];
            const newOwnerArg = args[1];

            if (usernameArg && newOwnerArg) {
              const username = parseClarityValue(usernameArg.repr || '', usernameArg.type);
              const newOwner = parseClarityValue(newOwnerArg.repr || '', newOwnerArg.type);

              // Get current owner from database to find from_owner
              if (username && newOwner) {
                const existingUsername = await db.getUsername(username);
                const fromOwner = existingUsername?.owner;

                if (fromOwner) {
                  // Insert transfer record
                  await db.insertTransfer({
                    username: String(username),
                    fromOwner: String(fromOwner),
                    toOwner: String(newOwner),
                    txId,
                    blockHeight,
                    timestamp,
                  });

                  // Update username owner
                  await db.updateUsernameOwner(String(username), String(newOwner));

                  console.log(`Transferred username: ${username} from ${fromOwner} to ${newOwner} (tx: ${txId})`);
                } else {
                  console.warn(`Could not find existing owner for username: ${username}`);
                }
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error handling transfer-username event:', error);
    throw error;
  }
}

export async function handleReleaseUsernameEvent(event: ChainhookEvent): Promise<void> {
  try {
    for (const apply of event.apply || []) {
      const blockHeight = apply.block_identifier.index;
      const timestamp = Math.floor(apply.timestamp / 1000);

      for (const tx of apply.transactions || []) {
        const txId = tx.transaction_identifier.hash;

        for (const op of tx.operations || []) {
          if (
            op.contract_call?.function_name === 'release-username' &&
            op.status === 'success'
          ) {
            // release-username takes one argument: (username (string-ascii 30))
            const args = op.contract_call.function_args || [];
            const usernameArg = args[0];

            if (usernameArg && usernameArg.repr) {
              const username = parseClarityValue(usernameArg.repr, usernameArg.type);

              if (username) {
                // Get current owner from database to find previous_owner
                const existingUsername = await db.getUsername(username);
                const previousOwner = existingUsername?.owner;

                if (previousOwner) {
                  // Insert release record
                  await db.insertRelease({
                    username: String(username),
                    previousOwner: String(previousOwner),
                    txId,
                    blockHeight,
                    timestamp,
                  });

                  // Delete username
                  await db.deleteUsername(String(username));

                  console.log(`Released username: ${username} (previous owner: ${previousOwner}, tx: ${txId})`);
                } else {
                  console.warn(`Could not find existing owner for username: ${username}`);
                }
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error handling release-username event:', error);
    console.error('Event data:', JSON.stringify(event, null, 2));
    throw error;
  }
}
