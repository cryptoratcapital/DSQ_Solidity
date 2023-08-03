// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract TestFixture_ERC721 is ERC721PresetMinterPauserAutoId {
    using Counters for Counters.Counter;

    string baseURI = "https://ipfs.io/ipfs/QmfBsmEtHT9CbBnDUfEw5UEdPueHG7iKizhK5SyUyVpgru/";
    Counters.Counter public _tokenIdTracker;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseUri
    ) ERC721PresetMinterPauserAutoId(_name, _symbol, _baseUri) {
        baseURI = _baseUri;
        _tokenIdTracker.increment();
    }

    function mint() public {
        _mint(msg.sender, _tokenIdTracker.current());
        _tokenIdTracker.increment();
    }

    function mintTo(address _to) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC721PresetMinterPauserAutoId: must have minter role to mint");
        _mint(_to, _tokenIdTracker.current());
        _tokenIdTracker.increment();
    }

    function mintSpecific(address _to, uint256 _tokenId) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC721PresetMinterPauserAutoId: must have minter role to mint");
        _mint(_to, _tokenId);
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        return string(abi.encodePacked(super.tokenURI(tokenId)));
    }

    function setBaseUri(string calldata _newBaseUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = _newBaseUri;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}
