// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./IGMX_OrderBook_Module.sol";

/**
 * @title   DSquared GMX OrderBook Cutter
 * @notice  Cutter to enable diamonds contract to call GMX limit order functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract GMX_OrderBook_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with IGMX_OrderBook_Module functions
     * @param   _facet  GMX_OrderBook_Module address
     */
    function cut_GMX_OrderBook(address _facet) internal {
        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](9);

        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_createIncreaseOrder.selector;
        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_createDecreaseOrder.selector;
        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_createSwapOrder.selector;

        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_updateIncreaseOrder.selector;
        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_updateDecreaseOrder.selector;

        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_cancelIncreaseOrder.selector;
        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_cancelDecreaseOrder.selector;
        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_cancelSwapOrder.selector;
        selectors[selectorIndex++] = IGMX_OrderBook_Module.gmx_cancelMultiple.selector;

        _setSupportsInterface(type(IGMX_OrderBook_Module).interfaceId, true);

        // Diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);

        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        bytes memory payload = abi.encodeWithSelector(IGMX_OrderBook_Module.init_GMX_OrderBook.selector);

        _diamondCut(facetCuts, _facet, payload);
    }
}
