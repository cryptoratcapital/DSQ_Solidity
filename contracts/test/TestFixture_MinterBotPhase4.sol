pragma solidity ^0.8.13;

interface TestTokenSalePhase4 {
    function purchaseWhitelist(bytes32[] calldata _proof) external payable returns (uint256);

    function purchasePublic() external payable returns (uint256);
}

contract TestFixture_MinterBotPhase4 {
    function purchaseWhitelist(bytes32[] calldata _proof, address _target) external payable returns (uint256) {
        return TestTokenSalePhase4(_target).purchaseWhitelist{ value: msg.value }(_proof);
    }

    function purchasePublic(address _target) external payable returns (uint256) {
        return TestTokenSalePhase4(_target).purchasePublic{ value: msg.value }();
    }
}
