// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";
import "@solidstate/contracts/utils/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../modules/dsq/DSQ_Trader_Storage.sol";
import "../modules/dsq/DSQ_Common_Roles.sol";
import "../../interfaces/IVault.sol";
import "./ITraderV0.sol";

/**
 * @title   DSquared Trader V0 Core
 * @notice  Interfaces with the Vault contract, handling custody, returning, and fee-taking
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract TraderV0 is ITraderV0, AccessControl, ReentrancyGuard, DSQ_Common_Roles, DSQ_Trader_Storage {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @dev Unit denominator of fee rates
    uint256 public constant FEE_DENOMINATOR = 1e18;
    /// @notice Maximum allowable performance fee as percentage of profits, in units of 1e18 = 100%
    uint256 public immutable MAX_PERFORMANCE_FEE_RATE; // solhint-disable-line var-name-mixedcase
    /// @notice Maximum allowable management fee as percentage of base assets per year, in units of 1e18 = 100%
    uint256 public immutable MAX_MANAGEMENT_FEE_RATE; // solhint-disable-line var-name-mixedcase

    // ---------- Construction and Initialization ----------

    /**
     * @param    _MAX_PERFORMANCE_FEE_RATE   Maximum performance fee as percentage of profits (100% = 1e18)
     * @param    _MAX_MANAGEMENT_FEE_RATE    Maximum management fee as percentage of assets (100% = 1e18)
     */
    // solhint-disable-next-line var-name-mixedcase
    constructor(uint256 _MAX_PERFORMANCE_FEE_RATE, uint256 _MAX_MANAGEMENT_FEE_RATE) {
        MAX_PERFORMANCE_FEE_RATE = _MAX_PERFORMANCE_FEE_RATE;
        MAX_MANAGEMENT_FEE_RATE = _MAX_MANAGEMENT_FEE_RATE;
    }

    /**
     * @notice  Initialize the trader parameters
     * @dev     Should ONLY be called through cut_TraderV0.
     *          Adding this function selector to the Diamond will result in a CRITICAL vulnerabiilty.
     * @param   _params     Initialization parameters
     */
    function initializeTraderV0(TraderV0InitializerParams calldata _params) external {
        TraderV0Storage storage s = getTraderV0Storage();
        require(!s.initialized, "TraderV0: Initializer");
        s.initialized = true;

        s.name = _params._name;
        uint256 len = _params._allowedTokens.length;
        require(len > 0, "!tokens");
        for (uint256 i; i < len; ++i) {
            s.allowedTokens.add(_params._allowedTokens[i]);
        }

        len = _params._allowedSpenders.length;
        require(len > 0, "!spenders");
        for (uint256 i; i < len; ++i) {
            s.allowedSpenders.add(_params._allowedSpenders[i]);
        }

        require(
            MAX_PERFORMANCE_FEE_RATE >= _params._initialPerformanceFeeRate && MAX_MANAGEMENT_FEE_RATE >= _params._initialManagementFeeRate,
            "!rates"
        );
        s.performanceFeeRate = _params._initialPerformanceFeeRate;
        s.managementFeeRate = _params._initialManagementFeeRate;
    }

    /**
     * @notice  Set this strategy's vault address
     * @dev     May only be set once
     * @param   _vault  Vault address
     */
    function setVault(address _vault) external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        TraderV0Storage storage s = getTraderV0Storage();
        require(_vault != address(0), "!vault");
        require(address(s.vault) == address(0), "!set");
        s.baseAsset = IERC20(IVault(_vault).asset());
        s.vault = IVault(_vault);
    }

    // ---------- Operation ----------

    /**
     * @notice  Approve a whitelisted spender to handle one of the whitelisted tokens
     * @param   _token      Token to set approval for
     * @param   _spender    Spending address
     * @param   _amount     Token amount
     */
    function approve(address _token, address _spender, uint256 _amount) external virtual onlyRole(EXECUTOR_ROLE) {
        TraderV0Storage storage s = getTraderV0Storage();
        require(s.allowedTokens.contains(_token), "!token");
        require(s.allowedSpenders.contains(_spender), "!spender");
        IERC20(_token).approve(_spender, _amount);
    }

    /**
     * @notice  Take custody of the vault's funds
     * @dev     Relies on Vault contract to revert if called out of sequence.
     */
    function custodyFunds() external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        TraderV0Storage storage s = getTraderV0Storage();
        s.custodyTime = block.timestamp;
        s.custodiedAmount = s.vault.custodyFunds();
    }

    /**
     * @notice  Return the vault's funds and take fees if enabled
     * @dev     WARNING: Unwind all positions back into the base asset before returning funds.
     * @dev     Relies on Vault contract to revert if called out of sequence.
     */
    function returnFunds() external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        TraderV0Storage storage s = getTraderV0Storage();
        uint256 balance = s.baseAsset.balanceOf(address(this));
        uint256 cachedCustodiedAmount = s.custodiedAmount;
        uint256 profit = balance > cachedCustodiedAmount ? balance - cachedCustodiedAmount : 0;
        uint256 performanceFee = (profit * s.performanceFeeRate) / FEE_DENOMINATOR;
        uint256 managementFee = (cachedCustodiedAmount * s.managementFeeRate * (block.timestamp - s.custodyTime)) /
            365 days /
            FEE_DENOMINATOR;

        // If fees exceed balance, take no fees
        if (performanceFee + managementFee > balance) {
            performanceFee = 0;
            managementFee = 0;
        }

        s.totalFees = s.totalFees + performanceFee + managementFee;
        s.custodiedAmount = 0;
        s.custodyTime = 0;

        s.baseAsset.approve(address(s.vault), balance - performanceFee - managementFee);
        s.vault.returnFunds(balance - performanceFee - managementFee);

        emit FundsReturned(cachedCustodiedAmount, balance, performanceFee, managementFee);
    }

    /**
     * @notice  Withdraw all accumulated fees
     * @dev     This should be done before the start of the next epoch to avoid fees becoming mixed with vault funds
     */
    function withdrawFees() external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        TraderV0Storage storage s = getTraderV0Storage();
        require(s.totalFees > 0, "!fees");
        uint256 amount = s.totalFees;
        s.totalFees = 0;
        s.baseAsset.safeTransfer(s.feeReceiver, amount);
        emit FeesWithdrawn(msg.sender, amount);
    }

    // --------- Configuration ----------

    /**
     * @notice  Set new performance and management fees
     * @notice  May not be set while funds are custodied
     * @param   _performanceFeeRate     New management fee (100% = 1e18)
     * @param   _managementFeeRate      New management fee (100% = 1e18)
     */
    function setFeeRates(uint256 _performanceFeeRate, uint256 _managementFeeRate) external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        TraderV0Storage storage s = getTraderV0Storage();
        require(_performanceFeeRate <= MAX_PERFORMANCE_FEE_RATE && _managementFeeRate <= MAX_MANAGEMENT_FEE_RATE, "!rates");
        require(s.custodyTime == 0, "Custodied");
        emit FeesSet(s.performanceFeeRate, _performanceFeeRate, s.managementFeeRate, _managementFeeRate);
        s.performanceFeeRate = _performanceFeeRate;
        s.managementFeeRate = _managementFeeRate;
    }

    /**
     * @notice  Set a new fee receiver address
     * @param   _feeReceiver   Address which will receive fees from the contract
     */
    function setFeeReceiver(address _feeReceiver) external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        TraderV0Storage storage s = getTraderV0Storage();
        emit FeeReceiverSet(s.feeReceiver, _feeReceiver);
        s.feeReceiver = _feeReceiver;
    }

    // --------- View Functions ---------

    /**
     * @notice  View all tokens the contract is allowed to handle
     * @return  List of token addresses
     */
    function getAllowedTokens() external view returns (address[] memory) {
        return getTraderV0Storage().allowedTokens.values();
    }

    /**
     * @notice  View all addresses which can recieve token approvals
     * @return  List of addresses
     */
    function getAllowedSpenders() external view returns (address[] memory) {
        return getTraderV0Storage().allowedSpenders.values();
    }

    // ----- State Variable Getters -----

    /// @notice Strategy name
    function name() external view returns (string memory) {
        return getTraderV0Storage().name;
    }

    /// @notice Address receiving fees
    function feeReceiver() external view returns (address) {
        return getTraderV0Storage().feeReceiver;
    }

    /// @notice Vault address
    function vault() external view returns (IVault) {
        return getTraderV0Storage().vault;
    }

    /// @notice Underlying asset of the strategy's vault
    function baseAsset() external view returns (IERC20) {
        return getTraderV0Storage().baseAsset;
    }

    /// @notice Performance fee as percentage of profits, in units of 1e18 = 100%
    function performanceFeeRate() external view returns (uint256) {
        return getTraderV0Storage().performanceFeeRate;
    }

    /// @notice Management fee as percentage of base assets, in units of 1e18 = 100%
    function managementFeeRate() external view returns (uint256) {
        return getTraderV0Storage().managementFeeRate;
    }

    /// @notice Timestamp when funds were taken into custody, in Unix epoch seconds
    function custodyTime() external view returns (uint256) {
        return getTraderV0Storage().custodyTime;
    }

    /// @notice Amount of base asset taken into custody
    function custodiedAmount() external view returns (uint256) {
        return getTraderV0Storage().custodiedAmount;
    }

    /// @notice Accumulated management and performance fees
    function totalFees() external view returns (uint256) {
        return getTraderV0Storage().totalFees;
    }

    // --------- Hooks ---------

    // solhint-disable-next-line no-empty-blocks
    receive() external payable virtual {}
}
