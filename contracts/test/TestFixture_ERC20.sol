// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract TestFixture_ERC20 is ERC20PresetMinterPauser {
    uint8 public tokenDecimals = 18;

    constructor(string memory _name, string memory _symbol) ERC20PresetMinterPauser(_name, _symbol) {}

    function decimals() public view virtual override returns (uint8) {
        return tokenDecimals;
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }

    function mintTo(address _to, uint256 amount) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC20PresetMinterPauser: must have minter role to mint");
        _mint(_to, amount);
    }

    function setTokenDecimals(uint8 _newDecimals) external {
        tokenDecimals = _newDecimals;
    }
}
