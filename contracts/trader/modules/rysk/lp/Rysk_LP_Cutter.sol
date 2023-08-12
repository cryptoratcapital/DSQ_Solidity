// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./IRysk_LP_Module.sol";

/**
 * @title   DSquared Rysk LP Cutter
 * @notice  Cutter to enable diamonds contract to call Rysk LP functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Rysk_LP_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with IRysk_LP_Module functions
     * @param   _facet  Rysk_LP_Module address
     */
    function cut_Rysk_LP(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "Rysk_LP_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](4);

        selectors[selectorIndex++] = IRysk_LP_Module.rysk_deposit.selector;
        selectors[selectorIndex++] = IRysk_LP_Module.rysk_redeem.selector;
        selectors[selectorIndex++] = IRysk_LP_Module.rysk_initiateWithdraw.selector;
        selectors[selectorIndex++] = IRysk_LP_Module.rysk_completeWithdraw.selector;

        _setSupportsInterface(type(IRysk_LP_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
