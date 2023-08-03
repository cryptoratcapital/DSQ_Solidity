// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./Types.sol";

interface IAlphaOptionHandler {
    function executeOrder(uint256 _orderId) external;

    function executeBuyBackOrder(uint256 _orderId) external;

    function executeStrangle(uint256 _orderId1, uint256 _orderId2) external;

    function createStrangle(
        Types.OptionSeries memory _optionSeriesCall,
        Types.OptionSeries memory _optionSeriesPut,
        uint256 _amountCall,
        uint256 _amountPut,
        uint256 _priceCall,
        uint256 _pricePut,
        uint256 _orderExpiry,
        address _buyerAddress,
        uint256[2] memory _callSpotMovementRange,
        uint256[2] memory _putSpotMovementRange
    ) external returns (uint256, uint256);

    function createOrder(
        Types.OptionSeries memory _optionSeries,
        uint256 _amount,
        uint256 _price,
        uint256 _orderExpiry,
        address _buyerAddress,
        bool _isBuyBack,
        uint256[2] memory _spotMovementRange
    ) external returns (uint256);

    function orderStores(uint256 _orderId) external view returns (Types.Order memory order);

    function orderIdCounter() external view returns (uint256);

    event OrderCreated(uint256 _orderId);
    event OrderExecuted(uint256 _orderId);
}
