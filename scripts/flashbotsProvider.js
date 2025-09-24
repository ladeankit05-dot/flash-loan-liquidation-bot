// flashbotsProvider.js
// Sets up a Flashbots provider for private transaction submission
import pkg from 'hardhat';
const { ethers } = pkg;
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';

export async function getFlashbotsProvider(rpcUrl, signer) {
    // Connect to Flashbots relay (mainnet or testnet)
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        signer,
        process.env.FLASHBOTS_RELAY_URL || 'https://relay.flashbots.net',
        'v2'
    );
    return flashbotsProvider;
}
