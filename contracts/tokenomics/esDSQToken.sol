// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title   esDSQ ERC20 Token
 * @dev     Only whitelisted addresses can transfer, transferFrom, burn or burnFrom during restrictedTransfer
 * @author  HessianX
 * @custom:developer BowTiedOriole
 */
contract esDSQToken is ERC20, ERC20Burnable, AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ----- Events -----

    event NewRestrictedTransfer(bool newValue);
    event NewWhitelistAddress(address _address, bool _permanent);
    event RemovedWhitelistAddress(address _address);

    // ----- State Variables -----

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 250000 ether;

    /// @notice Total amount of esDSQ minted
    uint256 public totalMinted;

    /// @notice Whether transfers are restricted
    bool public restrictedTransfer = true;

    /// @notice Set of whitelisted addresses
    EnumerableSet.AddressSet private whitelist;

    /// @notice Set of permanently whitelisted addresses
    EnumerableSet.AddressSet private permanentWhitelist;

    // ----- Modifiers -----

    modifier whitelistedIfRestricted() {
        if (restrictedTransfer) require(whitelist.contains(msg.sender), "esDSQToken: !whitelisted");
        _;
    }

    // ----- Construction -----

    /**
     * @notice  Grants creator the DEFAULT_ADMIN_ROLE and MINTER_ROLE
     * @param   _name     Token name
     * @param   _symbol   Token symbol
     */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // ----- State Changing -----

    /**
     * @notice  Mints tokens to address. Only callable by MINTER_ROLE
     * @param   _to     Address to mint tokens to
     * @param   _amount Amount of tokens to mint to address
     */
    function mint(address _to, uint256 _amount) external onlyRole(MINTER_ROLE) {
        require(totalMinted + _amount <= MAX_SUPPLY, "esDSQToken: Max supply reached");
        totalMinted += _amount;
        _mint(_to, _amount);
    }

    // ----- Overrides -----

    /// @dev    See EIP-20
    function transfer(address to, uint256 amount) public override whitelistedIfRestricted returns (bool) {
        return ERC20.transfer(to, amount);
    }

    /// @dev    See EIP-20
    function transferFrom(address from, address to, uint256 amount) public override whitelistedIfRestricted returns (bool) {
        return ERC20.transferFrom(from, to, amount);
    }

    /// @dev    See ERC20Burnable
    function burn(uint256 amount) public override whitelistedIfRestricted {
        ERC20Burnable.burn(amount);
    }

    /// @dev    See ERC20Burnable
    function burnFrom(address account, uint256 amount) public override whitelistedIfRestricted {
        ERC20Burnable.burnFrom(account, amount);
    }

    // ----- Views -----

    /**
     * @notice  Check the whitelist status of an address
     * @param   _address Address to check whitelist status
     * @return  Address whitelist status
     * @return  Address permanent whitelist status
     */
    function getWhitelistStatus(address _address) external view returns (bool, bool) {
        return (whitelist.contains(_address), permanentWhitelist.contains(_address));
    }

    /**
     * @notice  Gets all whitelisted addresses
     * @dev     If whitelist becomes too big, function could run out of gas
     * @return  Array of all whitelisted addresses
     */
    function getWhitelistedAddresses() external view returns (address[] memory) {
        return whitelist.values();
    }

    /**
     * @notice  Gets all permanently whitelisted addresses
     * @dev     If whitelist becomes too big, function could run out of gas
     * @return  Array of all permanently whitelisted addresses
     */
    function getPermanentWhitelistedAddresses() external view returns (address[] memory) {
        return permanentWhitelist.values();
    }

    // ----- Admin Functions -----

    /**
     * @notice  Set a new restrictedTransfer value
     * @param   _restrictedTransfer New restrictedTransfer value
     */
    function setRestrictedTransfer(bool _restrictedTransfer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit NewRestrictedTransfer(_restrictedTransfer);
        restrictedTransfer = _restrictedTransfer;
    }

    /**
     * @notice  Add a new address to the whitelist set
     * @param   _address    New address to add to the whitelist set
     * @param   _permanent  Boolean whether address is permanent
     */
    function addWhitelistAddress(address _address, bool _permanent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addWhitelistAddress(_address, _permanent);
    }

    /**
     * @notice  Add new addresses to the whitelist set
     * @param   _addresses      New addresses to add to the whitelist set
     * @param   _permanents     Booleans whether address is permanent
     */
    function addWhitelistAddresses(address[] calldata _addresses, bool[] calldata _permanents) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_addresses.length == _permanents.length, "esDSQToken: Length mismatch");
        for (uint256 i; i < _addresses.length; ) {
            _addWhitelistAddress(_addresses[i], _permanents[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _addWhitelistAddress(address _address, bool _permanent) internal {
        whitelist.add(_address);
        if (_permanent) permanentWhitelist.add(_address);
        emit NewWhitelistAddress(_address, _permanent);
    }

    /**
     * @notice  Remove an address from the whitelist set
     * @param   _address    Address to remove from the whitelist set
     */
    function removeWhitelistAddress(address _address) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _removeWhitelistAddress(_address);
    }

    /**
     * @notice  Remove addresses from the whitelist set
     * @param   _addresses  Addresses to remove from the whitelist set
     */
    function removeWhitelistAddresses(address[] calldata _addresses) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i; i < _addresses.length; ) {
            _removeWhitelistAddress(_addresses[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _removeWhitelistAddress(address _address) internal {
        require(!permanentWhitelist.contains(_address), "esDSQToken: Address is permanently whitelisted");
        whitelist.remove(_address);
        emit RemovedWhitelistAddress(_address);
    }
}
