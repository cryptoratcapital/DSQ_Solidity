// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../storage/Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/ICamelotRouter.sol";

/**
 * @title   DSquared Camelot LP Base
 * @notice  Allows adding and removing liquidity via the CamelotRouter contract
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
abstract contract Camelot_LP_Base is AccessControl, ReentrancyGuard, Camelot_Common_Storage {
    // solhint-disable var-name-mixedcase
    using SafeERC20 for IERC20;

    /// @notice Camelot router address
    address public immutable camelot_router;
    /// @notice Weth address
    address public immutable weth;

    /**
     * @notice Sets the address of the Camelot router and WETH token
     * @param _camelot_router   Camelot router address
     * @param _weth             WETH token address
     */
    constructor(address _camelot_router, address _weth) {
        // solhint-disable-next-line reason-string
        require(_camelot_router != address(0) && _weth != address(0), "Camelot_Common_Storage: Zero address");
        camelot_router = _camelot_router;
        weth = _weth;
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Adds liquidity via the Camelot router
     * @param   tokenA          1st token address
     * @param   tokenB          2nd token address
     * @param   amountADesired  Desired amount of tokenA
     * @param   amountBDesired  Desired amount of tokenB
     * @param   amountAMin      Minimum amout of tokenA to receive
     * @param   amountBMin      Minimum amout of tokenB to receive
     * @param   to              Recipient of liquidity position
     * @param   deadline        Deadline for tx
     */
    function camelot_addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline);

        ICamelotRouter(camelot_router).addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline);
    }

    /**
     * @notice  Adds liquidity via the Camelot router using native token
     * @param   valueIn             Msg.value to send with tx
     * @param   token               Token address
     * @param   amountTokenDesired  Desired amount of token
     * @param   amountTokenMin      Minimum amout of token to receive
     * @param   amountETHMin        Minimum amout of ETH to receive
     * @param   to                  Recipient of liquidity position
     * @param   deadline            Deadline for tx
     */
    function camelot_addLiquidityETH(
        uint valueIn,
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_addLiquidityETH(valueIn, token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline);

        ICamelotRouter(camelot_router).addLiquidityETH{ value: valueIn }(
            token,
            amountTokenDesired,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );
    }

    /**
     * @notice  Removes liquidity via the Camelot router
     * @param   tokenA          1st token address
     * @param   tokenB          2nd token address
     * @param   liquidity       Amount of liquidity to remove
     * @param   amountAMin      Minimum amout of tokenA to receive
     * @param   amountBMin      Minimum amout of tokenB to receive
     * @param   to              Recipient of liquidity position
     * @param   deadline        Deadline for tx
     */
    function camelot_removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);

        address pair = ICamelotRouter(camelot_router).getPair(tokenA, tokenB);
        IERC20(pair).approve(camelot_router, liquidity);

        ICamelotRouter(camelot_router).removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);
    }

    /**
     * @notice  Removes liquidity via the Camelot router
     * @param   token           Token address
     * @param   liquidity       Amount of liquidity to remove
     * @param   amountTokenMin  Minimum amout of token to receive
     * @param   amountETHMin    Minimum amout of ETH to receive
     * @param   to              Recipient of liquidity position
     * @param   deadline        Deadline for tx
     */
    function camelot_removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_camelot_removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, to, deadline);

        address pair = ICamelotRouter(camelot_router).getPair(token, weth);
        IERC20(pair).approve(camelot_router, liquidity);

        ICamelotRouter(camelot_router).removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, to, deadline);
    }

    // ---------- Hooks ----------
    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for camelot_addLiquidity
     * @param   tokenA          1st token address
     * @param   tokenB          2nd token address
     * @param   amountADesired  Desired amount of tokenA
     * @param   amountBDesired  Desired amount of tokenB
     * @param   amountAMin      Minimum amout of tokenA to receive
     * @param   amountBMin      Minimum amout of tokenB to receive
     * @param   to              Recipient of liquidity position
     * @param   deadline        Deadline for tx
     */
    function inputGuard_camelot_addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_addLiquidityETH
     * @param   valueIn             Msg.value to send with tx
     * @param   token               Token address
     * @param   amountTokenDesired  Desired amount of token
     * @param   amountTokenMin      Minimum amout of token to receive
     * @param   amountETHMin        Minimum amout of ETH to receive
     * @param   to                  Recipient of liquidity position
     * @param   deadline            Deadline for tx
     */
    function inputGuard_camelot_addLiquidityETH(
        uint valueIn,
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_removeLiquidity
     * @param   tokenA          1st token address
     * @param   tokenB          2nd token address
     * @param   liquidity       Amount of liquidity to remove
     * @param   amountAMin      Minimum amout of tokenA to receive
     * @param   amountBMin      Minimum amout of tokenB to receive
     * @param   to              Recipient of liquidity position
     * @param   deadline        Deadline for tx
     */
    function inputGuard_camelot_removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) internal virtual {}

    /**
     * @notice  Validates inputs for camelot_removeLiquidityETH
     * @param   token           Token address
     * @param   liquidity       Amount of liquidity to remove
     * @param   amountTokenMin  Minimum amout of token to receive
     * @param   amountETHMin    Minimum amout of ETH to receive
     * @param   to              Recipient of liquidity position
     * @param   deadline        Deadline for tx
     */
    function inputGuard_camelot_removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) internal virtual {}
    // solhint-enable no-empty-blocks
}
