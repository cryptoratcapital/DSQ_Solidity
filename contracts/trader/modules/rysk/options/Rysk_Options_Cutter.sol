// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./IRysk_Options_Module.sol";

/**
 * @title   DSquared Rysk Options Cutter
 * @notice  Cutter to enable diamonds contract to call Rysk options functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Rysk_Options_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with IRysk_Options_Module functions
     * @param   _facet  Rysk_Options_Module address
     */
    function cut_Rysk_Options(address _facet) internal {
        // solhint-disable-next-line reason-string
        require(_facet != address(0), "Rysk_Options_Cutter: _facet cannot be 0 address");

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](3);

        selectors[selectorIndex++] = IRysk_Options_Module.rysk_executeOrder.selector;
        selectors[selectorIndex++] = IRysk_Options_Module.rysk_executeBuyBackOrder.selector;
        selectors[selectorIndex++] = IRysk_Options_Module.rysk_executeStrangle.selector;

        _setSupportsInterface(type(IRysk_Options_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
