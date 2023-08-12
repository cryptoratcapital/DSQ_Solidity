// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ICamelot_LP_Module.sol";

/**
 * @title   DSquared Camelot LP Cutter
 * @notice  Cutter to enable diamonds contract to call Camelot LP functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Camelot_LP_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ICamelot_LP_Module functions
     * @param   _facet  Camelot_LP_Module address
     */
    function cut_Camelot_LP(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "Camelot_LP_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](4);

        selectors[selectorIndex++] = ICamelot_LP_Module.camelot_addLiquidity.selector;
        selectors[selectorIndex++] = ICamelot_LP_Module.camelot_addLiquidityETH.selector;
        selectors[selectorIndex++] = ICamelot_LP_Module.camelot_removeLiquidity.selector;
        selectors[selectorIndex++] = ICamelot_LP_Module.camelot_removeLiquidityETH.selector;

        _setSupportsInterface(type(ICamelot_LP_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
