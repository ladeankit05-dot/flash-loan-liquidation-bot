# flash-loan-liquidation-bot
Flash Loan Liquidation Bot for Aave v3 on Polygon

## Quick Start Guide

### 1. Prerequisites
- Node.js v18 or newer
- npm
- Polygon wallet with some MATIC for gas
- Polygon RPC endpoint (free from Ankr, Alchemy, etc.)

### 2. Clone and Install
```bash
git clone https://github.com/ladeankit05-dot/flash-loan-liquidation-bot.git
cd flash-loan-liquidation-bot
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env` and fill in your Polygon RPC and wallet private key:
```bash
cp .env.example .env
# Edit .env and add your values
```

### 4. Compile and Test Contracts
```bash
npx hardhat compile
npx hardhat test
```

### 5. Deploy Liquidator Contract
```bash
npx hardhat run scripts/liquidate.js --network polygon
```

### 6. Scan for Liquidation Targets
```bash
npx hardhat run scripts/scanTargets.js --network polygon
```

### 7. Execute Liquidations
Use the deployed contract address and run the liquidation script (see example in `liquidate.js`).

### 8. Monitor Profits
Withdraw profits using the contract's `withdrawProfit` function.

---
## Real-World Deployment Notes
- Never share your private key.
- Use a secure RPC provider.
- For production, integrate live Aave data in `scanTargets.js`.
- Consider adding DEX integration for collateral swaps.
- Monitor gas costs and risks.

---
# Flash Loan Liquidation Bot

## Overview

This project is a flash loan liquidation bot designed to operate on the Polygon blockchain using Aave v3 protocol. The bot identifies undercollateralized positions in the Aave lending pool and executes profitable liquidations without requiring upfront capital by utilizing flash loans. The system automatically scans for liquidation opportunities, executes flash loan transactions to liquidate risky positions, and captures liquidation bonuses as profit.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Smart Contract Architecture
- **Liquidator Contract**: Core smart contract that implements Aave's IFlashLoanReceiver interface to handle flash loan operations and execute liquidations
- **Flash Loan Integration**: Uses Aave v3's flash loan functionality to borrow assets temporarily for liquidation without collateral
- **Access Control**: Implements OpenZeppelin's Ownable pattern for contract administration and security

### Development Framework
- **Hardhat**: Primary development environment for Solidity compilation, testing, and deployment
- **Solidity 0.8.20**: Smart contract programming language version
- **ES6 Modules**: Modern JavaScript module system used throughout the project

### Blockchain Integration
- **Polygon Network**: Target blockchain for deployment due to low gas fees and Aave v3 availability
- **Ethers.js v6**: Primary library for blockchain interactions and contract deployment
- **Environment Variables**: Secure configuration management for private keys and RPC endpoints

### Automation System
- **Scanning Module**: JavaScript script that monitors Aave positions for liquidation opportunities
- **Deployment Scripts**: Automated contract deployment and interaction scripts
- **Bot Loop**: Continuous monitoring system that scans every 30 seconds for new opportunities

### Liquidation Logic
- **Health Factor Monitoring**: Tracks user positions with health factors below 1.0 (liquidatable threshold)
- **Profit Calculation**: Evaluates potential profits from liquidation bonuses before execution
- **Risk Management**: Implements minimum debt thresholds and gas cost considerations

## External Dependencies

### Blockchain Infrastructure
- **Aave v3 Protocol**: Core lending protocol providing flash loans and liquidation functionality on Polygon
- **Polygon RPC**: Network connectivity for blockchain interactions and transaction broadcasting

### Development Libraries
- **@openzeppelin/contracts**: Secure smart contract templates for access control and token standards
- **@nomicfoundation/hardhat-toolbox**: Comprehensive development tools including testing and verification utilities
- **node-fetch**: HTTP client for external API interactions and data fetching

### Runtime Dependencies
- **dotenv**: Environment variable management for secure configuration
- **@types/node**: TypeScript definitions for Node.js runtime compatibility

### Third-party Services
- **Polygon RPC Providers**: Multiple fallback options including public RPCs and premium providers like Ankr/Alchemy
- **Aave Contracts**: Integration with deployed Aave v3 smart contracts on Polygon mainnet