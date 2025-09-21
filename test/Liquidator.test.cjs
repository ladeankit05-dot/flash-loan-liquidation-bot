const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Liquidator (with mocks)", function () {
  let liquidator, owner, mockPool, mockProvider;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const MockPool = await ethers.getContractFactory("MockPool");
    mockPool = await MockPool.deploy();
    await mockPool.waitForDeployment();

    const MockAddressesProvider = await ethers.getContractFactory("MockAddressesProvider");
    mockProvider = await MockAddressesProvider.deploy(mockPool.target);
    await mockProvider.waitForDeployment();

    const Liquidator = await ethers.getContractFactory("Liquidator");
    liquidator = await Liquidator.deploy(mockProvider.target);
    await liquidator.waitForDeployment();
  });

  it("should deploy and set addresses provider", async function () {
    expect(await liquidator.ADDRESSES_PROVIDER()).to.equal(mockProvider.target);
    expect(await liquidator.owner()).to.equal(owner.address);
  });

  it("should allow owner to withdraw profit (mock)", async function () {
    await expect(liquidator.withdrawProfit(owner.address)).to.be.revertedWith("No profit to withdraw");
  });

  it("should allow owner to withdraw ETH (mock)", async function () {
    await expect(liquidator.withdrawETH()).to.be.revertedWith("No ETH to withdraw");
  });
});
