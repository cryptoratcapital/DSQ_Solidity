// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TraderJoe_Swap_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared TraderJoe Swap Module
 * @notice  Allows direct swapping via the TraderJoe LBRouter contract
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract TraderJoe_Swap_Module is TraderJoe_Swap_Base, DSQ_Trader_Storage {
    /**
     * @notice  Sets the addresses of the TraderJoe router
     * @param   _traderjoe_router   TraderJoe router address
     */
    // solhint-disable-next-line var-name-mixedcase, no-empty-blocks
    constructor(address _traderjoe_router) TraderJoe_Swap_Base(_traderjoe_router) {}

    // ---------- Input Guards ----------
    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapExactTokensForTokens(
        uint256, // amountIn
        uint256, // amountOutMin
        ILBRouter.Path memory path,
        address to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapExactTokensForNATIVE(
        uint256, // amountIn
        uint256, // amountOutMinNATIVE
        ILBRouter.Path memory path,
        address payable to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapExactNATIVEForTokens(
        uint256, // amountIn
        uint256, // amountOutMin
        ILBRouter.Path memory path,
        address to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapTokensForExactTokens(
        uint256, // amountOut
        uint256, // amountInMax
        ILBRouter.Path memory path,
        address to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapTokensForExactNATIVE(
        uint256, // amountOut
        uint256, // amountInMax
        ILBRouter.Path memory path,
        address payable to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapNATIVEForExactTokens(
        uint256, // amountOut
        uint256, // amountInMax
        ILBRouter.Path memory path,
        address to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256, // amountIn
        uint256, // amountOutMin
        ILBRouter.Path memory path,
        address to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens(
        uint256, // amountIn
        uint256, // amountOutMinNATIVE
        ILBRouter.Path memory path,
        address payable to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// inheritdoc TraderJoe_Swap_Base
    function inputGuard_traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens(
        uint256, // amountIn
        uint256, // amountOutMin
        ILBRouter.Path memory path,
        address to,
        uint256 // deadline
    ) internal view override {
        validateSwapPath(convertToAddress(path.tokenPath));
        require(to == address(this), "GuardError: Invalid recipient");
    }

    /// @dev    Convert an array of IERC20s to array of addresses
    function convertToAddress(IERC20[] memory tokenPath) internal pure returns (address[] memory) {
        uint256 len = tokenPath.length;
        address[] memory a = new address[](len);

        for (uint256 i; i < len; ) {
            a[i] = address(tokenPath[i]);
            unchecked {
                ++i;
            }
        }
        return a;
    }
}
