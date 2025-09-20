// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Aave v3 interfaces
interface IPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external;
}

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

contract Liquidator is IFlashLoanReceiver, Ownable {
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool public immutable POOL;

    struct LiquidationParams {
        address collateralAsset;
        address debtAsset;
        address user;
        uint256 debtToCover;
        bool receiveAToken;
    }

    event FlashLoanExecuted(address indexed asset, uint256 amount, uint256 premium);
    event LiquidationExecuted(address indexed user, uint256 debtCovered, uint256 liquidationBonus);

    constructor(address _addressProvider) Ownable(msg.sender) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(_addressProvider);
        POOL = IPool(IPoolAddressesProvider(_addressProvider).getPool());
    }

    function executeFlashLoan(
        address asset,
        uint256 amount,
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external onlyOwner {
        address[] memory assets = new address[](1);
        assets[0] = asset;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // no debt

        LiquidationParams memory liquidationParams = LiquidationParams({
            collateralAsset: collateralAsset,
            debtAsset: debtAsset,
            user: user,
            debtToCover: debtToCover,
            receiveAToken: receiveAToken
        });

        bytes memory params = abi.encode(liquidationParams);

        POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            0
        );
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Invalid caller");

        LiquidationParams memory liquidationParams = abi.decode(params, (LiquidationParams));

        // Approve the debt asset to Aave Pool before liquidation
        IERC20(liquidationParams.debtAsset).approve(address(POOL), liquidationParams.debtToCover);

        // Execute liquidation
        POOL.liquidationCall(
            liquidationParams.collateralAsset,
            liquidationParams.debtAsset,
            liquidationParams.user,
            liquidationParams.debtToCover,
            liquidationParams.receiveAToken
        );

        // Calculate collateral received and swap back to debt asset if needed
        // This is a simplified version - in production, you'd use a DEX aggregator
        uint256 collateralReceived = IERC20(liquidationParams.collateralAsset).balanceOf(address(this));
        
        // For simplification, assume 1:1 swap (in reality, you'd use Uniswap/1inch)
        if (liquidationParams.collateralAsset != assets[0]) {
            // In a real implementation, perform DEX swap here
            // For now, we assume the collateral can cover the flash loan
        }

        // Approve the Pool to pull the flash loan + premium
        uint256 totalDebt = amounts[0] + premiums[0];
        IERC20(assets[0]).approve(address(POOL), totalDebt);

        emit FlashLoanExecuted(assets[0], amounts[0], premiums[0]);
        emit LiquidationExecuted(liquidationParams.user, liquidationParams.debtToCover, collateralReceived);

        return true;
    }

    function withdrawProfit(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No profit to withdraw");
        IERC20(token).transfer(owner(), balance);
    }

    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner()).transfer(balance);
    }

    receive() external payable {}
}