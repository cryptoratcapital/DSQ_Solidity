// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./IInch_Swap_Module.sol";

/**
 * @title   DSquared Inch Swap Cutter
 * @notice  Cutter to enable diamonds contract to call Inch swap functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Inch_Swap_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with IInch_Swap_Module functions
     * @param   _facet  Inch_Swap_Module address
     */
    function cut_Inch_Swap(address _facet) internal {
        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](3);

        selectors[selectorIndex++] = IInch_Swap_Module.inch_swap.selector;
        selectors[selectorIndex++] = IInch_Swap_Module.inch_uniswapV3Swap.selector;
        selectors[selectorIndex++] = IInch_Swap_Module.inch_clipperSwap.selector;

        _setSupportsInterface(type(IInch_Swap_Module).interfaceId, true);

        // Diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
