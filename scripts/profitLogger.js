// profitLogger.js
// Logs realized profits from liquidations to a file and/or console
import fs from 'fs';

const LOG_FILE = process.env.PROFIT_LOG_FILE || './profit-log.csv';

export function logProfit({ protocol, chain, userAddress, profitUSD, txHash, timestamp = Date.now() }) {
    const logLine = `${new Date(timestamp).toISOString()},${protocol},${chain},${userAddress},${profitUSD},${txHash}`;
    fs.appendFileSync(LOG_FILE, logLine + '\n');
    console.log(`[PROFIT] ${logLine}`);
}
