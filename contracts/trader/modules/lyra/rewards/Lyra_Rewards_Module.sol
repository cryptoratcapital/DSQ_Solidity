// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Lyra_Rewards_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared Lyra Rewards Module
 * @notice  Allows claiming rewards from Lyra MultiDistributor
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Lyra_Rewards_Module is Lyra_Rewards_Base, DSQ_Trader_Storage {
    // solhint-disable no-empty-blocks, var-name-mixedcase

    /**
     * @notice Sets the address of the Lyra MultiDistributor, ARB token, Lyra token, and Camelot router
     * @param   _multi_distributor  Lyra MultiDistributor address
     * @param   _arb_token          ARB Token address
     * @param   _lyra_token         Lyra token address
     * @param   _camelot_router     Camelot router address
     */
    constructor(
        address _multi_distributor,
        address _arb_token,
        address _lyra_token,
        address _camelot_router
    ) Lyra_Rewards_Base(_multi_distributor, _arb_token, _lyra_token, _camelot_router) {}

    // solhint-enable no-empty-blocks, var-name-mixedcase

    // (address _outputToken, uint256 _arbSwapMinOut, uint256 _lyraSwapMinOut)
    /// @inheritdoc Lyra_Rewards_Base
    function inputGuard_lyra_dump(address _outputToken, uint256, uint256) internal view override {
        validateToken(_outputToken);
    }
}
