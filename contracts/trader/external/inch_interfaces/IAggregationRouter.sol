// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IAggregationExecutor.sol";
import "./OrderLib.sol";
import "../clipper_interfaces/IClipperExchangeInterface.sol";

interface IAggregationRouter {
    event OrderFilled(address indexed maker, bytes32 orderHash, uint256 remaining);

    error UnknownOrder();
    error AccessDenied();
    error AlreadyFilled();
    error PermitLengthTooLow();
    error ZeroTargetIsForbidden();
    error RemainingAmountIsZero();
    error PrivateOrder();
    error BadSignature();
    error ReentrancyDetected();
    error PredicateIsNotTrue();
    error OnlyOneAmountShouldBeZero();
    error TakingAmountTooHigh();
    error MakingAmountTooLow();
    error SwapWithZeroAmount();
    error TransferFromMakerToTakerFailed();
    error TransferFromTakerToMakerFailed();
    error WrongAmount();
    error WrongGetter();
    error GetAmountCallFailed();
    error TakingAmountIncreased();
    error SimulationResults(bool success, bytes res);
    event OrderCanceled(address indexed maker, bytes32 orderHash, uint256 remainingRaw);

    enum DynamicField {
        MakerAssetData,
        TakerAssetData,
        GetMakingAmount,
        GetTakingAmount,
        Predicate,
        Permit,
        PreInteraction,
        PostInteraction
    }

    function swap(
        IAggregationExecutor executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);

    function uniswapV3Swap(uint256 amount, uint256 minReturn, uint256[] calldata pools) external payable returns (uint256 returnAmount);

    function unoswap(
        IERC20 srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external payable returns (uint256 returnAmount);

    function clipperSwap(
        IClipperExchangeInterface clipperExchange,
        IERC20 srcToken,
        IERC20 dstToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 goodUntil,
        bytes32 r,
        bytes32 vs
    ) external payable returns (uint256 returnAmount);

    function fillOrder(
        OrderLib.Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external payable returns (uint256 actualMakingAmount, uint256 actualTakingAmount, bytes32 orderHash);

    function cancelOrder(OrderLib.Order calldata order) external returns (uint256 orderRemaining, bytes32 orderHash);

    function hashOrder(OrderLib.Order calldata order) external view returns (bytes32);

    function remaining(bytes32 orderHash) external view returns (uint256 amount);
}
