// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "./Lyra_Rewards_Base.sol";
import "../../dsq/DSQ_Trader_Storage.sol";

/**
 * @title   DSquared Lyra Rewards Module
 * @notice  Allows claiming rewards from Lyra MultiDistributor
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Lyra_Rewards_Module is Lyra_Rewards_Base, DSQ_Trader_Storage {
    // solhint-disable no-empty-blocks, var-name-mixedcase

    /**
     * @notice Sets the address of the Lyra MultiDistributor and Camelot router
     * @param   _multi_distributor  Lyra MultiDistributor address
     * @param   _camelot_router     Camelot router address
     */
    constructor(address _multi_distributor, address _camelot_router) Lyra_Rewards_Base(_multi_distributor, _camelot_router) {}

    // solhint-enable no-empty-blocks, var-name-mixedcase

    /// @inheritdoc Lyra_Rewards_Base
    function inputGuard_lyra_claimRewards(IERC20[] memory tokens) internal view override {
        for (uint256 i; i < tokens.length; ) {
            validateToken(address(tokens[i]));
            unchecked {
                ++i;
            }
        }
    }

    /// @inheritdoc Lyra_Rewards_Base
    function inputGuard_lyra_claimAndDump(IERC20[] memory _tokens, SwapInput[] memory _inputs) internal view override {
        for (uint256 i; i < _inputs.length; ) {
            require(_inputs[i].path.length > 0, "Lyra_Rewards_Module: Empty path");
            // solhint-disable-next-line reason-string
            require(_inputs[i].path[0] == address(_tokens[i]), "Lyra_Rewards_Module: Claim token does not start path");

            // The first token is allowed to not be in the strategy mandate, but all others in the path must be
            for (uint256 j = 1; j < _inputs[i].path.length; ) {
                validateToken(address(_inputs[i].path[j]));
                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }
    }

    /// @inheritdoc Lyra_Rewards_Base
    function inputGuard_lyra_dump(SwapInput[] memory _inputs) internal view override {
        for (uint256 i; i < _inputs.length; ) {
            require(_inputs[i].path.length > 0, "Lyra_Rewards_Module: Empty path");

            for (uint256 j; j < _inputs[i].path.length; ) {
                validateToken(address(_inputs[i].path[j]));
                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }
    }
}
