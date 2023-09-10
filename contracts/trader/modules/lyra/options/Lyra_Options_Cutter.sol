// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ILyra_Options_Module.sol";

/**
 * @title   HessianX Lyra Options Cutter
 * @notice  Cutter to enable diamonds contract to call Lyra options functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Lyra_Options_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ILyra_Options_Module functions
     * @param   _facet  Lyra_Options_Module address
     */
    function cut_Lyra_Options(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "Lyra_Options_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register TraderV0
        bytes4[] memory selectors = new bytes4[](4);

        selectors[selectorIndex++] = ILyra_Options_Module.lyra_openPosition.selector;
        selectors[selectorIndex++] = ILyra_Options_Module.lyra_addCollateral.selector;
        selectors[selectorIndex++] = ILyra_Options_Module.lyra_closePosition.selector;
        selectors[selectorIndex++] = ILyra_Options_Module.lyra_forceClosePosition.selector;

        _setSupportsInterface(type(ILyra_Options_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
