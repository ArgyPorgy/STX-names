#!/bin/bash

# Start Clarinet Devnet
# This script starts a local Stacks devnet for frontend development

echo "🚀 Starting Stacks Devnet..."
echo ""
echo "This will start a local Stacks node on http://localhost:3999"
echo "Press Ctrl+C to stop the devnet"
echo ""

# Check if clarinet is installed
if ! command -v clarinet &> /dev/null; then
    echo "❌ Error: Clarinet is not installed"
    echo "Install it from: https://github.com/hirosystems/clarinet"
    exit 1
fi

# Start devnet
clarinet devnet

