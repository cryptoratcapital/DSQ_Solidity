// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ILyra_Storage_Module.sol";

/**
 * @title   DSquared Lyra Storage Cutter
 * @notice  Cutter to enable diamonds contract to call Lyra storage functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Lyra_Storage_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ILyra_Storage_Module functions
     * @param   _facet  Lyra_Storage_Module address
     */
    function cut_Lyra_Storage(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "Lyra_Storage_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](5);

        selectors[selectorIndex++] = ILyra_Storage_Module.addLyraMarket.selector;
        selectors[selectorIndex++] = ILyra_Storage_Module.removeLyraMarket.selector;
        selectors[selectorIndex++] = ILyra_Storage_Module.getAllowedLyraMarkets.selector;
        selectors[selectorIndex++] = ILyra_Storage_Module.getAllowedLyraPools.selector;
        selectors[selectorIndex++] = ILyra_Storage_Module.getLyraPoolQuoteAsset.selector;

        _setSupportsInterface(type(ILyra_Storage_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
