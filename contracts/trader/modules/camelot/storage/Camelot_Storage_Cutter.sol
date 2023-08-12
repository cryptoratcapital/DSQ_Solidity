// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ICamelot_Storage_Module.sol";

/**
 * @title   DSquared Camelot Storage Cutter
 * @notice  Cutter to enable diamonds contract to call Camelot storage functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_Storage_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ICamelot_Storage_Module functions
     * @param   _facet  Camelot_Storage_Module address
     */
    function cut_Camelot_Storage(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "Camelot_Storage_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](8);

        selectors[selectorIndex++] = ICamelot_Storage_Module.manageNFTPools.selector;
        selectors[selectorIndex++] = ICamelot_Storage_Module.manageNitroPools.selector;
        selectors[selectorIndex++] = ICamelot_Storage_Module.manageExecutors.selector;
        selectors[selectorIndex++] = ICamelot_Storage_Module.manageReceivers.selector;
        selectors[selectorIndex++] = ICamelot_Storage_Module.getAllowedNFTPools.selector;
        selectors[selectorIndex++] = ICamelot_Storage_Module.getAllowedNitroPools.selector;
        selectors[selectorIndex++] = ICamelot_Storage_Module.getAllowedExecutors.selector;
        selectors[selectorIndex++] = ICamelot_Storage_Module.getAllowedReceivers.selector;

        _setSupportsInterface(type(ICamelot_Storage_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
