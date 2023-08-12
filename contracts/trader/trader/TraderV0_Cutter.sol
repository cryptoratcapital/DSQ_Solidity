// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./ITraderV0.sol";

/**
 * @title   DSquared Trader V0 Cutter
 * @notice  Cutter to enable diamonds contract to call trader core functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract TraderV0_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with ITraderV0 functions
     * @param   _traderFacet        TraderV0 address
     * @param   _traderV0Params     Initialization parameters
     */
    function cut_TraderV0(address _traderFacet, TraderV0InitializerParams memory _traderV0Params) internal {
        // solhint-disable-next-line reason-string
        require(_traderFacet != address(0), "TraderV0_Cutter: _traderFacet must not be 0 address");

        uint256 selectorIndex;
        // Register TraderV0
        bytes4[] memory traderSelectors = new bytes4[](20);

        traderSelectors[selectorIndex++] = ITraderV0.setVault.selector;
        traderSelectors[selectorIndex++] = ITraderV0.approve.selector;
        traderSelectors[selectorIndex++] = ITraderV0.custodyFunds.selector;
        traderSelectors[selectorIndex++] = ITraderV0.returnFunds.selector;
        traderSelectors[selectorIndex++] = ITraderV0.withdrawFees.selector;

        traderSelectors[selectorIndex++] = ITraderV0.setFeeRates.selector;
        traderSelectors[selectorIndex++] = ITraderV0.setFeeReceiver.selector;

        traderSelectors[selectorIndex++] = ITraderV0.getAllowedTokens.selector;
        traderSelectors[selectorIndex++] = ITraderV0.getAllowedSpenders.selector;

        traderSelectors[selectorIndex++] = ITraderV0.name.selector;
        traderSelectors[selectorIndex++] = ITraderV0.feeReceiver.selector;
        traderSelectors[selectorIndex++] = ITraderV0.vault.selector;
        traderSelectors[selectorIndex++] = ITraderV0.baseAsset.selector;
        traderSelectors[selectorIndex++] = ITraderV0.performanceFeeRate.selector;
        traderSelectors[selectorIndex++] = ITraderV0.managementFeeRate.selector;
        traderSelectors[selectorIndex++] = ITraderV0.custodyTime.selector;
        traderSelectors[selectorIndex++] = ITraderV0.custodiedAmount.selector;
        traderSelectors[selectorIndex++] = ITraderV0.totalFees.selector;
        traderSelectors[selectorIndex++] = ITraderV0.MAX_PERFORMANCE_FEE_RATE.selector;
        traderSelectors[selectorIndex++] = ITraderV0.MAX_MANAGEMENT_FEE_RATE.selector;

        _setSupportsInterface(type(ITraderV0).interfaceId, true);

        // Diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);

        facetCuts[0] = FacetCut({ target: _traderFacet, action: FacetCutAction.ADD, selectors: traderSelectors });
        bytes memory payload = abi.encodeWithSelector(ITraderV0.initializeTraderV0.selector, _traderV0Params);

        _diamondCut(facetCuts, _traderFacet, payload); // Can add initializations to this call
    }
}
