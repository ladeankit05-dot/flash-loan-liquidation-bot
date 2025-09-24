// Fetch live Aave borrowers from DeBank API
async function fetchLiveAaveAddresses() {
    try {
        const res = await fetch('https://openapi.debank.com/v1/user/all_list?chain=polygon');
        const data = await res.json();
        // Filter for users with Aave debt positions (mock logic, refine as needed)
        return data.filter(u => u.protocols && u.protocols.some(p => p.id === 'aave')).map(u => u.id);
    } catch (err) {
        console.error('[LIVE ADDR FAIL]', err.message);
        return [];
    }
}

import pkg from 'hardhat';
const { ethers } = pkg;
import fetch from 'node-fetch';
import { startArkhamAlertListener, getArkhamAlertTargets } from './arkhamAlerts.js';
import { scanCompoundLiquidationTargets } from './protocols/compound.js';
import { scanVenusLiquidationTargets } from './protocols/venus.js';
import { logProfit } from './profitLogger.js';
import { rotateTargets, refineStrategy } from './strategyManager.js';
import { notifyAll } from './notifier.js';
import { getFlashbotsProvider } from './flashbotsProvider.js';

// Alternative approach - using Aave's Pool contract directly
const AAVE_POOL_ADDRESS = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const AAVE_DATA_PROVIDER = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654";

// Minimum debt threshold (in USD)
const MIN_DEBT_THRESHOLD = 1000;


