// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../storage/Lyra_Common_Storage.sol";
import "../../../external/lyra_interfaces/IOptionMarket.sol";

/**
 * @title   DSquared Lyra Options Base
 * @notice  Allows opening and closing options positions via the Lyra OptionMarket Contract
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the tokens are valid
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Inheritor MUST validate the receiver address.
 *              4. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Lyra_Options_Base is AccessControl, ReentrancyGuard, Lyra_Common_Storage {
    /**
     * @notice  Opens a new option position
     * @param   market  Lyra market
     * @param   params  Lyra trade input parameters
     */
    function lyra_openPosition(
        address market,
        IOptionMarket.TradeInputParameters memory params
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_openPosition(market, params);
        IOptionMarket(market).openPosition(params);
    }

    /**
     * @notice  Add collateral to a lyra position
     * @param   market              Lyra market
     * @param   positionId          Id for position
     * @param   amountCollateral    Amount of collateral to add
     */
    function lyra_addCollateral(
        address market,
        uint256 positionId,
        uint256 amountCollateral
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_addCollateral(market, positionId, amountCollateral);

        IOptionMarket(market).addCollateral(positionId, amountCollateral);
    }

    /**
     * @notice  Closes an option position
     * @param   market  Lyra market
     * @param   params  Lyra trade input parameters
     */
    function lyra_closePosition(
        address market,
        IOptionMarket.TradeInputParameters memory params
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_closePosition(market, params);
        IOptionMarket(market).closePosition(params);
    }

    /**
     * @notice  Force closes an option position
     * @param   market  Lyra market
     * @param   params  Lyra trade input parameters
     */
    function lyra_forceClosePosition(
        address market,
        IOptionMarket.TradeInputParameters memory params
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_forceClosePosition(market, params);
        IOptionMarket(market).forceClosePosition(params);
    }

    // ---------- Hooks ----------

    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for lyra_openPosition
     * @param   market  Lyra market
     * @param   params  Lyra trade input parameters
     */
    function inputGuard_lyra_openPosition(address market, IOptionMarket.TradeInputParameters memory params) internal virtual {}

    /**
     * @notice  Validates inputs for lyra_addCollateral
     * @param   market              Lyra market
     * @param   positionId          Id for position
     * @param   amountCollateral    Amount of collateral to add
     */
    function inputGuard_lyra_addCollateral(address market, uint256 positionId, uint256 amountCollateral) internal virtual {}

    /**
     * @notice  Validates inputs for lyra_closePosition
     * @param   market  Lyra market
     * @param   params  Lyra trade input parameters
     */
    function inputGuard_lyra_closePosition(address market, IOptionMarket.TradeInputParameters memory params) internal virtual {}

    /**
     * @notice  Validates inputs for lyra_forceClosePosition
     * @param   market  Lyra market
     * @param   params  Lyra trade input parameters
     */
    function inputGuard_lyra_forceClosePosition(address market, IOptionMarket.TradeInputParameters memory params) internal virtual {}
    // solhint-enable no-empty-blocks
}
