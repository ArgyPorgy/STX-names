# Chainhook Transaction Generator Usage

This script cycles through 4 wallets, registering and releasing usernames to trigger chainhooks.

## Setup

1. Make sure you have 4 accounts with STX for fees (all derived from the same mnemonic)
2. Add your mnemonic and wallet addresses to your `.env` file

### Add to `.env` file:

```env
WALLET_MNEMONIC="word1 word2 word3 ... word12"
WALLET_ADDRESS_1=ST1ABC123...
WALLET_ADDRESS_2=ST2DEF456...
WALLET_ADDRESS_3=ST3GHI789...
WALLET_ADDRESS_4=ST4JKL012...
```

**Note:** 
- The script will derive accounts from your mnemonic and match them to your provided addresses
- Use quotes around the mnemonic if it contains spaces (which it should - it's a space-separated list of words)
- All 4 addresses must correspond to accounts from the same mnemonic
- The script searches up to 50 accounts to find matches

## Usage

```bash
npm run generate-chainhook-txs -- <loops>
```

### Example

```bash
# Run 5 loops (5 cycles through all 4 wallets)
npm run generate-chainhook-txs -- 5
```

The script will automatically read the private keys from your `.env` file.

## How It Works

For each loop:
1. **Wallet 1**: Register username → Wait 10s → Release username → Wait 10s
2. **Wallet 2**: Register same username → Wait 10s → Release → Wait 10s
3. **Wallet 3**: Register same username → Wait 10s → Release → Wait 10s
4. **Wallet 4**: Register same username → Wait 10s → Release → Wait 10s
5. Repeat for specified number of loops

## Transaction Flow

- Each wallet performs 2 transactions per loop (register + release)
- 4 wallets × 2 transactions = **8 transactions per loop**
- 5 loops = **40 total transactions**
- Each transaction triggers a chainhook → stored in database

## Features

- ✅ Automatic nonce management per wallet
- ✅ 10-second delays between operations
- ✅ Error handling (continues on failures)
- ✅ Progress tracking
- ✅ Reuses same username across wallets (since it's released)
- ✅ Generates random 6-character usernames (3 letters repeated)

## Requirements

- Wallets must have sufficient STX for fees (~5000 microSTX per transaction)
- Network must be set to `mainnet` in `.env` (this script only works on mainnet)
- Contract must be deployed and accessible on mainnet

## Security Note

⚠️ **Never commit private keys to git!** 
- Use environment variables or pass them as command-line arguments only
- Consider using a `.env` file with proper `.gitignore` protection


