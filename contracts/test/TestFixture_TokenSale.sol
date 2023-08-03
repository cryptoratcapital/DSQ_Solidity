// SPDX-License-Identifier: AGPL

pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TestFixture_TokenSale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event SaleStarted(
        bytes32 merkleRoot,
        uint256 tokensPerWeiWhitelist,
        uint256 tokensPerWeiPublic,
        uint128 startTime,
        uint128 whitelistSaleEnd,
        uint128 publicSaleEnd
    );

    event WhitelistPurchase(address indexed purchaser, uint256 quantity, uint256 amountPaid);
    event PublicPurchase(address indexed purchaser, uint256 quantity, uint256 amountPaid);
    event Refund(address indexed beneficiary, uint256 quantity);
    event Claim(address indexed purchaser, uint256 quantity);

    event Withdrawal(uint256 amount);
    event Retrieve(uint256 amount);

    event NewMerkleRoot(bytes32 newRoot);

    IERC20 public immutable DSQ;

    bytes32 public merkleRoot;

    uint128 public startTime;
    uint128 public whitelistSaleEnd;
    uint128 public publicSaleEnd;
    uint128 public constant CLAIM_PERIOD = 30 days;

    uint256 tokensPerWeiWhitelisted;
    uint256 tokensPerWeiPublic;

    uint256 public constant MAX_RAISE = 1000 ether;
    // Only changing MAX_CONTRIBUTION_PER_WHITELIST to test whitelist refund
    uint256 public constant MAX_CONTRIBUTION_PER_WHITELIST = 1500 ether;

    mapping(address => uint256) public contributed;
    mapping(address => uint256) public pending;

    uint256 public totalContribution;

    // ----- Construction and Initialization -----

    /**
     * @param _DSQ  DSQ Token address
     */
    constructor(IERC20 _DSQ) {
        require(address(_DSQ) != address(0), "zeroAddr");
        DSQ = _DSQ;
    }

    /**
     * @notice Start the token sale process
     * @dev Make sure the contract is funded before _publicEnd or people won't be able to claim
     * @param _merkleRoot               Whitelist merkle root
     * @param _tokensPerWeiWhitelisted  Wei of DSQ to mint per wei of Ether contributed during whitelist phase
     * @param _tokensPerWeiPublic       Wei of DSQ to mint per wei of Ether contributed during public phase
     * @param _startTime                Whitelist sale phase start timestamp in Unix epoch seconds
     * @param _whitelistEnd             Whitelist sale phase end timestamp in Unix epoch seconds
     * @param _publicEnd                Public sale phase end timestamp in Unix epoch seconds
     */
    function startSale(
        bytes32 _merkleRoot,
        uint256 _tokensPerWeiWhitelisted,
        uint256 _tokensPerWeiPublic,
        uint128 _startTime,
        uint128 _whitelistEnd,
        uint128 _publicEnd
    ) external onlyOwner {
        require(startTime == 0, "Started");
        require(_publicEnd > _whitelistEnd && _whitelistEnd > _startTime && _startTime > block.timestamp, "Dates");

        merkleRoot = _merkleRoot;
        tokensPerWeiWhitelisted = _tokensPerWeiWhitelisted;
        tokensPerWeiPublic = _tokensPerWeiPublic;

        startTime = _startTime;
        whitelistSaleEnd = _whitelistEnd;
        publicSaleEnd = _publicEnd;

        emit SaleStarted(_merkleRoot, _tokensPerWeiWhitelisted, _tokensPerWeiPublic, _startTime, _whitelistEnd, _publicEnd);
    }

    // ----- Public Functions -----

    /**
     * @notice Purchase tokens during the whitelist sale
     * @dev Will purchase the desired amount OR all the remaining tokens if there are less than _amount left in the sale.
     *      Will refund any excess value transferred in the above case.
     * @param   _proof    Merkle proof of whitelist
     * @return            Actual amount of tokens purchased
     */
    function purchaseWhitelist(bytes32[] calldata _proof) external payable nonReentrant returns (uint256) {
        require(block.timestamp < whitelistSaleEnd, "WL Over");
        require(block.timestamp > startTime && startTime > 0, "NotStarted");
        require(msg.value > 0, "Amount");
        require(contributed[msg.sender] + msg.value <= MAX_CONTRIBUTION_PER_WHITELIST, "WalletMax");
        require(totalContribution < MAX_RAISE, "SaleMax");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(_proof, merkleRoot, leaf), "Proof");

        uint256 purchaseWeiAmount = (totalContribution + msg.value > MAX_RAISE) ? MAX_RAISE - totalContribution : msg.value;
        uint256 tokensToPurchase = purchaseWeiAmount * tokensPerWeiWhitelisted;

        totalContribution += purchaseWeiAmount;
        contributed[msg.sender] += purchaseWeiAmount;

        pending[msg.sender] += tokensToPurchase;

        uint256 refund = msg.value - purchaseWeiAmount;
        if (refund > 0) {
            payable(msg.sender).transfer(refund);
            emit Refund(msg.sender, refund);
        }

        emit WhitelistPurchase(msg.sender, tokensToPurchase, purchaseWeiAmount);
        return tokensToPurchase;
    }

    /**
     * @notice Purchase tokens during the public sale
     * @dev Will purchase the desired amount OR all the remaining tokens if there are less than _amount left in the sale.
     *      Will refund any excess value transferred in the above case.
     * @return Actual amount of tokens purchased
     */
    function purchasePublic() external payable nonReentrant returns (uint256) {
        require(block.timestamp > whitelistSaleEnd && block.timestamp < publicSaleEnd, "Phase");
        require(msg.value > 0, "Amount");
        require(totalContribution < MAX_RAISE, "SaleMax");

        uint256 purchaseWeiAmount = (totalContribution + msg.value > MAX_RAISE) ? MAX_RAISE - totalContribution : msg.value;
        uint256 tokensToPurchase = purchaseWeiAmount * tokensPerWeiPublic;

        totalContribution += purchaseWeiAmount;
        contributed[msg.sender] += purchaseWeiAmount;

        pending[msg.sender] += tokensToPurchase;

        uint256 refund = msg.value - purchaseWeiAmount;

        if (refund > 0) {
            payable(msg.sender).transfer(refund);
            emit Refund(msg.sender, refund);
        }

        emit PublicPurchase(msg.sender, tokensToPurchase, purchaseWeiAmount);
        return tokensToPurchase;
    }

    /**
     * @notice Claim tokens purchased during the sale phases
     * @return The amount of tokens claimed
     */
    function claim() external nonReentrant returns (uint256) {
        require(block.timestamp > publicSaleEnd && publicSaleEnd > 0, "Phase");

        uint256 pendingTokens = pending[msg.sender];
        require(pendingTokens > 0, "NoPending");

        pending[msg.sender] = 0;
        DSQ.safeTransfer(msg.sender, pendingTokens);
        emit Claim(msg.sender, pendingTokens);

        return pendingTokens;
    }

    // ----- Admin Functions -----

    /**
     * @notice Set a new Merkle root for the whitelist phase
     * @param _newRoot New Merkle root
     */
    function setMerkleRoot(bytes32 _newRoot) external onlyOwner {
        merkleRoot = _newRoot;
        emit NewMerkleRoot(_newRoot);
    }

    /**
     * @notice Withdraw sale profits to the owner
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
        emit Withdrawal(balance);
    }

    /**
     * @notice Retrieve the remaining sale tokens
     */
    function retrieve() external onlyOwner {
        require(block.timestamp > publicSaleEnd + CLAIM_PERIOD, "Ongoing");
        uint256 balance = DSQ.balanceOf(address(this));
        DSQ.safeTransfer(msg.sender, balance);
        emit Retrieve(balance);
    }

    /**
     * @notice Push tokens to a user
     * @param _users    Users to claim for
     */
    function claimFor(address[] calldata _users) external onlyOwner {
        require(block.timestamp > publicSaleEnd + CLAIM_PERIOD, "Ongoing");

        uint256 len = _users.length;
        for (uint256 i; i < len; ) {
            uint256 balance = pending[_users[i]];
            if (balance > 0) {
                pending[_users[i]] = 0;
                DSQ.safeTransfer(_users[i], balance);
                emit Claim(_users[i], balance);
            }

            unchecked {
                ++i;
            }
        }
    }
}
