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

# Backup original Mainnet.toml
cp settings/Mainnet.toml settings/Mainnet.toml.backup

# Write mnemonic directly to Mainnet.toml
cat > settings/Mainnet.toml << EOF
[network]
name = "mainnet"
deployment_fee_rate = 10
epoch = "2.1"

[accounts.deployer]
mnemonic = "$DEPLOYER_MNEMONIC"
EOF

# Deploy using the existing plan
echo "🚀 Deploying to MAINNET..."
echo "⚠️  WARNING: This will deploy to MAINNET - real STX will be used!"
echo "Contract will be: SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R.username-registry-v2"
echo "Using deployment plan with Clarity 4 and epoch 2.1..."

clarinet deployments apply --use-on-disk-deployment-plan --deployment-plan-path deployments/default.mainnet-plan.yaml

# Restore original
mv settings/Mainnet.toml.backup settings/Mainnet.toml

