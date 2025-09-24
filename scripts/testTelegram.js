// testTelegram.js
// Send a test message to your Telegram bot/chat
import { sendTelegramMessage } from './notifier.js';

async function main() {
    await sendTelegramMessage('🚀 Telegram integration test: Your liquidation bot is online!');
    console.log('✅ Test message sent to Telegram (if credentials are set).');
}

main().catch(console.error);
