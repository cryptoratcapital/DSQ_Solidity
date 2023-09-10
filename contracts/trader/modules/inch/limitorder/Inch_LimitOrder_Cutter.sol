// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/proxy/diamond/writable/DiamondWritableInternal.sol";
import "@solidstate/contracts/introspection/ERC165/base/ERC165Base.sol";
import "./IInch_LimitOrder_Module.sol";

/**
 * @title   DSquared Inch LimitOrder Cutter
 * @notice  Cutter to enable diamonds contract to call Inch LimitOrder functions
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Inch_LimitOrder_Cutter is DiamondWritableInternal, ERC165Base {
    /**
     * @notice  "Cuts" the strategy diamond with IInch_LimitOrder_Module functions
     * @param   _facet      Inch_LimitOrder_Module address
     * @param   _assets     Assets which will be supported for limit orders
     * @param   _oracles    Oracles corresponding to each asset. Order must match assets
     */
    function cut_Inch_LimitOrder(address _facet, address[] memory _assets, address[] memory _oracles) internal {
        // solhint-disable reason-string
        require(_facet != address(0), "Inch_LimitOrder_Cutter: _facet cannot be 0 address");
        require(_assets.length == _oracles.length, "Inch_LimitOrder_Cutter: arrays must be the same length");
        // solhint-enable reason-string

        uint256 selectorIndex;
        // Register
        bytes4[] memory selectors = new bytes4[](7);

        selectors[selectorIndex++] = IInch_LimitOrder_Module.inch_fillOrder.selector;
        selectors[selectorIndex++] = IInch_LimitOrder_Module.inch_cancelOrder.selector;
        selectors[selectorIndex++] = IInch_LimitOrder_Module.inch_addOrder.selector;
        selectors[selectorIndex++] = IInch_LimitOrder_Module.inch_removeOrder.selector;
        selectors[selectorIndex++] = IInch_LimitOrder_Module.isValidSignature.selector;
        selectors[selectorIndex++] = IInch_LimitOrder_Module.inch_getHashes.selector;
        selectors[selectorIndex++] = IInch_LimitOrder_Module.inch_getOracleForAsset.selector;

        _setSupportsInterface(type(IInch_LimitOrder_Module).interfaceId, true);

        // Diamond cut

        FacetCut[] memory facetCuts = new FacetCut[](1);

        facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors });
        bytes memory payload = abi.encodeWithSelector(IInch_LimitOrder_Module.init_Inch_LimitOrder.selector, _assets, _oracles);

        _diamondCut(facetCuts, _facet, payload);
    }
}
