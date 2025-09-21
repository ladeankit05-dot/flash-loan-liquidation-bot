import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
    console.log('🚀 Deploying MockPool...');
    const MockPool = await ethers.getContractFactory('MockPool');
    const mockPool = await MockPool.deploy();
    await mockPool.waitForDeployment();
    const mockPoolAddress = await mockPool.getAddress();
    console.log('✅ MockPool deployed at:', mockPoolAddress);

    console.log('🚀 Deploying MockAddressesProvider...');
    const MockAddressesProvider = await ethers.getContractFactory('MockAddressesProvider');
    const mockAddressesProvider = await MockAddressesProvider.deploy(mockPoolAddress);
    await mockAddressesProvider.waitForDeployment();
    const mockAddressesProviderAddress = await mockAddressesProvider.getAddress();
    console.log('✅ MockAddressesProvider deployed at:', mockAddressesProviderAddress);

    // Print addresses for manual use
    console.log('\nUse this address for AAVE_POOL_ADDRESSES_PROVIDER in your main script:');
    console.log(mockAddressesProviderAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
