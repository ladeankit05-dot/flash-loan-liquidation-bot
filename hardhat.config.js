/** @type import('hardhat/config').HardhatUserConfig */
import "@nomicfoundation/hardhat-toolbox";
import 'dotenv/config';

export default {
  solidity: "0.8.20",
  networks: {
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
      accounts: process.env.PRIVATEKEY ? [process.env.PRIVATEKEY] : []
    }
  }
};