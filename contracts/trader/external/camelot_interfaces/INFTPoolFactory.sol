pragma solidity ^0.8.13;

interface INFTPoolFactory {
    function getPool(address _lpToken) external view returns (address);
}
