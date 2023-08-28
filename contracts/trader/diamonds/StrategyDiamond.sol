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

        bytes4[] memory selectors = new bytes4[](10);
        uint256 selectorIndex;

        // register DiamondReadable

        selectors[selectorIndex++] = IDiamondReadable.facets.selector;
        selectors[selectorIndex++] = IDiamondReadable.facetFunctionSelectors.selector;
        selectors[selectorIndex++] = IDiamondReadable.facetAddresses.selector;
        selectors[selectorIndex++] = IDiamondReadable.facetAddress.selector;

        _setSupportsInterface(type(IDiamondReadable).interfaceId, true);

        // register ERC165

        selectors[selectorIndex++] = IERC165.supportsInterface.selector;

        _setSupportsInterface(type(IERC165).interfaceId, true);

        // register AccessControl

        selectors[selectorIndex++] = IAccessControl.hasRole.selector;
        selectors[selectorIndex++] = IAccessControl.getRoleAdmin.selector;
        selectors[selectorIndex++] = IAccessControl.grantRole.selector;
        selectors[selectorIndex++] = IAccessControl.revokeRole.selector;
        selectors[selectorIndex++] = IAccessControl.renounceRole.selector;

        _setSupportsInterface(type(IAccessControl).interfaceId, true);

        // diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);

        facetCuts[0] = FacetCut({ target: address(this), action: FacetCutAction.ADD, selectors: selectors });

        _diamondCut(facetCuts, address(0), "");

        // set roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EXECUTOR_ROLE, _admin);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
