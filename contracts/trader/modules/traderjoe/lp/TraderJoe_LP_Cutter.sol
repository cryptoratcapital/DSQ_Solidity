// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ITraderJoe_LP_Module.sol";

/**
 * @title   DSquared TraderJoe LP Cutter
 * @notice  Cutter to enable diamonds contract to call TraderJoe lp functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract TraderJoe_LP_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ITraderJoe_LP_Module functions
     * @param   _facet TraderJoe_LP_Module address
     */
    function cut_TraderJoe_LP(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "TraderJoe_LP_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](5);

        selectors[selectorIndex++] = ITraderJoe_LP_Module.traderjoe_addLiquidity.selector;
        selectors[selectorIndex++] = ITraderJoe_LP_Module.traderjoe_addLiquidityNATIVE.selector;
        selectors[selectorIndex++] = ITraderJoe_LP_Module.traderjoe_removeLiquidity.selector;
        selectors[selectorIndex++] = ITraderJoe_LP_Module.traderjoe_removeLiquidityNATIVE.selector;
        selectors[selectorIndex++] = ITraderJoe_LP_Module.traderjoe_approveForAll.selector;

        _setSupportsInterface(type(ITraderJoe_LP_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
