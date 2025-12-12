#!/bin/bash

# Load .env file
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Check if mnemonic is set
if [ -z "$DEPLOYER_MNEMONIC" ]; then
    echo "❌ Error: DEPLOYER_MNEMONIC not found in .env file"
    exit 1
fi

# Backup original Testnet.toml
cp settings/Testnet.toml settings/Testnet.toml.backup

# Write mnemonic directly to Testnet.toml
cat > settings/Testnet.toml << EOF
[network]
name = "testnet"
deployment_fee_rate = 10
epoch = "2.1"

[accounts.deployer]
mnemonic = "$DEPLOYER_MNEMONIC"
EOF

# Deploy using the existing plan (don't regenerate)
echo "🚀 Deploying to testnet..."
echo "Using deployment plan with Clarity 4 and epoch 2.1..."
echo "Y" | clarinet deployments apply --use-on-disk-deployment-plan --deployment-plan-path deployments/default.testnet-plan.yaml

# Restore original
mv settings/Testnet.toml.backup settings/Testnet.toml

