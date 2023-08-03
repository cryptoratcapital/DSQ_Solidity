// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IVault.sol";

/**
 * @param   _name                       Strategy name
 * @param   _allowedTokens              ERC-20 tokens to include in the strategy's mandate
 * @param   _allowedSpenders            Addresses which can receive ERC-20 token approval
 * @param   _initialPerformanceFeeRate  Initial value of the performance fee, in units of 1e18 = 100%
 * @param   _initialManagementFeeRate   Initial value of the management fee, in units of 1e18 = 100%
 */
struct TraderV0InitializerParams {
    string _name;
    address[] _allowedTokens;
    address[] _allowedSpenders;
    uint256 _initialPerformanceFeeRate;
    uint256 _initialManagementFeeRate;
}

/**
 * @title   DSquared Trader V0 Core Interface
 * @notice  Interfaces with the Vault contract, handling custody, returning, and fee-taking
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ITraderV0 {
    // ---------- Construction and Initialization ----------

    function initializeTraderV0(TraderV0InitializerParams calldata _params) external;

    /**
     * @notice  Set this strategy's vault address
     * @dev     May only be set once
     * @param   _vault  Vault address
     */
    function setVault(address _vault) external;

    // ---------- Operation ----------

    /**
     * @notice  Approve a whitelisted spender to handle one of the whitelisted tokens
     * @param   _token      Token to set approval for
     * @param   _spender    Spending address
     * @param   _amount     Token amount
     */
    function approve(address _token, address _spender, uint256 _amount) external;

    /**
     * @notice  Take custody of the vault's funds
     * @dev     Relies on Vault contract to revert if called out of sequence.
     */
    function custodyFunds() external;

    /**
     * @notice  Return the vault's funds and take fees if enabled
     * @dev     WARNING: Unwind all positions back into the base asset before returning funds.
     * @dev     Relies on Vault contract to revert if called out of sequence.
     */
    function returnFunds() external;

    /**
     * @notice  Withdraw all accumulated fees
     * @dev     This should be done before the start of the next epoch to avoid fees becoming mixed with vault funds
     */
    function withdrawFees() external;

    // --------- Configuration ----------

    /**
     * @notice  Set new performance and management fees
     * @notice  May not be set while funds are custodied
     * @param   _performanceFeeRate     New management fee (100% = 1e18)
     * @param   _managementFeeRate      New management fee (100% = 1e18)
     */
    function setFeeRates(uint256 _performanceFeeRate, uint256 _managementFeeRate) external;

    /**
     * @notice  Set a new fee receiver address
     * @param   _feeReceiver   Address which will receive fees from the contract
     */
    function setFeeReceiver(address _feeReceiver) external;

    // --------- View Functions ---------

    /**
     * @notice  View all tokens the contract is allowed to handle
     * @return  List of token addresses
     */
    function getAllowedTokens() external view returns (address[] memory);

    /**
     * @notice  View all addresses which can recieve token approvals
     * @return  List of addresses
     */
    function getAllowedSpenders() external view returns (address[] memory);

    // ----- State Variable Getters -----

    /// @notice Strategy name
    function name() external view returns (string memory);

    /// @notice Address receiving fees
    function feeReceiver() external view returns (address);

    /// @notice Vault address
    function vault() external view returns (IVault);

    /// @notice Underlying asset of the strategy's vault
    function baseAsset() external view returns (IERC20);

    /// @notice Performance fee as percentage of profits, in units of 1e18 = 100%
    function performanceFeeRate() external view returns (uint256);

    /// @notice Management fee as percentage of base assets, in units of 1e18 = 100%
    function managementFeeRate() external view returns (uint256);

    /// @notice Timestamp when funds were taken into custody, in Unix epoch seconds
    function custodyTime() external view returns (uint256);

    /// @notice Amount of base asset taken into custody
    function custodiedAmount() external view returns (uint256);

    /// @notice Accumulated management and performance fees
    function totalFees() external view returns (uint256);

    /// @notice Maximum allowable performance fee as percentage of profits, in units of 1e18 = 100%
    function MAX_PERFORMANCE_FEE_RATE() external view returns (uint256);

    /// @notice Maximum allowable management fee as percentage of base assets per year, in units of 1e18 = 100%
    function MAX_MANAGEMENT_FEE_RATE() external view returns (uint256);

    // --------- Hooks ---------

    receive() external payable;

    // ----- Events -----

    event FundsReturned(uint256 startingBalance, uint256 closingBalance, uint256 performanceFee, uint256 managementFee);
    event FeesWithdrawn(address indexed withdrawer, uint256 amount);

    event FeesSet(uint256 oldPerformanceFee, uint256 newPerformanceFee, uint256 oldManagementFee, uint256 newManagementFee);
    event FeeReceiverSet(address oldFeeReceiver, address newFeeReceiver);
}
