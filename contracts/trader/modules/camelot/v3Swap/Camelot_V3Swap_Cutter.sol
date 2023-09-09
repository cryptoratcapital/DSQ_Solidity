// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ICamelot_V3Swap_Module.sol";

/**
 * @title   DSquared Camelot V3 Swap Cutter
 * @notice  Cutter to enable diamonds contract to call Camelot v3 Swap functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_V3Swap_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ICamelot_V3Swap_Module functions
     * @param   _facet  Camelot_V3Swap_Module address
     */
    function cut_Camelot_V3Swap(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "Camelot_V3Swap_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](1);

        selectors[selectorIndex++] = ICamelot_V3Swap_Module.camelot_v3_swap.selector;

        _setSupportsInterface(type(ICamelot_V3Swap_Module).interfaceId, true);

        // Diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);

        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });

        _diamondCut(facetCuts, address(0), "");
    }
}