// Multi-protocol, multi-chain scan
async function scanLiquidationTargets({ protocol = 'aave', chain = 'polygon' } = {}) {
    if (protocol === 'aave') {
        console.log(`🔍 Scanning Aave v3 for real liquidation targets on ${chain}...`);
        let rpcUrl = process.env.POLYGON_RPC;
        if (chain === 'bsc') rpcUrl = process.env.BSC_RPC;
        if (chain === 'arbitrum') rpcUrl = process.env.ARBITRUM_RPC;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const dataProviderAbi = [
            "function getAllReservesTokens() view returns (tuple(string symbol, address tokenAddress)[])",
            "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"
        ];
        const dataProvider = new ethers.Contract(AAVE_DATA_PROVIDER, dataProviderAbi, provider);
        let knownUsers = await fetchLiveAaveAddresses();
        if (knownUsers.length === 0) {
            knownUsers = [
                "0x8d3e809Fbd258083a5Ba004A527159Da535c8abA",
                "0x7cB57B5A97eAbe94205C07890BE4c73d292cA70B",
                "0x3fda67F7583380E67ef93072294A7fAc882FD7E7"
            ];
        }
        const targets = [];
        for (const user of knownUsers) {
            try {
                const data = await dataProvider.getUserAccountData(user);
                const healthFactor = Number(data.healthFactor) / 1e18;
                const totalDebt = Number(data.totalDebtETH) / 1e18;
                const totalCollateral = Number(data.totalCollateralETH) / 1e18;
                if (healthFactor < 1.0 && totalDebt > MIN_DEBT_THRESHOLD) {
                    targets.push({
                        userAddress: user,
                        healthFactor,
                        totalDebt,
                        totalCollateral,
                        debtAsset: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
                        debtSymbol: "USDC",
                        debtAmount: totalDebt,
                        collateralAsset: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
                        collateralSymbol: "WETH",
                        collateralAmount: totalCollateral,
                        liquidationBonus: 1.05
                    });
                }
            } catch (err) {
                console.error(`[FAIL] Error fetching data for user ${user}:`, err.message);
            }
        }
        if (targets.length > 0) {
            console.log("\n💰 REAL LIQUIDATION TARGETS:");
            for (const target of targets) {
                console.log(`   User: ${target.userAddress.slice(0, 8)}...`);
                console.log(`   Health Factor: ${target.healthFactor}`);
                console.log(`   Total Debt: ${target.debtAmount} ETH`);
                console.log(`   Total Collateral: ${target.collateralAmount} ETH`);
                console.log(`   💳 Debt: ${target.debtAmount} ${target.debtSymbol}`);
                console.log(`   🏦 Collateral: ${target.collateralAmount} ${target.collateralSymbol}`);
                console.log(`   🎁 Liquidation Bonus: ${(target.liquidationBonus * 100 - 100).toFixed(1)}%`);
                console.log(`   💰 Potential Profit: ~$${(target.debtAmount * 0.5 * (target.liquidationBonus - 1)).toFixed(2)}`);
            }
        } else {
            console.log("😴 No real liquidation opportunities found.");
        }
        return targets;
    } else if (protocol === 'compound') {
        let rpcUrl = process.env.POLYGON_RPC;
        if (chain === 'bsc') rpcUrl = process.env.BSC_RPC;
        if (chain === 'arbitrum') rpcUrl = process.env.ARBITRUM_RPC;
        return await scanCompoundLiquidationTargets(rpcUrl);
    } else if (protocol === 'venus') {
        let rpcUrl = process.env.BSC_RPC;
        return await scanVenusLiquidationTargets(rpcUrl);
    } else {
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
}

async function executeLiquidation(liquidatorAddress, target) {
    console.log(`\n⚡ Executing liquidation for user ${target.userAddress}`);
    
    const [signer] = await ethers.getSigners();
    const Liquidator = await ethers.getContractFactory("Liquidator");
    const liquidator = Liquidator.attach(liquidatorAddress);

    try {
        // Calculate 50% of debt to liquidate (Aave limitation)
        const maxLiquidation = target.debtAmount * 0.5;
        const debtToCover = ethers.parseUnits(maxLiquidation.toString(), 18); // Assuming 18 decimals
        const flashLoanAmount = debtToCover; // Borrow exactly what we need

        console.log(`   💸 Liquidating ${maxLiquidation.toFixed(6)} ${target.debtSymbol}`);

        // --- 1inch Swap Integration (scaffold) ---
        // ...existing code...

        // --- Flashbots Integration ---
        if (process.env.FLASHBOTS === 'true') {
            console.log('🚦 Routing liquidation via Flashbots RPC...');
            const flashbotsProvider = await getFlashbotsProvider(process.env.POLYGON_RPC, signer);
            const txRequest = await liquidator.populateTransaction.executeFlashLoan(
                target.debtAsset,
                flashLoanAmount,
                target.collateralAsset,
                target.debtAsset,
                target.userAddress,
                debtToCover,
                false
            );
            const signedTx = await signer.signTransaction(txRequest);
            const bundle = [{ signedTransaction: signedTx }];
            const blockNumber = await signer.provider.getBlockNumber();
            const res = await flashbotsProvider.sendBundle(bundle, blockNumber + 1);
            if ('error' in res) throw new Error(res.error.message);
            console.log('   📝 Flashbots bundle sent. Waiting for inclusion...');
            const waitRes = await res.wait();
            if (waitRes === 0) {
                console.log('✅ Flashbots bundle included!');
                // Log profit (simulate tx hash)
                const estimatedProfit = maxLiquidation * (target.liquidationBonus - 1);
                logProfit({
                    protocol: process.env.PROTOCOL || 'aave',
                    chain: process.env.CHAIN || 'polygon',
                    userAddress: target.userAddress,
                    profitUSD: estimatedProfit,
                    txHash: 'flashbots_bundle'
                });
                await notifyAll(`✅ Flashbots liquidation successful!\nUser: ${target.userAddress}\nProfit: ~$${estimatedProfit.toFixed(2)}`);
            } else {
                console.log('❌ Flashbots bundle not included');
                await notifyAll(`❌ Flashbots liquidation failed for user ${target.userAddress}`);
            }
            return;
        }

        // --- Standard liquidation ---
        const tx = await liquidator.executeFlashLoan(
            target.debtAsset,
            flashLoanAmount,
            target.collateralAsset,
            target.debtAsset,
            target.userAddress,
            debtToCover,
            false
        );

        console.log(`   📝 Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Liquidation successful!");
            console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
            // Calculate estimated profit (simplified)
            const estimatedProfit = maxLiquidation * (target.liquidationBonus - 1);
            console.log(`   💰 Estimated profit: $${estimatedProfit.toFixed(2)}`);
            // Log profit
            logProfit({
                protocol: process.env.PROTOCOL || 'aave',
                chain: process.env.CHAIN || 'polygon',
                userAddress: target.userAddress,
                profitUSD: estimatedProfit,
                txHash: tx.hash
            });
            // Notify Telegram/Discord
            await notifyAll(`✅ Liquidation successful!\nUser: ${target.userAddress}\nProfit: ~$${estimatedProfit.toFixed(2)}\nTx: ${tx.hash}`);
        } else {
            console.log("❌ Liquidation failed");
            await notifyAll(`❌ Liquidation failed for user ${target.userAddress}`);
        }

    } catch (error) {
        console.error("❌ Liquidation error:", error.message);
        await notifyAll(`❌ Liquidation error for user ${target.userAddress}: ${error.message}`);
    }
}


async function main() {
    // Start Arkham alert listener
    startArkhamAlertListener();

    console.log("🤖 Aave v3 Flash Loan Liquidation Scanner (with Arkham Alerts)");
    console.log("==========================================");

    async function loop() {
        try {
            // Gas price monitor
            const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC);
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice;
            const maxGasGwei = 80; // Set your threshold
            if (Number(gasPrice) / 1e9 > maxGasGwei) {
                console.warn(`[GAS] High gas price: ${Number(gasPrice) / 1e9} gwei. Waiting...`);
                setTimeout(loop, 1000);
                return;
            }

            // 1. Get Arkham alert targets (highest priority)
            const arkhamTargets = getArkhamAlertTargets();
            // 2. Get normal scan targets (default: aave/polygon, can be changed)
            const scanTargets = await scanLiquidationTargets({
                protocol: process.env.PROTOCOL || 'aave',
                chain: process.env.CHAIN || 'polygon'
            });

            // 3. Merge and prioritize: Arkham targets first, then scan targets
            let targets = [];
            if (arkhamTargets.length > 0) {
                console.log(`\n🚨 Arkham high-priority liquidation alerts: ${arkhamTargets.length}`);
                targets = arkhamTargets.concat(scanTargets.filter(t => !arkhamTargets.some(a => a.userAddress === t.userAddress)));
            } else {
                targets = scanTargets;
            }

            if (targets.length === 0) {
                console.log("😴 No liquidation opportunities found. Will check again in 1 second...");
            } else {
                // Refine strategy based on recent outcomes
                const strategy = refineStrategy();
                // Rotate/prioritize targets
                const prioritizedTargets = rotateTargets(targets, strategy);
                console.log(`\n📋 Top liquidation targets (strategy: ${strategy}):`);
                prioritizedTargets.slice(0, 5).forEach((target, index) => {
                    console.log(`${index + 1}. User: ${target.userAddress.slice(0, 8)}...`);
                    if (target.healthFactor !== undefined) {
                        console.log(`   Health Factor: ${target.healthFactor.toFixed(4)}`);
                    }
                    if (target.valueUSD) console.log(`   Arkham Alert Value: $${target.valueUSD}`);
                    if (target.debtAmount && target.liquidationBonus) {
                        console.log(`   Profit Potential: ~$${(target.debtAmount * 0.5 * (target.liquidationBonus - 1)).toFixed(2)}`);
                    }
                });
            }
        } catch (err) {
            console.error(`[LOOP FAIL] ${err.message}`);
        }
        setTimeout(loop, 1000);
    }
    await loop();
}

// Run the scanner
if (import.meta.url.endsWith(process.argv[1])) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Error:", error);
            process.exit(1);
        });
}

export { scanLiquidationTargets, executeLiquidation };