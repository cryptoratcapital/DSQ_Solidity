// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ICamelot_NFTPool_Module.sol";

/**
 * @title   DSquared Camelot NFTPool Cutter
 * @notice  Cutter to enable diamonds contract to call Camelot nft pool functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_NFTPool_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ICamelot_NFTPool_Module functions
     * @param   _facet  Camelot_NFTPool_Module address
     */
    function cut_Camelot_NFTPool(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "Camelot_NFTPool_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](13);

        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_createPosition.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_addToPosition.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_harvestPosition.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_withdrawFromPosition.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_renewLockPosition.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_lockPosition.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_splitPosition.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_mergePositions.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.camelot_nftpool_emergencyWithdraw.selector;

        selectors[selectorIndex++] = ICamelot_NFTPool_Module.onERC721Received.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.onNFTHarvest.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.onNFTAddToPosition.selector;
        selectors[selectorIndex++] = ICamelot_NFTPool_Module.onNFTWithdraw.selector;

        _setSupportsInterface(type(ICamelot_NFTPool_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
