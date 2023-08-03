// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ICamelot_NitroPool_Module.sol";

/**
 * @title   DSquared Camelot NitroPool Cutter
 * @notice  Cutter to enable diamonds contract to interact with Camelot nitro pools
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_NitroPool_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ICamelot_NitroPool_Module functions
     * @param   _facet  Camelot_NitroPool_Module address
     */
    function cut_Camelot_NitroPool(address _facet) internal {
        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](4);

        selectors[selectorIndex++] = ICamelot_NitroPool_Module.camelot_nitropool_transfer.selector;
        selectors[selectorIndex++] = ICamelot_NitroPool_Module.camelot_nitropool_withdraw.selector;
        selectors[selectorIndex++] = ICamelot_NitroPool_Module.camelot_nitropool_emergencyWithdraw.selector;
        selectors[selectorIndex++] = ICamelot_NitroPool_Module.camelot_nitropool_harvest.selector;

        _setSupportsInterface(type(ICamelot_NitroPool_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
