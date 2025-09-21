// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPool {
    event FlashLoan(address receiver, address[] assets, uint256[] amounts, uint256[] modes, address onBehalfOf, bytes params, uint16 referralCode);
    event LiquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken);

    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external {
        emit FlashLoan(receiverAddress, assets, amounts, modes, onBehalfOf, params, referralCode);
    }

    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external {
        emit LiquidationCall(collateralAsset, debtAsset, user, debtToCover, receiveAToken);
    }
}

contract MockAddressesProvider {
    address public pool;
    constructor(address _pool) { pool = _pool; }
    function getPool() external view returns (address) { return pool; }
}
