// strategyManager.js
// Handles target rotation and strategy refinement for the liquidation bot
import fs from 'fs';

const LOG_FILE = process.env.PROFIT_LOG_FILE || './profit-log.csv';

export function rotateTargets(targets, strategy = 'profit') {
    if (strategy === 'profit') {
        // Prioritize targets with highest potential profit
        return [...targets].sort((a, b) => ((b.debtAmount * (b.liquidationBonus - 1)) - (a.debtAmount * (a.liquidationBonus - 1))));
    }
    // Add more strategies as needed
    return targets;
}

export function refineStrategy() {
    // Example: If last 3 liquidations failed, switch to more conservative mode
    if (!fs.existsSync(LOG_FILE)) return 'profit';
    const logs = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
    if (logs.length < 3) return 'profit';
    // Placeholder: always return 'profit' for now
    return 'profit';
}
