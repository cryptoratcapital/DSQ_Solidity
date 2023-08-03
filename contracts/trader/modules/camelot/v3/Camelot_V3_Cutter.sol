// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ICamelot_V3_Module.sol";

/**
 * @title   DSquared Camelot V3 Cutter
 * @notice  Cutter to enable diamonds contract to call Camelot v3 functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_V3_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ICamelot_V3_Module functions
     * @param   _facet  Camelot_V3_Module address
     */
    function cut_Camelot_V3(address _facet) internal {
        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](8);

        selectors[selectorIndex++] = ICamelot_V3_Module.camelot_v3_swap.selector;
        selectors[selectorIndex++] = ICamelot_V3_Module.camelot_v3_mint.selector;
        selectors[selectorIndex++] = ICamelot_V3_Module.camelot_v3_burn.selector;
        selectors[selectorIndex++] = ICamelot_V3_Module.camelot_v3_collect.selector;
        selectors[selectorIndex++] = ICamelot_V3_Module.camelot_v3_increaseLiquidity.selector;
        selectors[selectorIndex++] = ICamelot_V3_Module.camelot_v3_decreaseLiquidity.selector;
        selectors[selectorIndex++] = ICamelot_V3_Module.camelot_v3_decreaseLiquidityAndCollect.selector;
        selectors[selectorIndex++] = ICamelot_V3_Module.camelot_v3_decreaseLiquidityCollectAndBurn.selector;

        _setSupportsInterface(type(ICamelot_V3_Module).interfaceId, true);

        // Diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);

        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });

        _diamondCut(facetCuts, address(0), "");
    }
}
