// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

/**
 * ----- DO NOT USE IN PRODUCTION -----
 *
 * @title   DSquared Rescue Module
 * @notice  Allows arbitrary calls to any address
 * @dev     Intended to retrieve funds in the event of an integration bug
 * @dev     WARNING - NOT FOR PRODUCTION USE - WHITELISTED TEAM FUNDED STRATEGIES ONLY
 * @author  HessianX
 * @custom:developer    BowTiedPickle

 * ----- DO NOT USE IN PRODUCTION -----
 */
interface IDSQ_Rescue_Module {
    function arbitraryCall(address _target, uint256 _value, bytes calldata _data) external;
}
