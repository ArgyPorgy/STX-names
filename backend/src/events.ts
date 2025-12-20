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
        sender_address?: string;
        function_name?: string;
        args?: string; // Hex-encoded Clarity values
        contract_identifier?: string;
      };
      operations: Array<{
        operation_identifier: { index: number };
        type: string;
        status: string;
        metadata?: {
          function_name?: string;
          args?: string; // Hex-encoded Clarity values
          contract_identifier?: string;
        };
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
    console.log('Processing register-username event...');
    console.log('Event structure:', JSON.stringify(event, null, 2).substring(0, 500));
    
    // Chainhooks might send the data in different structures - let's handle both
    const applyData = event.apply || [];
    
    if (applyData.length === 0) {
      console.warn('No apply data in event');
      return;
    }

    for (const apply of applyData) {
      if (!apply.block_identifier) {
        console.warn('Missing block_identifier in apply data, skipping...');
        continue;
      }
      const blockHeight = apply.block_identifier.index;
      const timestamp = Math.floor((apply.timestamp || Date.now()) / 1000); // Convert to seconds

      for (const tx of apply.transactions || []) {
        const txId = tx.transaction_identifier.hash;
        console.log(`Processing tx: ${txId}`);

        // Find the register-username contract call in operations
        const registerOp = (tx.operations || []).find(op => 
          op.type === 'contract_call' && 
          op.metadata?.function_name === 'register-username' &&
          op.status === 'success'
        );

        if (registerOp && tx.metadata?.status === 'success') {
          console.log('Found register-username operation!');
          
          // Get sender from transaction metadata
          const sender = tx.metadata?.sender_address;
          console.log(`Sender: ${sender}`);
          
          // Args are in the operation metadata, not transaction metadata
          const argsHex = registerOp.metadata?.args;
          console.log(`Args hex: ${argsHex}`);
          
          if (sender && argsHex) {
            // Decode hex-encoded Clarity string
            // The format seems to be: type(4) + flag(1) + length(4) + string
            // Example: 0x000000010d0000000468657979 = "heyy"
            try {
              const buffer = Buffer.from(argsHex.startsWith('0x') ? argsHex.slice(2) : argsHex, 'hex');
              console.log(`Buffer length: ${buffer.length}, hex: ${buffer.toString('hex')}`);
              
              // Try multiple offsets for length field
              let username: string | null = null;
              
              // Method 1: Read length at offset 8 (bytes 8-11), string starts at 12
              if (buffer.length >= 12) {
                const len1 = buffer.readUInt32BE(8);
                if (len1 > 0 && len1 < 50 && 12 + len1 <= buffer.length) {
                  const str1 = buffer.slice(12, 12 + len1).toString('ascii');
                  if (/^[a-z0-9_-]+$/i.test(str1)) {
                    username = str1;
                    console.log(`Found username at offset 12 (length at 8): ${username}`);
                  }
                }
              }
              
              // Method 2: Try offset 5 for length (bytes 5-8), string at 9
              if (!username && buffer.length >= 9) {
                const len2 = buffer.readUInt32BE(5);
                if (len2 > 0 && len2 < 50 && 9 + len2 <= buffer.length) {
                  const str2 = buffer.slice(9, 9 + len2).toString('ascii');
                  if (/^[a-z0-9_-]+$/i.test(str2)) {
                    username = str2;
                    console.log(`Found username at offset 9 (length at 5): ${username}`);
                  }
                }
              }
              
              // Method 3: Scan for ASCII strings
              if (!username) {
                for (let i = 4; i < buffer.length - 4; i++) {
                  const len = buffer.readUInt32BE(i);
                  if (len > 2 && len < 50 && i + 4 + len <= buffer.length) {
                    const str = buffer.slice(i + 4, i + 4 + len).toString('ascii');
                    if (/^[a-z0-9_-]+$/i.test(str)) {
                      username = str;
                      console.log(`Found username by scanning at offset ${i + 4}: ${username}`);
                      break;
                    }
                  }
                }
              }
              
              if (username && sender) {
                await db.insertUsername({
                  username: username,
                  owner: sender,
                  registeredAt: timestamp,
                  txId,
                  blockHeight,
                });

                console.log(`✓ Registered username: ${username} -> ${sender} (tx: ${txId})`);
              } else {
                console.warn(`⚠ Could not decode username. Buffer: ${buffer.toString('hex')}`);
                console.log('Full transaction:', JSON.stringify(tx, null, 2));
              }
            } catch (error: any) {
              console.error('Error decoding hex args:', error);
              console.log('Full transaction:', JSON.stringify(tx, null, 2));
            }
          } else {
            console.warn(`⚠ Missing sender or args: sender=${sender}, args=${argsHex}`);
          }
        }
        
        // Also check operations for fallback (in case structure is different)
        for (const op of tx.operations || []) {
          if (
            op.type === 'contract_call' &&
            op.metadata?.function_name === 'register-username' &&
            op.status === 'success'
          ) {
            const sender = tx.metadata?.sender_address || op.account?.address;
            const argsHex = op.metadata?.args;
            
            if (sender && argsHex) {
              try {
                const hexWithoutPrefix = argsHex.startsWith('0x') ? argsHex.slice(2) : argsHex;
                const buffer = Buffer.from(hexWithoutPrefix, 'hex');
                
                // Format: type(4) + unknown(1) + length(4) + string
                if (buffer.length >= 12) {
                  const length = buffer.readUInt32BE(8);
                  const usernameBuffer = buffer.slice(12, 12 + length);
                  const username = usernameBuffer.toString('ascii');
                  
                  if (username) {
                    await db.insertUsername({
                      username: username,
                      owner: sender,
                      registeredAt: timestamp,
                      txId,
                      blockHeight,
                    });
                    console.log(`✓ Registered username (from op): ${username} -> ${sender} (tx: ${txId})`);
                  }
                }
              } catch (error: any) {
                console.error('Error decoding args from operation:', error);
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
