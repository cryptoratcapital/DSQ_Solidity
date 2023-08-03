// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./IAave_Lending_Module.sol";

/**
 * @title   DSquared Aave Lending Cutter
 * @notice  Cutter to enable diamonds contract to call Aave lending and borrowing functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Aave_Lending_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with IAave_Lending_Module functions
     * @param   _facet  Aave_Lending_Module address
     */
    function cut_Aave_Lending(address _facet) internal {
        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](6);

        selectors[selectorIndex++] = IAave_Lending_Module.aave_supply.selector;
        selectors[selectorIndex++] = IAave_Lending_Module.aave_withdraw.selector;
        selectors[selectorIndex++] = IAave_Lending_Module.aave_borrow.selector;
        selectors[selectorIndex++] = IAave_Lending_Module.aave_repay.selector;
        selectors[selectorIndex++] = IAave_Lending_Module.aave_swapBorrowRateMode.selector;
        selectors[selectorIndex++] = IAave_Lending_Module.aave_setUserEMode.selector;

        _setSupportsInterface(type(IAave_Lending_Module).interfaceId, true);

        // Diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        _diamondCut(facetCuts, address(0), "");
    }
}
