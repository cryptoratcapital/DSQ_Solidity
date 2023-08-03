// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IDSQStaking.sol";
import "../interfaces/IesDSQStaking.sol";

/**
 * @title   DSquared Router
 * @notice  Interface point for DSQStaking and esDSQStaking
 * @author  HessianX
 * @custom:developer BowTiedOriole
 */

contract Router is Ownable, Pausable, ReentrancyGuard {
    // ----- State Variables -----

    /// @notice Address of DSQ Token
    IERC20 public immutable dsq;

    /// @notice Address of esDSQ Token
    IERC20 public immutable esdsq;

    /// @notice Address of DSQStaking Contract
    IDSQStaking public immutable dsqStaking;

    /// @notice Address of esDSQStaking Contract
    IesDSQStaking public immutable esdsqStaking;

    // ----- Construction -----

    /**
     * @notice  Sets the addresses of DSQ token, esDSQ token, DSQStaking contract, and esDSQStaking contract. All are immutable
     * @dev     Router sets infinite approvals for staking contracts
     * @param   _owner          Owner address
     * @param   _dsq            DSQ token address
     * @param   _esdsq          esDSQ token address
     * @param   _dsqStaking     DSQStaking contract address
     * @param   _esdsqStaking   esDSQStaking contract address
     */
    constructor(address _owner, IERC20 _dsq, IERC20 _esdsq, address _dsqStaking, address _esdsqStaking) {
        require(_owner != address(0), "Router: Zero address");
        _transferOwnership(_owner);
        dsq = _dsq;
        esdsq = _esdsq;
        dsqStaking = IDSQStaking(_dsqStaking);
        esdsqStaking = IesDSQStaking(_esdsqStaking);
        dsq.approve(address(dsqStaking), type(uint256).max);
        esdsq.approve(address(esdsqStaking), type(uint256).max);
    }

    // ----- State Changing -----

    // ----- DSQStaking Calls -----

    /**
     * @notice  Stakes the given amount of DSQ tokens
     * @dev     Requires approval for router to spend user's tokens
     * @param   _amount Amount of DSQ to stake
     */
    function stakeDSQStaking(uint256 _amount) external whenNotPaused nonReentrant {
        dsq.transferFrom(msg.sender, address(this), _amount);
        dsqStaking.stake(msg.sender, _amount);
        esdsqStaking.notify(msg.sender);
    }

    /**
     * @notice  Harvests esDSQ rewards from DSQStaking
     */
    function harvestDSQStaking() external nonReentrant returns (uint256) {
        return dsqStaking.getReward(msg.sender, msg.sender);
    }

    /**
     * @notice  Withdraws the given amount of DSQ tokens
     * @dev     Will pause esDSQ vesting if DSQ amount drops below required amount
     * @param   _amount Amount of DSQ to withdraw
     */
    function withdrawDSQStaking(uint256 _amount) external nonReentrant {
        dsqStaking.withdraw(msg.sender, _amount);
        esdsqStaking.notify(msg.sender);
    }

    /**
     * @notice  Harvests esDSQ rewards from DSQStaking and withdraws all DSQ
     * @dev     Will pause vesting if user has esDSQ vesting position
     */
    function exitDSQStaking() external nonReentrant {
        dsqStaking.exit(msg.sender);
        esdsqStaking.notify(msg.sender);
    }

    /**
     * @notice  Emergency withdraw from DSQStaking
     * @dev     Does not claim rewards from DSQStaking.
     */
    function emergencyWithdrawDSQStaking() external nonReentrant {
        uint256 bal = dsqStaking.balanceOf(msg.sender);
        if (bal > 0) dsqStaking.withdraw(msg.sender, bal);
        esdsqStaking.notify(msg.sender);
    }

    // ----- esDSQStaking Calls -----

    /**
     * @notice  Stakes the given amount of esDSQ tokens
     * @dev     Requires approval for router to spend user's tokens
     * @param   _amount Amount of esDSQ to stake
     */
    function stakeESDSQStaking(uint256 _amount) external whenNotPaused nonReentrant {
        esdsq.transferFrom(msg.sender, address(this), _amount);
        esdsqStaking.stake(msg.sender, _amount, false);
    }

    /**
     * @notice  Claims DSQ rewards from esdsqStaking
     */
    function claimESDSQStaking() external nonReentrant {
        esdsqStaking.claim(msg.sender, msg.sender);
    }

    /**
     * @notice  Withdraws all esDSQ tokens from esDSQStaking
     * @dev     WARNING: This resets the vesting position & forfeits any progress
     */
    function emergencyWithdrawESDSQStaking() external nonReentrant {
        esdsqStaking.emergencyWithdraw(msg.sender);
    }

    // ----- Combined Calls -----

    /**
     * @notice  Claims DSQ rewards from esDSQStaking and stakes them in DSQStaking
     */
    function claimESDSQStakingAndStakeDSQStaking() external whenNotPaused nonReentrant {
        uint256 bal = esdsqStaking.claim(msg.sender, address(this));
        dsqStaking.stake(msg.sender, bal);
        esdsqStaking.notify(msg.sender);
    }

    /**
     * @notice  Harvests esDSQ rewards from DSQStaking and stakes in esDSQStaking
     * @dev     Will revert if claimed rewards > DSQ staked
     */
    function harvestDSQStakingAndStakeESDSQStaking() external whenNotPaused nonReentrant {
        uint256 bal = dsqStaking.getReward(msg.sender, address(this));
        if (bal > 0) esdsqStaking.stake(msg.sender, bal, false);
    }

    /**
     * @notice  Emergency withdraw from both DSQStaking and esDSQStaking
     * @dev     WARNING: This resets the vesting position & forfeits any progress
     */
    function emergencyWithdrawAll() external nonReentrant {
        uint256 bal = dsqStaking.balanceOf(msg.sender);
        if (bal > 0) dsqStaking.withdraw(msg.sender, bal);
        esdsqStaking.emergencyWithdraw(msg.sender);
    }

    // ----- Admin Functions -----

    /**
     * @notice  Stakes the given amount of esDSQ tokens on behalf of the given account
     * @dev     Requires approval for router to spend msg.sender's tokens
     * @param   _account    User to stake esDSQ on behalf of
     * @param   _amount     Amount of esDSQ to stake
     */
    function adminStakeESDSQStaking(address _account, uint256 _amount) external whenNotPaused onlyOwner nonReentrant {
        esdsq.transferFrom(msg.sender, address(this), _amount);
        esdsqStaking.stake(_account, _amount, true);
    }

    /**
     * @notice  Pauses all staking functions
     * @dev     User can still call functions to claim rewards & withdraw funds
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice  Unpauses all staking functions
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
