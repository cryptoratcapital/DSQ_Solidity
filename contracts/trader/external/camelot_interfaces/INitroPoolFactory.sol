pragma solidity ^0.8.13;

interface INitroPoolFactory {
    function getNftPoolPublishedNitroPool(address nftPoolAddress, uint256 index) external view returns (address);
}
