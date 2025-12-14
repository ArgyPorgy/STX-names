# STX Names - On-Chain Username Registry

A production-ready, decentralized username registry service built on Stacks (Bitcoin L2). Users can claim unique usernames tied to their Stacks addresses by paying a registration fee in STX.

![Stacks](https://img.shields.io/badge/Stacks-Bitcoin_L2-orange)
![Clarity](https://img.shields.io/badge/Clarity-4.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- 🔗 **On-Chain Storage** - Usernames stored permanently on Bitcoin L2
- 💰 **Fee Collection** - Configurable registration fee in STX
- 🔄 **Transferable** - Transfer usernames to other Stacks addresses
- 🔐 **Self-Custody** - Full ownership and control of your username
- ✅ **Approval System** - Approve transfers before they happen
- 📊 **Stats Tracking** - Track total registrations and fees collected

## Project Structure

```
stx-names/
├── contracts/
│   └── username-registry.clar    # Main Clarity smart contract
├── tests/
│   └── username-registry.test.ts # Comprehensive unit tests
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── config.ts             # Configuration
│   │   └── App.tsx               # Main app component
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── deploy-testnet.js         # Testnet deployment
│   ├── deploy-mainnet.js         # Mainnet deployment
│   └── check-deployment.js       # Check deployment status
├── settings/
│   ├── Devnet.toml               # Local development config
│   ├── Testnet.toml              # Testnet config
│   └── Mainnet.toml              # Mainnet config
├── Clarinet.toml                 # Clarinet project config
├── package.json                  # Root package.json
└── vitest.config.ts              # Test configuration
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Clarinet](https://github.com/hirosystems/clarinet) (v2.0+)
- [Hiro Wallet](https://wallet.hiro.so/) browser extension

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd stx-names

# Install dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Local Development

1. **Check the contract syntax:**
   ```bash
   clarinet check
   ```

2. **Run the test suite:**
   ```bash
   npm test
   ```

3. **Start the Clarinet console for interactive testing:**
   ```bash
   clarinet console
   ```

4. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

## Smart Contract

### Contract Functions

#### Public Functions

| Function | Description | Parameters |
|----------|-------------|------------|
| `register-username` | Register a new username | `username: string-ascii 30` |
| `transfer-username` | Transfer username to another address | `username: string-ascii 30, new-owner: principal` |
| `approve-transfer` | Approve an address to claim your username | `username: string-ascii 30, approved-for: principal` |
| `claim-transfer` | Claim an approved username transfer | `username: string-ascii 30` |
| `release-username` | Release/delete your username | `username: string-ascii 30` |
| `set-registration-fee` | Update registration fee (admin only) | `new-fee: uint` |

#### Read-Only Functions

| Function | Description |
|----------|-------------|
| `get-username-info` | Get username details (owner, timestamps) |
| `get-username-owner` | Get owner of a username |
| `get-address-username` | Get username for an address |
| `is-username-available` | Check if username is available |
| `get-registration-fee` | Get current registration fee |
| `get-total-usernames` | Get total registered usernames |
| `get-total-fees-collected` | Get total fees collected |
| `has-username` | Check if address has a username |

### Username Rules

- Minimum length: 3 characters
- Maximum length: 30 characters
- Allowed characters: lowercase letters (a-z), numbers (0-9), underscore (_), hyphen (-)
- Each address can only own one username at a time

### Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 100 | `ERR_UNAUTHORIZED` | Caller not authorized |
| 101 | `ERR_USERNAME_TAKEN` | Username already registered |
| 102 | `ERR_USERNAME_TOO_SHORT` | Username below minimum length |
| 103 | `ERR_USERNAME_TOO_LONG` | Username exceeds maximum length |
| 104 | `ERR_USERNAME_INVALID_CHARS` | Invalid characters in username |
| 105 | `ERR_INSUFFICIENT_FUNDS` | Not enough STX for fee |
| 106 | `ERR_USERNAME_NOT_FOUND` | Username doesn't exist |
| 107 | `ERR_NOT_OWNER` | Caller doesn't own the username |
| 108 | `ERR_TRANSFER_FAILED` | STX transfer failed |
| 109 | `ERR_ALREADY_HAS_USERNAME` | Address already has a username |
| 110 | `ERR_CANNOT_TRANSFER_TO_SELF` | Cannot transfer to yourself |

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

The test suite covers:
- Username registration (valid/invalid inputs)
- Fee collection and transfer
- Username transfers
- Approval system
- Username release
- Admin functions
- Edge cases

## Deployment

### Testnet Deployment

1. Create a `.env` file in the root directory:
   ```env
   DEPLOYER_MNEMONIC=your twelve word mnemonic phrase here
   ```

2. Ensure your testnet wallet has STX (get from [testnet faucet](https://explorer.stacks.co/sandbox/faucet?chain=testnet))

3. Deploy:
   ```bash
   npm run deploy:testnet
   ```

4. Check deployment status:
   ```bash
   node scripts/check-deployment.js <txid> testnet
   ```

### Mainnet Deployment

⚠️ **Warning:** Mainnet deployment uses real STX!

1. Set up your `.env` with a mainnet-funded wallet

2. Deploy:
   ```bash
   npm run deploy:mainnet
   ```

3. The script will ask for confirmation before broadcasting

### Using Clarinet Deployments

You can also use Clarinet's deployment plans:

```bash
# Generate deployment plan
clarinet deployments generate --testnet

# Apply deployment
clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

## Frontend

The frontend is built with React, TypeScript, and Vite.

### Configuration

Create `frontend/.env`:
```env
VITE_NETWORK=devnet
VITE_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
```

Network options: `devnet`, `testnet`, `mainnet`

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

### Building for Production

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`.

## Contract Interaction Examples

### Using Clarinet Console

```clarity
;; Check if username is available
(contract-call? .username-registry is-username-available "alice")

;; Register a username (costs 1 STX)
(contract-call? .username-registry register-username "alice")

;; Get username info
(contract-call? .username-registry get-username-info "alice")

;; Transfer username
(contract-call? .username-registry transfer-username "alice" 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
```

### Using Stacks.js

```typescript
import { 
  callReadOnlyFunction, 
  openContractCall,
  stringAsciiCV 
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';

const network = new StacksTestnet();
const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const contractName = 'username-registry';

// Check availability
const result = await callReadOnlyFunction({
  network,
  contractAddress,
  contractName,
  functionName: 'is-username-available',
  functionArgs: [stringAsciiCV('alice')],
  senderAddress: contractAddress,
});

// Register username
await openContractCall({
  network,
  contractAddress,
  contractName,
  functionName: 'register-username',
  functionArgs: [stringAsciiCV('alice')],
});
```

## Security Considerations

- The contract owner (deployer) can update registration fees
- Usernames are case-insensitive (stored as lowercase)
- One username per address prevents squatting
- Transfer approval system prevents unauthorized transfers
- All STX fees go directly to the contract owner

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Resources

- [Stacks Documentation](https://docs.stacks.co)
- [Clarity Language Reference](https://docs.stacks.co/clarity)
- [Clarinet Documentation](https://docs.hiro.so/clarinet)
- [Stacks.js Documentation](https://stacks.js.org)
- [Hiro Wallet](https://wallet.hiro.so)
