// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/gmx_interfaces/IRouter.sol";

/**
 * @title   DSquared GMX Swap Module Interface
 * @notice  Allows direct swapping via the GMX Router contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface IGMX_Swap_Module {
    // ---------- Functions ----------
    function gmx_swap(address[] memory _path, uint256 _amountIn, uint256 _minOut, address _receiver) external;

    function gmx_swapETHToTokens(uint256 _valueIn, address[] memory _path, uint256 _minOut, address _receiver) external;

    function gmx_swapTokensToETH(address[] memory _path, uint256 _amountIn, uint256 _minOut, address payable _receiver) external;

    // ---------- Getters ----------

    function gmx_router() external view returns (IRouter);
}
