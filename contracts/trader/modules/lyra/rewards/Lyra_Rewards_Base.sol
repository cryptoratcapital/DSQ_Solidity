// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../storage/Lyra_Common_Storage.sol";
import "../../../external/lyra_interfaces/IMultiDistributor.sol";
import "../../../external/camelot_interfaces/ICamelotRouter.sol";

/**
 * @title   HessianX Lyra Rewards Base
 * @notice  Allows claiming LYRA and ARB rewards from Lyra MultiDistributor
 * @dev     The inputGuard functions are designed to be overriden by the inheriting contract.
 *          Key assumptions:
 *              1. Inheritor MUST ensure that the swap output token is valid.
 *              2. Inheritor MAY enforce any criteria on amounts if desired.
 *              3. Input guards MUST revert if their criteria are not met.
 *          Failure to meet these assumptions may result in unsafe behavior!
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
abstract contract Lyra_Rewards_Base is AccessControl, ReentrancyGuard, Lyra_Common_Storage {
    // solhint-disable var-name-mixedcase

    /// @notice Lyra MultiDistributor contract address
    IMultiDistributor public immutable multi_distributor;
    /// @notice ARB token address
    IERC20 public immutable arb_token;
    /// @notice Lyra token address
    IERC20 public immutable lyra_token;
    /// @notice Camelot router address
    ICamelotRouter public immutable camelot_router;

    /**
     * @notice Sets the address of the Lyra MultiDistributor, ARB token, Lyra token, and Camelot router
     * @param   _multi_distributor   Lyra MultiDistributor address
     * @param   _arb_token           ARB Token address
     * @param   _lyra_token          Lyra token address
     * @param   _camelot_router      Camelot router address
     */
    constructor(address _multi_distributor, address _arb_token, address _lyra_token, address _camelot_router) {
        // solhint-disable-next-line reason-string
        require(
            _multi_distributor != address(0) && _arb_token != address(0) && _lyra_token != address(0) && _camelot_router != address(0),
            "Lyra_Rewards_Module: Zero address"
        );
        multi_distributor = IMultiDistributor(_multi_distributor);
        arb_token = IERC20(_arb_token);
        lyra_token = IERC20(_lyra_token);
        camelot_router = ICamelotRouter(_camelot_router);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Claims rewards from Lyra MultiDistributor contract
     */
    function lyra_claimRewards() external onlyRole(EXECUTOR_ROLE) nonReentrant {
        IERC20[] memory tokens = new IERC20[](2);
        (tokens[0], tokens[1]) = (arb_token, lyra_token);
        multi_distributor.claim(tokens);
    }

    /**
     * @notice  Converts Lyra and ARB tokens to output token
     * @param   _outputToken Output token address
     * @param   _arbSwapMinOut Minimum output amount for ARB swap
     * @param   _lyraSwapMinOut Minimum output amount for Lyra swap
     */
    function lyra_dump(
        address _outputToken,
        uint256 _arbSwapMinOut,
        uint256 _lyraSwapMinOut
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_dump(_outputToken, _arbSwapMinOut, _lyraSwapMinOut);

        uint256 bal = arb_token.balanceOf(address(this));
        address[] memory path = new address[](2);
        if (bal > 0) {
            arb_token.approve(address(camelot_router), bal);
            (path[0], path[1]) = (address(arb_token), _outputToken);
            camelot_router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                bal,
                _arbSwapMinOut,
                path,
                address(this),
                address(0),
                block.timestamp
            );
        }

        bal = lyra_token.balanceOf(address(this));
        if (bal > 0) {
            lyra_token.approve(address(camelot_router), bal);
            (path[0], path[1]) = (address((lyra_token)), _outputToken);
            camelot_router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                bal,
                _lyraSwapMinOut,
                path,
                address(this),
                address(0),
                block.timestamp
            );
        }
    }

    // ---------- Hooks ----------

    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for lyra_dump
     * @param   _outputToken Output token address
     * @param   _arbSwapMinOut Minimum output amount for ARB swap
     * @param   _lyraSwapMinOut Minimum output amount for Lyra swap
     */
    function inputGuard_lyra_dump(address _outputToken, uint256 _arbSwapMinOut, uint256 _lyraSwapMinOut) internal virtual {}

    // solhint-enable no-empty-blocks
}
