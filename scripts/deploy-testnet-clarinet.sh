#!/bin/bash

# Load .env file and export variables
# This handles quoted values properly
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Check if mnemonic is set
if [ -z "$DEPLOYER_MNEMONIC" ]; then
    echo "❌ Error: DEPLOYER_MNEMONIC not found in .env file"
    echo "Make sure your .env file contains:"
    echo "DEPLOYER_MNEMONIC=\"your twelve word mnemonic phrase here\""
    exit 1
fi

# Verify mnemonic word count
WORD_COUNT=$(echo "$DEPLOYER_MNEMONIC" | wc -w | tr -d ' ')
if [ "$WORD_COUNT" -lt 12 ]; then
    echo "❌ Error: Mnemonic must be at least 12 words (found $WORD_COUNT)"
    exit 1
fi

# Deploy using Clarinet
echo "🚀 Deploying to testnet..."
echo "Using deployer address from mnemonic..."
clarinet deployments apply --testnet

