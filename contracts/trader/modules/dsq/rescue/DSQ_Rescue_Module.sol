// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "../DSQ_Common_Roles.sol";

/**
 * ----- DO NOT USE IN PRODUCTION -----
 *
 * @title   DSquared Rescue Module
 * @notice  Allows arbitrary calls to any address
 * @dev     Intended to retrieve funds in the event of an integration bug
 * @dev     WARNING - NOT FOR PRODUCTION USE - WHITELISTED TEAM FUNDED STRATEGIES ONLY
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle

 * ----- DO NOT USE IN PRODUCTION -----
 */
contract DSQ_Rescue_Module is AccessControl, ReentrancyGuard, DSQ_Common_Roles {
    /**
     * @notice  Allows arbitrary calls to any address
     * @dev     WARNING - NOT FOR PRODUCTION USE - WHITELISTED TEAM FUNDED STRATEGIES ONLY
     * @param   _target     Target address
     * @param   _value      Wei to pass as msg.value
     * @param   _data       Call data
     */
    function arbitraryCall(address _target, uint256 _value, bytes calldata _data) external nonReentrant onlyRole(EXECUTOR_ROLE) {
        (bool success, ) = _target.call{ value: _value }(_data);
        require(success, "DSQ_Rescue_Module: Call Failure");
    }
}
