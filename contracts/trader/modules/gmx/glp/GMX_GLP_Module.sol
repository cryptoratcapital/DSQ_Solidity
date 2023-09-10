// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "./GMX_GLP_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared GMX GLP Module
 * @notice  Allows depositing, withdrawing, and claiming rewards in the GLP ecosystem
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the input and output tokens are acceptable.
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @dev     Provides a base set of protections against critical threats, override these only if explicitly necessary.
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract GMX_GLP_Module is GMX_GLP_Base, DSQ_Trader_Storage {
    /**
     * @notice Sets the address of the GMX reward router and GMX GLP reward router
     * @param _gmx_GLPRewardRouter  GMX GLP reward router address
     * @param _gmx_GMXRewardRouter  GMX reward router address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _gmx_GLPRewardRouter, address _gmx_GMXRewardRouter) GMX_GLP_Base(_gmx_GLPRewardRouter, _gmx_GMXRewardRouter) {}

    // ---------- Hooks ----------

    /// @inheritdoc GMX_GLP_Base
    // (address _token, uint256 _amount, uint256 _minUsdg, uint256 _minGlp)
    function inputGuard_gmx_mintAndStakeGlp(address _token, uint256, uint256, uint256) internal virtual override {
        validateToken(_token);
    }

    /// @inheritdoc GMX_GLP_Base
    function inputGuard_gmx_unstakeAndRedeemGlp(
        address _tokenOut,
        uint256, // _glpAmount
        uint256, // _minOut
        address _receiver
    ) internal virtual override {
        validateToken(_tokenOut);
        require(_receiver == address(this), "GMX_GLP_Module: Invalid receiver");
    }

    /// @inheritdoc GMX_GLP_Base
    function inputGuard_gmx_unstakeAndRedeemGlpETH(
        uint256, // _glpAmount
        uint256, // _minOut
        address payable _receiver
    ) internal virtual override {
        require(_receiver == address(this), "GMX_GLP_Module: Invalid receiver");
    }
}
