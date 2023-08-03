// SPDX-License-Identifier: AGPL

pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title   Transfer Helper
 * @notice  Faciliate batch transfers of DSQ from multisig
 * @author  HessianX
 * @custom:developer BowTiedPickle
 */
contract TransferHelper is Ownable {
    /**
     * @param   _owner  Contract owner
     */
    constructor(address _owner) {
        _transferOwnership(_owner);
    }

    /**
     * @notice  Transfer multiple ERC-20 tokens to multiple recipients
     * @param   _tokens         Token contract addresses
     * @param   _addresses      Reciever addresses
     * @param   _amounts        Amounts in base unit of the corresponding token
     */
    function batchTransfer(address[] calldata _tokens, address[] calldata _addresses, uint256[] calldata _amounts) external onlyOwner {
        require(_tokens.length == _addresses.length && _tokens.length == _amounts.length, "Length");
        for (uint256 i; i < _tokens.length; ) {
            IERC20(_tokens[i]).transferFrom(msg.sender, _addresses[i], _amounts[i]);
            unchecked {
                ++i;
            }
        }
    }
}
