// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./IGMX_PositionRouter_Module.sol";

/**
 * @title   DSquared GMX PositionRouter Cutter
 * @notice  Cutter to enable diamonds contract to call GMX position router functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract GMX_PositionRouter_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with IGMX_PositionRouter_Module functions
     * @param   _facet  GMX_PositionRouter_Module address
     */
    function cut_GMX_PositionRouter(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "GMX_PositionRouter_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](5);

        selectors[selectorIndex++] = IGMX_PositionRouter_Module.gmx_createIncreasePosition.selector;
        selectors[selectorIndex++] = IGMX_PositionRouter_Module.gmx_createIncreasePositionETH.selector;
        selectors[selectorIndex++] = IGMX_PositionRouter_Module.gmx_createDecreasePosition.selector;
        selectors[selectorIndex++] = IGMX_PositionRouter_Module.gmx_cancelIncreasePosition.selector;
        selectors[selectorIndex++] = IGMX_PositionRouter_Module.gmx_cancelDecreasePosition.selector;

        _setSupportsInterface(type(IGMX_PositionRouter_Module).interfaceId, true);

        // Diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);

        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        bytes memory payload = abi.encodeWithSelector(IGMX_PositionRouter_Module.init_GMX_PositionRouter.selector);

        _diamondCut(facetCuts, _facet, payload);
    }
}
