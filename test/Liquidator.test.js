import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("Liquidator", function () {
  let liquidator, owner;
  const addressProvider = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb"; // Polygon Aave v3

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const Liquidator = await ethers.getContractFactory("Liquidator");
    liquidator = await Liquidator.deploy(addressProvider);
    await liquidator.waitForDeployment();
  });

  it("should deploy and set addresses provider", async function () {
    expect(await liquidator.ADDRESSES_PROVIDER()).to.equal(addressProvider);
    expect(await liquidator.owner()).to.equal(owner.address);
  });

  it("should allow owner to withdraw profit (mock)", async function () {
    // This is a mock test, as actual profit withdrawal requires ERC20 tokens
    await expect(liquidator.withdrawProfit(owner.address)).to.be.revertedWith("No profit to withdraw");
  });

  it("should allow owner to withdraw ETH (mock)", async function () {
    await expect(liquidator.withdrawETH()).to.be.revertedWith("No ETH to withdraw");
  });
});
