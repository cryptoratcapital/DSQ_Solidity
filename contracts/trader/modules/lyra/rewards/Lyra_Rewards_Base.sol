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
 * @notice  Allows claiming and swapping rewards from Lyra MultiDistributor
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
    /// @notice Camelot router address
    ICamelotRouter public immutable camelot_router;

    /**
     * @notice Sets the address of the Lyra MultiDistributor and Camelot router
     * @param   _multi_distributor   Lyra MultiDistributor address
     * @param   _camelot_router      Camelot router address
     */
    constructor(address _multi_distributor, address _camelot_router) {
        // solhint-disable-next-line reason-string
        require(_multi_distributor != address(0) && _camelot_router != address(0), "Lyra_Rewards_Module: Zero address");
        multi_distributor = IMultiDistributor(_multi_distributor);
        camelot_router = ICamelotRouter(_camelot_router);
    }

    // solhint-enable var-name-mixedcase

    // ---------- Functions ----------

    /**
     * @notice  Claims rewards from Lyra MultiDistributor contract
     * @param   _claimList   List of batchIds to claim
     */
    function lyra_claimRewards(uint[] memory _claimList) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_claimRewards(_claimList);

        multi_distributor.claim(_claimList);
    }

    /**
     * @param   path    Swap path to use
     * @param   minOut  Minimum swap output amount in units of output token
     */
    struct SwapInput {
        address[] path;
        uint256 minOut;
    }

    /**
     * @notice  Claims rewards from Lyra MultiDistributor contract and swaps them for output tokens via Camelot
     * @param   _claimList   List of batchIds to claim
     * @param   _inputs     Array of SwapInput structs
     */
    function lyra_claimAndDump(uint[] memory _claimList, SwapInput[] memory _inputs) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        require(_claimList.length == _inputs.length, "Lyra_Rewards_Module: Length mismatch"); // solhint-disable-line reason-string

        inputGuard_lyra_claimAndDump(_claimList, _inputs);

        multi_distributor.claim(_claimList);

        for (uint256 i; i < _inputs.length; ) {
            IMultiDistributor.Batch memory batch = multi_distributor.batchApprovals(_claimList[i]);
            uint256 bal = IERC20(_inputs[i].path[0]).balanceOf(address(this));
            if (bal > 0) {
                IERC20(_inputs[i].path[0]).approve(address(camelot_router), bal);
                camelot_router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    bal,
                    _inputs[i].minOut,
                    _inputs[i].path,
                    address(this),
                    address(this),
                    block.timestamp
                );
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice  Sell the contract's balance of specified tokens via Camelot
     * @param   _inputs     Array of SwapInput structs
     */
    function lyra_dump(SwapInput[] memory _inputs) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        inputGuard_lyra_dump(_inputs);

        for (uint256 i; i < _inputs.length; ) {
            uint256 bal = IERC20(_inputs[i].path[0]).balanceOf(address(this));
            if (bal > 0) {
                IERC20(_inputs[i].path[0]).approve(address(camelot_router), bal);
                camelot_router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    bal,
                    _inputs[i].minOut,
                    _inputs[i].path,
                    address(this),
                    address(this),
                    block.timestamp
                );
            }
            unchecked {
                ++i;
            }
        }
    }

    // ---------- Hooks ----------

    // solhint-disable no-empty-blocks

    /**
     * @notice  Validates inputs for lyra_claimRewards
     * @param   _claimList   List of batchIds to claim
     */
    function inputGuard_lyra_claimRewards(uint[] memory _claimList) internal virtual {}

    /**
     * @notice  Validates inputs for lyra_claimAndDump
     * @param   _claimList   List of batchIds to claim
     * @param   _inputs     Array of SwapInput structs
     */
    function inputGuard_lyra_claimAndDump(uint[] memory _claimList, SwapInput[] memory _inputs) internal virtual {}

    /**
     * @notice  Sell the contract's balance of specified tokens via Camelot
     * @param   _inputs     Array of SwapInput structs
     */
    function inputGuard_lyra_dump(SwapInput[] memory _inputs) internal virtual {}

    // solhint-enable no-empty-blocks
}
