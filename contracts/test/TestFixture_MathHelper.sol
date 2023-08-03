// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

library SafeMath {
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x + y) >= x, "ds-math-add-overflow");
    }

    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x - y) <= x, "ds-math-sub-underflow");
    }

    function mul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x, "ds-math-mul-overflow");
    }
}

library Math {
    function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x < y ? x : y;
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

contract TestFixture_MathHelper {
    using SafeMath for uint256;

    function estimateLiquidity(
        uint256 amountA,
        uint256 amountB,
        uint256 reservesA,
        uint256 reservesB,
        uint256 totalSupply,
        uint256 kLast,
        uint256 feeDenomiator,
        uint256 ownerFeeShare
    ) external pure returns (uint256) {
        totalSupply += feeAmount(reservesA, reservesB, totalSupply, kLast, feeDenomiator, ownerFeeShare);

        // Calculate mint amount
        uint256 optimalB = amountA.mul(reservesB) / (reservesA);
        uint256 optimalA = amountB.mul(reservesA) / (reservesB);

        if (optimalB <= amountB) {
            return Math.min(amountA.mul(totalSupply) / (reservesA), optimalB.mul(totalSupply) / (reservesB));
        } else {
            return Math.min(optimalA.mul(totalSupply) / (reservesA), amountB.mul(totalSupply) / (reservesB));
        }
    }

    function _k(uint256 balance0, uint256 balance1) internal pure returns (uint256) {
        return balance0.mul(balance1);
    }

    function feeAmount(
        uint256 reservesA,
        uint256 reservesB,
        uint256 totalSupply,
        uint256 kLast,
        uint256 feeDenominator,
        uint256 ownerFeeShare
    ) internal pure returns (uint256) {
        uint256 rootK = Math.sqrt(_k(uint256(reservesA), uint256(reservesB)));
        uint256 rootKLast = Math.sqrt(kLast);
        uint256 d = (feeDenominator.mul(100) / ownerFeeShare).sub(100);
        uint256 numerator = totalSupply.mul(rootK.sub(rootKLast)).mul(100);
        uint256 denominator = rootK.mul(d).add(rootKLast.mul(100));
        return numerator / denominator;
    }
}
