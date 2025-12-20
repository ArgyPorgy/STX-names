import { config } from './config.js';

// Test data - simulate chainhook webhook payload
const createTestRegisterPayload = (username: string, sender: string, txId: string, blockHeight: number) => ({
  chainhook: {
    uuid: "test-uuid",
    name: "username-registry-v2-register-username"
  },
  event: {
    chain: "stacks",
    network: config.stacks.network,
    apply: [
      {
        block_identifier: {
          index: blockHeight,
          hash: `0x${txId.slice(2, 66)}`
        },
        parent_block_identifier: {
          index: blockHeight - 1,
          hash: `0x${txId.slice(2, 66)}`
        },
        timestamp: Math.floor(Date.now() / 1000),
        transactions: [
          {
            transaction_identifier: {
              hash: txId
            },
            metadata: {
              status: "success",
              type: "contract_call",
              sender_address: sender,
              function_name: "register-username",
              args: generateHexArgs(username),
              contract_identifier: `${config.stacks.contractAddress}.${config.stacks.contractName}`
            },
            operations: [
              {
                operation_identifier: { index: 1 },
                type: "contract_call",
                status: "success",
                metadata: {
                  function_name: "register-username",
                  args: generateHexArgs(username),
                  contract_identifier: `${config.stacks.contractAddress}.${config.stacks.contractName}`
                }
              }
            ]
          }
        ]
      }
    ],
    rollback: []
  }
});

// Generate hex-encoded Clarity string args (simplified)
function generateHexArgs(username: string): string {
  const buffer = Buffer.from(username, 'ascii');
  // Format: type(4) + flag(1) + length(4) + string
  const result = Buffer.alloc(13);
  result.writeUInt32BE(1, 0); // type: string-ascii
  result.writeUInt8(13, 4); // flag
  result.writeUInt32BE(buffer.length, 8); // length
  buffer.copy(result, 12); // string data
  return '0x' + result.toString('hex');
}

async function testWebhook(username: string, sender: string, txId: string, blockHeight: number) {
  const payload = createTestRegisterPayload(username, sender, txId, blockHeight);
  
  try {
    const response = await fetch(`${config.server.apiBaseUrl}/api/chainhooks/register-username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    return { success: response.ok, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Usage: npm run test-webhooks [options]

Options:
  --count <number>    Number of test webhooks to send (default: 10)
  --sender <address>  Sender address (default: contract address)
  --prefix <string>   Username prefix (default: "testuser")

Example:
  npm run test-webhooks -- --count 50 --sender SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R --prefix test
    `);
    process.exit(0);
  }

  const count = parseInt(args[args.indexOf('--count') + 1]) || 10;
  const sender = args[args.indexOf('--sender') + 1] || config.stacks.contractAddress;
  const prefix = args[args.indexOf('--prefix') + 1] || 'testuser';
  
  console.log(`Sending ${count} test webhooks...`);
  console.log(`Sender: ${sender}`);
  console.log(`Username prefix: ${prefix}`);
  console.log('');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < count; i++) {
    const username = `${prefix}${i + 1}`;
    const txId = `0x${Buffer.from(`${Date.now()}-${i}`).toString('hex').padStart(64, '0')}`;
    const blockHeight = 5370000 + i;

    const result = await testWebhook(username, sender, txId, blockHeight);
    
    if (result.success) {
      successCount++;
      process.stdout.write(`✓ ${username} `);
    } else {
      failCount++;
      process.stdout.write(`✗ ${username} `);
    }

    // Small delay to avoid overwhelming the server
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  console.log('\n');
  console.log(`Results: ${successCount} succeeded, ${failCount} failed`);
}

main();
