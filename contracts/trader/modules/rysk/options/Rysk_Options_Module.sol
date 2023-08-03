// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Rysk_Options_Base.sol";

/**
 * @title   DSquared Rysk Options Module
 * @notice  Allows executing options via the Rysk AlphaOptionHandler Contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Rysk_Options_Module is Rysk_Options_Base {
    /**
     * @notice Sets the address of the Rysk AlphaOptionHandler
     * @param  _rysk_alpha_option_handler   Rysk AlphaOptionHandler address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _rysk_alpha_option_handler) Rysk_Options_Base(_rysk_alpha_option_handler) {}
}
