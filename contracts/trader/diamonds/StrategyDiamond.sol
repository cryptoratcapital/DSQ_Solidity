// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/base/DiamondBase.sol";
import "@solidstate/contracts/proxy/diamond/readable/DiamondReadable.sol";
import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "@solidstate/contracts/access/access_control/AccessControl.sol";

import "../modules/dsq/DSQ_Common_Roles.sol";

/**
 * @title   DSquared Strategy Diamond
 * @notice  Provides core EIP-2535 Diamond and Access Control capabilities
 * @dev     This implementation excludes diamond Cut functions, making its facets immutable once deployed
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract StrategyDiamond is DiamondBase, DiamondReadable, DiamondWritableInternal, AccessControl, ERC165Base, DSQ_Common_Roles {
    constructor(address _admin) {
        require(_admin != address(0), "StrategyDiamond: Zero address");

        _setSupportsInterface(type(IDiamondReadable).interfaceId, true);
        _setSupportsInterface(type(IERC165).interfaceId, true);
        _setSupportsInterface(type(IAccessControl).interfaceId, true);

        // set roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EXECUTOR_ROLE, _admin);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
