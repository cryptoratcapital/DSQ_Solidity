pragma solidity ^0.8.13;

interface TestTokenSale {
    function purchase() external payable returns (uint256);
}

contract TestFixture_MinterBot {
    function purchase(address _target) external payable returns (uint256) {
        return TestTokenSale(_target).purchase{ value: msg.value }();
    }
}
