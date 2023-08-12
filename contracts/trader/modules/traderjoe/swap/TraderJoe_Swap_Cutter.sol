// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ITraderJoe_Swap_Module.sol";

/**
 * @title   DSquared TraderJoe Swap Cutter
 * @notice  Cutter to enable diamonds contract to call TraderJoe swap functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract TraderJoe_Swap_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ITraderJoe_Swap_Module functions
     * @param   _facet TraderJoe_Swap_Module address
     */
    function cut_TraderJoe_Swap(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "TraderJoe_Swap_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](9);

        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapExactTokensForTokens.selector;
        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapExactTokensForNATIVE.selector;
        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapExactNATIVEForTokens.selector;
        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapTokensForExactTokens.selector;
        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapTokensForExactNATIVE.selector;
        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapNATIVEForExactTokens.selector;
        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens.selector;
        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens.selector;
        selectors[selectorIndex++] = ITraderJoe_Swap_Module.traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens.selector;

        _setSupportsInterface(type(ITraderJoe_Swap_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
