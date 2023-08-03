// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ILyra_LP_Module.sol";

/**
 * @title   DSquared Lyra LP Cutter
 * @notice  Cutter to enable diamonds contract to call Lyra LP functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Lyra_LP_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ILyra_LP_Module functions
     * @param   _facet  Lyra_LP_Module address
     */
    function cut_Lyra_LP(address _facet) internal {
        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](2);

        selectors[selectorIndex++] = ILyra_LP_Module.lyra_initiateDeposit.selector;
        selectors[selectorIndex++] = ILyra_LP_Module.lyra_initiateWithdraw.selector;

        _setSupportsInterface(type(ILyra_LP_Module).interfaceId, true);

        // Diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
