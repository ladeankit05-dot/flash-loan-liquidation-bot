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

// Alternative approach - using Aave's Pool contract directly
const AAVE_POOL_ADDRESS = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const AAVE_DATA_PROVIDER = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654";

// Minimum debt threshold (in USD)
const MIN_DEBT_THRESHOLD = 1000;

async function scanLiquidationTargets() {
    console.log("🔍 Scanning Aave v3 for real liquidation targets...");
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC);
    // Aave v3 Data Provider ABI (minimal)
    const dataProviderAbi = [
        "function getAllReservesTokens() view returns (tuple(string symbol, address tokenAddress)[])",
        "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"
    ];
    const dataProvider = new ethers.Contract(AAVE_DATA_PROVIDER, dataProviderAbi, provider);

    // Fetch live addresses
    let knownUsers = await fetchLiveAaveAddresses();
    if (knownUsers.length === 0) {
        // Fallback to static list if API fails
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
        // Example: Swap collateral to debt asset with slippage guard
        // const swapRes = await fetch(`https://api.1inch.io/v5.0/137/swap?fromTokenAddress=${target.collateralAsset}&toTokenAddress=${target.debtAsset}&amount=${debtToCover}&fromAddress=${liquidatorAddress}&slippage=1`);
        // const swapData = await swapRes.json();
        // if (!swapData.tx) throw new Error('Swap failed or slippage too high');
        // await signer.sendTransaction(swapData.tx);

        // --- Flashbots Integration (scaffold) ---
        // Example: Submit tx via Flashbots (Polygon support is experimental)
        // const flashbotsProvider = ... // Setup Flashbots provider
        // const bundle = [{ signedTransaction: ... }];
        // await flashbotsProvider.sendBundle(bundle, ...);

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
        } else {
            console.log("❌ Liquidation failed");
        }

    } catch (error) {
        console.error("❌ Liquidation error:", error.message);
    }
}

async function main() {
    console.log("🤖 Aave v3 Flash Loan Liquidation Scanner");
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
            const targets = await scanLiquidationTargets();
            if (targets.length === 0) {
                console.log("😴 No liquidation opportunities found. Will check again in 1 second...");
            } else {
                console.log("\n📋 Top liquidation targets:");
                targets.slice(0, 5).forEach((target, index) => {
                    console.log(`${index + 1}. User: ${target.userAddress.slice(0, 8)}...`);
                    console.log(`   Health Factor: ${target.healthFactor.toFixed(4)}`);
                    console.log(`   Profit Potential: ~$${(target.debtAmount * 0.5 * (target.liquidationBonus - 1)).toFixed(2)}`);
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