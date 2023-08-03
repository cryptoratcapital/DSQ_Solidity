// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IDSQStaking.sol";
import "../interfaces/IERC20Burnable.sol";

/**
 * @title   DSquared esDSQStaking Contract
 * @notice  Users can stake esDSQ tokens and receive DSQ tokens upon vesting completion
 * @dev     All staking, unstaking, and claiming must be done through the router
 * @dev     This contract does not support transfer taxed tokens
 * @author  HessianX
 * @custom:developer BowTiedOriole
 */
contract esDSQStaking is Ownable {
    using Math for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IERC20Burnable;

    // ----- Events -----

    event NewRewardRate(uint256 oldRate, uint256 newRate);
    event NewVestingDuration(uint256 oldVestingDuration, uint256 newVestingDuration);
    event NewRouter(address oldRouter, address newRouter);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, address indexed recipient, uint256 reward);

    // ----- State Variables -----

    /// @notice Immutable contract addresses for DSQ Token, esDSQ Token, & dsqStaking contract
    IERC20 public immutable dsq;
    IERC20Burnable public immutable esdsq;
    IDSQStaking public immutable dsqStaking;

    /// @notice Address of the router
    /// @dev    All staking, unstaking, and claiming must be done through router
    address public router;

    /// @notice Amount of DSQ received for 1e18 esDSQ
    uint256 public rewardRate = 1e18;

    /// @notice Max vesting duration
    uint256 public constant maxVestingDuration = 365 days; //solhint-disable-line const-name-snakecase

    /// @notice Time for vesting to complete
    uint256 public vestingDuration = 365 days;

    /// @notice Total amount of esDSQ staked
    uint256 public totalStaked;

    /// @notice Struct for each user's vesting position
    struct VestingPosition {
        uint256 fullyVestedTime;
        uint256 positionAmount;
        uint256 positionRate;
        uint256 pausedTime;
    }

    /// @notice Address to VestingPosition. Each user can only have one position
    mapping(address => VestingPosition) public positions;

    /// @notice Address to VestingPosition. Each user can only have one admin position
    mapping(address => VestingPosition) public adminPositions;

    // ----- Modifiers -----

    modifier onlyRouter() {
        require(msg.sender == router, "esDSQStaking: !router");
        _;
    }

    // ----- Construction -----

    /**
     * @notice  Sets the addresses of DSQ token, esDSQ token, & dsqStaking contract. All are immutable
     * @param   _owner      Owner address
     * @param   _dsq        DSQ token address
     * @param   _esdsq      esDSQ token address
     * @param   _dsqStaking DSQStaking contract address
     */
    constructor(address _owner, address _dsq, address _esdsq, address _dsqStaking) {
        require(
            _owner != address(0) && _dsq != address(0) && _esdsq != address(0) && _dsqStaking != address(0),
            "esDSQStaking: Zero address"
        );
        _transferOwnership(_owner);
        dsq = IERC20(_dsq);
        esdsq = IERC20Burnable(_esdsq);
        dsqStaking = IDSQStaking(_dsqStaking);
    }

    // ----- State Changing -----

    /**
     * @notice  Stakes the given amount of esDSQ tokens into a vesting position
     * @dev     If a vesting position already exists, the new position's parameters will be the weighted average of the old and new
     * @dev     Only one vesting position of each type exists per user
     * @dev     Only callable from the router
     * @param   _account        Address of user to stake
     * @param   _amount         Amount of tokens to stake
     * @param   _adminStake     True to ignore DSQ Staking balance check
     */
    function stake(address _account, uint256 _amount, bool _adminStake) external onlyRouter {
        require(_amount > 0, "esDSQStaking: Cannot stake 0");
        VestingPosition storage position = _adminStake ? adminPositions[_account] : positions[_account];

        if (!_adminStake) {
            // solhint-disable-next-line reason-string
            require(dsqStaking.balanceOf(_account) >= _amount + position.positionAmount, "esDSQStaking: Insufficient DSQ staked");
        }

        if (position.fullyVestedTime == 0) {
            position.fullyVestedTime = block.timestamp + vestingDuration;
            position.positionAmount = _amount;
            position.positionRate = rewardRate;
        } else {
            // Use weighted average to blend positions
            uint256 _fullyVestedTime = position.fullyVestedTime;
            uint256 _positionAmount = position.positionAmount;
            require(block.timestamp < _fullyVestedTime, "esDSQStaking: Position claimable");

            uint256 newVestingDuration = (((_fullyVestedTime - block.timestamp) * _positionAmount) + (vestingDuration * _amount)).ceilDiv(
                _positionAmount + _amount
            );
            uint256 newRate = (position.positionRate * _positionAmount + rewardRate * _amount) / (_positionAmount + _amount);

            position.fullyVestedTime = block.timestamp + newVestingDuration;
            position.positionRate = newRate;
            position.positionAmount += _amount;
        }

        totalStaked += _amount;
        esdsq.safeTransferFrom(router, address(this), _amount);
        emit Staked(_account, _amount);
    }

    /**
     * @notice  If fully vested, burns the esDSQ tokens & transfers DSQ to the recipient
     * @dev     Will claim both types of vested positions
     * @param   _account    Address of user claiming rewards
     * @param   _recipient  Address to transfer rewards to
     */
    function claim(address _account, address _recipient) external onlyRouter returns (uint256) {
        VestingPosition storage position = positions[_account];
        VestingPosition storage adminPosition = adminPositions[_account];
        uint256 bal;
        uint256 reward;
        uint256 amt;
        uint256 vestedTime;

        // Claim position if vested
        amt = position.positionAmount;
        vestedTime = position.fullyVestedTime;
        if (amt != 0 && vestedTime != 0 && block.timestamp >= vestedTime && position.pausedTime == 0) {
            bal += amt;
            reward += (amt * position.positionRate) / 1e18;

            position.positionAmount = 0;
            position.fullyVestedTime = 0;
            position.positionRate = 0;
        }

        // Claim admin position if vested
        amt = adminPosition.positionAmount;
        vestedTime = adminPosition.fullyVestedTime;
        if (amt != 0 && vestedTime != 0 && block.timestamp >= vestedTime) {
            bal += amt;
            reward += (amt * adminPosition.positionRate) / 1e18;

            adminPosition.positionAmount = 0;
            adminPosition.fullyVestedTime = 0;
            adminPosition.positionRate = 0;
        }

        // At least one position must be claimed
        require(reward > 0, "esDSQStaking: No valid vested position"); // solhint-disable-line reason-string

        totalStaked -= bal;

        esdsq.burn(bal);
        dsq.safeTransfer(_recipient, reward);
        emit RewardPaid(_account, _recipient, reward);
        return reward;
    }

    /**
     * @notice  Withdraws all esDSQ
     * @dev     WARNING: This resets the vesting position & forfeits any progress
     * @param   _account Address of user withdrawing
     */
    function emergencyWithdraw(address _account) external onlyRouter {
        VestingPosition storage position = positions[_account];
        VestingPosition storage adminPosition = adminPositions[_account];

        uint256 bal = position.positionAmount + adminPosition.positionAmount;
        require(bal > 0, "esDSQStaking: Insufficient balance"); // solhint-disable-line reason-string

        totalStaked -= bal;

        position.positionAmount = 0;
        position.fullyVestedTime = 0;
        position.pausedTime = 0;
        position.positionRate = 0;

        adminPosition.positionAmount = 0;
        adminPosition.fullyVestedTime = 0;
        adminPosition.positionRate = 0;

        esdsq.safeTransfer(_account, bal);
        emit Withdrawn(_account, bal);
    }

    /**
     * @notice  Checks if _account has adequate amount of DSQ staked and if not, pauses the position
     * @dev     Does not pause the admin position
     * @dev     Router calls this contract upon DSQStaking balance change
     * @param   _account    Address of user to check balance
     */
    function notify(address _account) external onlyRouter {
        VestingPosition storage position = positions[_account];
        uint256 dsqBalance = dsqStaking.balanceOf(_account);

        if (position.positionAmount > dsqBalance && position.pausedTime == 0) {
            position.pausedTime = block.timestamp;
        } else if (dsqBalance >= position.positionAmount && position.pausedTime != 0) {
            position.fullyVestedTime += (block.timestamp - position.pausedTime);
            position.pausedTime = 0;
        }
    }

    // ----- Admin Functions -----

    /**
     * @notice  Set a new exchange rate
     * @dev     Amount of DSQ received for 1e18 wei of esDSQ staked
     * @param   _rate New exchange rate
     */
    function setRewardRate(uint128 _rate) external onlyOwner {
        require(_rate != 0, "esDSQStaking: Zero rate");
        emit NewRewardRate(rewardRate, _rate);
        rewardRate = _rate;
    }

    /**
     * @notice  Set a new vesting duration
     * @param _vestingDuration New vesting duration in seconds
     */
    function setVestingDuration(uint256 _vestingDuration) external onlyOwner {
        require(_vestingDuration <= maxVestingDuration, "esDSQStaking: maxVestingDuration");
        emit NewVestingDuration(vestingDuration, _vestingDuration);
        vestingDuration = _vestingDuration;
    }

    /**
     * @notice  Sets router contract
     * @param _router Address for router contract
     */
    function setRouter(address _router) external onlyOwner {
        require(router == address(0), "esDSQStaking: Router is immutable"); // solhint-disable-line reason-string
        emit NewRouter(router, _router);
        router = _router;
    }
}
