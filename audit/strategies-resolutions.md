# Strategies Audit Response

The protocol was audited by Paladin Blockchain Security on commit `xxx`. The repository has been migrated since then, and git history has been lost. The resolution process has been undertaken starting from commit `835b2f17b2afb6015011b1576174b373415bae18` of `theMLtrader/DSQ_Solidity` repo, which is believed to be identical to the audited commit.

## Global Issues

1. Governance should be under a multi-signature wallet with known or
   doxxed signatories

Acknowledged. The trust model of the DSquared project requires a reputable, trustworthy executor, and all reasonable efforts will be taken to ensure that `EXECUTOR_ROLE` holders are well-vetted and properly incentivized. Admin roles will be held by multisignature wallets.

2. Several tokens might get locked

Acknowledge the need to carefully validate that all reward tokens, LP tokens, etc. are correctly configured in the protocol.

3. Potential storage collision

Implemented the suggested change according to the pattern of EIP-1967.

4. Architectural risk for missing approvals

Acknowledged. Post-deploy scripts will be developed.

5. Extra safeguards for NATIVE/NON-NATIVE functions

This finding is disputed.

The recommendation suggests requiring `msg.value == 0` for functions which are not intended to receive value. Internal testing was unable to replicate an instance where a nonpayable function could be delegatecalled with `msg.value`. The compiler also disallows use of `msg.value` inside nonpayable facet functions. We suggest that the indicated vulnerability is not possible.

6. Implementations can be directly called

Implementation (aka. "facet") contracts are intended for delegate call only. The protocol has elected not to add protections preventing users from calling the contracts directly for gas efficiency reasons. Language has been added to the natspec of each implementation warning users against direct interaction.

7. Lack of validation for `_facet`

Implemented the suggested change. TEST PENDING

8. tx.origin usage by projects

Acknowledged.

## Base/VaultV1

9. Architectural risk: Potential miscalculation of shares —
   totalDeposit denomination

Acknowledged. As noted, this issue is deeply intertwined in the protocol architecture.

10. Governance risk

Acknowledged. These risks are inherent in the architecture, and plain-language risk disclosure will be provided to users.

11. Malicious users can manipulate share calculation

TODO: Pending testing by Oriole TEST PENDING

Implemented the recommended change to use OpenZeppelin virtual shares pattern. This was done by migrating to the OpenZeppelin ERC-4626 implementation instead of Solmate.

12. Malicious user can DoS deposits of other users

Acknowledged. The protocol has elected not to add per-user deposit limits or other such features.

13. maxDeposits can be circumvented

Acknowledged. Maximum deposit limits are for risk management purposes, not accounting. Should such a deposit-based bypass take place it would not be critical.

14. Reliance on underlying validations

This is a global recommendation, not related to VaultV1. Acknowledged. Post-deploy scripts will be developed.

15. Frontend phishing risk

Acknowledged. A bespoke frontend monitoring tool has been developed to provide additional protection to the frontend.

16. Typographical issues

Implemented the suggested change.

## Base/TraderV0

17. Governance can steal tokens

Acknowledged.

18. Governance can keep the funds hostage

Acknowledged.

19. High `managementFeeRate`/long custody time can DoS the return of
    funds

Implemented the recommended change.

20. Fees might flow into profit

TODO: Revisit this to make sure there are no DOS paths (potential issue with mistaken/partial withdraw + fee miscalculation leading to DOS and locked funds)

Implemented the recommended change to block custody unless fees have been withdrawn.

21. Lack of validation

Implemented the recommended change to validate the fee receiver. The recommendation to validate the maximum fee vs. a hardcoded limit was not implemented, as the fee structure may vary between strategy mandates. Post-deployment validation will be developed to ensure that the maximums are appropriately set.

22. Typographical issue

Implemented the recommended change.

23. `getAllowedTokens` and `getAllowedSpenders` can run out of gas

Acknowledged. Considering a case where multiple protocols are integrated, each protocol requiring addition of multiple LP/receipt tokens, as well as a mandate which includes many tokens, we arrive at a realistic worst-case basis on the order of ~300 addresses in `allowedTokens`. Enumerating this is within the gas limit.

## Strategies/StrategyETH

24. Camelot V3 is not cut

Implemented the recommended change.

25. Rysk module is implemented

Implemented the recommended change. While this strategy is ultimately intended to provide investment into Rysk, the module is not production ready nor available for audit due to anticipated Rysk protocol upgrades. It has been removed from the strategy to prevent accidental inclusion into a production environment.

26. Lack of validation for `_admin`

Acknowledged. The `DEFAULT_ADMIN_ROLE` is only to be granted to a multisignature wallet. Zero address validation for `_admin` has also been added to the `StrategyDiamond.sol` contract.

## Strategies/StrategyGLP

27. Camelot V3 is not cut

TODO: Escalate - V3 has LP functions, this strategy does not have Camelot LP in its mandates. Will have to change the module or the mandate.

Implemented the recommended change.

28. Rysk module is implemented

Implemented the recommended change. While this strategy is intended to provide investment into Rysk, the module is not available for audit due to anticipated Rysk protocol upgrades. It has been removed to prevent accidental inclusion into a production environment.

29. Lack of validation for `_admin`

Acknowledged. The `DEFAULT_ADMIN_ROLE` is only to be granted to a multisignature wallet. Zero address validation for `_admin` has also been added to the `StrategyDiamond.sol` contract.

30. Typgraphical issues

Implemented the recommended changes.

## Strategies/StrategyGM

31. Lack of validation for `_admin`

Acknowledged. The `DEFAULT_ADMIN_ROLE` is only to be granted to a multisignature wallet. Zero address validation for `_admin` has also been added to the `StrategyDiamond.sol` contract.

32. Typgraphical issues

Implemented the recommended changes.

## Strategies/StrategyARB

While the issues are not numbered, the report references that the issues from `StrategyETH` are all valid here. Each issue listed therein has been mitigated in the same manner for this contract.

## Solidstate/DiamondReadable

33. Facets might run out of gas

Acknowledged.

## Solidstate/AccessControl

34. `setRoleAdmin` functionality is missing

Acknowledged. The protocol confirms that tiered role systems will not be used, only the default admin role. Exposing `_setroleAdmin` is not required.

## StrategyDiamond

35. `DiamondFallback` cannot be set or used

Implemented the recommendation to remove the `DiamondFallback` functionality.

36. Missing function selectors

Removed the calls to cut inherited selectors as recommended.

37. `EXECUTOR_ROLE` can be set during contract deployment

Implemented the recommended changes.

38. `IAccessControl` interface is not supported

Implemented the recommended changes.

## DSQ Module/DSQ_Rescue_Module

39. `EXECUTOR_ROLE` can execute arbitrary calls

Acknowledged. This module is designed only for use during soft-launch conditions, with whitelisted vaults and/or extremely low TVL caps, as a last-resort hedge against unforseen errors in integration with other protocols. It is NOT intended for production environments and users should use extreme caution if it is present in a strategy being advertisted as production-ready.

## Aave_Lending_Module

40. `EXECUTOR_ROLE` can force liquidation

Aave V3 employs two levels: LTV and Liquidation Threshold. A user of that protocol cannot borrow and then instantly be liquidated, although they are allowed to make risky borrows up to 100% of their LTV. Implemented the recommendation to impose a hardcap as a fraction of Aave's max LTV to give a safety margin.

41. Allowed tokens can become an issue if bad-debt occurs

Acknowledged.

42. Typographical issue

Implemented the recommended changes.

## Camelot_LP_Module

43. Liquidity can be added to malicious pools

Acknowledged. The protocol confirms the need to explicitly validate that a suitable pool exists for all permutation pairs of tokens in the mandate.

## Camelot_NFTPool_Module

44. Positions cannot be created outside of epoch

Acknowledge. The protocol confirms understanding that we are preventing the creation of new liquidity positions after an epoch has ended.

## Camelot_NitroPool_Module

45. Reward token might get locked

Acknowledged. The protocol confirms understanding that this module is not self-sufficient and must be deployed alongside another which is capable of handling all reward tokens.

## Camelot_Storage_Module

46. Missing safeguard for a Nitro pool within the manageNitroPools
    function

Implemented the recommended changes.

47. Missing safeguard for `address(0)`

Implemented the recommended changes.

## Camelot_Swap_Module

48. A malicious EXECUTOR can steal tokens

The DSquared protocol is aware of the vulnerability to a malicious executor using a personal address as a counterparty to extract value. This is acknowledged as an intractable architectural problem due to the inclusion of non-atomic options trades in most strategies.

Implemented the recommendation to use `address(this)` as referrer.

49. Limited swap path can create various issues

Acknowledged. The protocol has elected to enforce that all tokens in the swap path are in the mandate to avoid a malicious executor routing a swap through a honeypot of any sort. A separate storage pattern for allowed intermediate tokens as recommended could be used to allow more flexibility, but has been deemed unnecessary at this time.

## Camelot_V3_Module

50. Configurational risks

Changed the governance function to manage executor and receiver addresses to `DEFAULT_ADMIN_ROLE` permission instead of `EXECUTOR_ROLE` given the sensitivity of these parameters.

51. Flexibility in ticks allows the theft of reserves

Acknowledged.

52. Missing logic for entering Algebra’s farming

Camelot team has confirmed that they do not use the Algebra farming system, and instead use their own [spNFT system](https://docs.camelot.exchange/protocol/staked-positions-spnfts). This finding is disputed.

From Camelot's Myrddin:

> hey @BowTiedPickle we aren't using at all the farming system from Algebra
> currently we're using our spnft rewards layer for integrated ALMs with their receipt token
> and we're working with Merkl to integrate their solution as well

53. Unused SafeERC20 import

Implemented the recommended changes.

## GMX_GLP_Module

54. Compounded funds will be locked forever

For auditor's reference: the various `RewardTracker` contracts daisy-chain into each other, with the receipt token of one being used as staking token for the other.

Example of a user [unstaking](https://arbiscan.io/tx/0x3ef811790e9b53560673042a14f6091251575f5ef6f2a79ce2a232a72b5354ad) and [staking](https://arbiscan.io/tx/0x96d5903c11f6e87337b5202f7258279b2e35e6cf2571c03d5698d730fc97ae46) show the multiple transfers of these tokens.

You can see this in `RewardRouterV2.sol::397-404` here: https://vscode.blockscan.com/arbitrum-one/0xa906f338cb21815cbc4bc87ace9e68c87ef8d8f1

```solidity
    function _unstakeGmx(address _account, address _token, uint256 _amount, bool _shouldReduceBnGmx) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        uint256 balance = IRewardTracker(stakedGmxTracker).stakedAmounts(_account);

        IRewardTracker(feeGmxTracker).unstakeForAccount(_account, bonusGmxTracker, _amount, _account);
        IRewardTracker(bonusGmxTracker).unstakeForAccount(_account, stakedGmxTracker, _amount, _account);
        IRewardTracker(stakedGmxTracker).unstakeForAccount(_account, _token, _amount, _account);
```

As such, the direct thrust of the issue, namely lacking a way to interact with the RewardTracker contracts, is not strictly correct.

It is true that the contract lacks an entry point to unstake GMX or esGMX from the GMX reward router contract. This was initially not set up as the configuration of GMX's reward system will not cause such rewards to be accrued.

There are two reward routers within the GMX system: The GLP reward router at arb1:0xB95DB5B167D75e6d04227CfFFA61069348d271F5, and the GMX reward router at arb1:0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1.

The two contracts have roughly identical code, being slight variants of the RewardRouterV2 contract, but the majority of the tokens in the GLP reward router are not configured (set to address 0). This means that all the reward handling functions in this contract will revert. It is exclusively used to stake and unstake GLP.

The GMX reward router is not a handler in the GLP manager contract (arb1:0x45096e7aA921f27590f8F19e457794EB09678141), so it cannot stake or unstake GLP. The GLP reward router is a handler in the GLP manager contract, allowing it to stake GLP.

The GMX reward router is a handler for Fee GLP and Staked Fee GLP contracts, allowing it to claim rewards from those reward trackers.

The fsGLP contract (arb1:0x1addd80e6039594ee970e5872d247bf0414c8903) is configured to reward esGMX. The reward rate is currently 0. Although this could be changed by the GMX protocol, it has been 0 for 150+ days. [source: esGMX distributor](https://arbiscan.io/address/0x60519b48ec4183a61ca2b8e37869e675fd203b34). The fGLP contract is configured to reward WETH, and is actively rewarding.

Functions `gmx_unstakeGmx` and `gmx_unstakeEsGmx` have been implemented per the recommendation, to guard against the case where such reward positions are created through `compound` or `handleRewards`, although we do not expect them to be used in practice as the configuration of the GMX reward system will not result in accumulating GMX or esGMX positions. There are no entry points to stake GMX or esGMX as those actions are not in the strategy mandate.

Test pending

55. `gmx_mintAndStakeGlpETH` is payable

Implemented the recommended changes.

56. Underlying risk: isDepositToken can be set to false

Acknowledged. The protocol confirms the need to monitor the integrated GMX contracts for any issue on this front.

57. Unnecessary `inputGuards`

No change made. The design convention mandates `Base`-type contracts always declare an empty input guard, wherever inputs are present, and `Module`-type contracts may choose to override the input guard, or not.

## GMX_OrderBook_Module

58. Privileged address has full control of funds

Acknowledged. The recommendation to enforce a cap on `_executionFee` has been partially implemented by way of no longer allowing the `_executionFee` to access strategy funds. The executor may specify any execution fee they wish, but it must be passed as `msg.value`.

59. ExecutionFee is refunded to the proxy

Implemented the recommended change. The refunded execution fee will go to the caller of the cancellation function, regardless of who created the order. This introduces a vector for executors to steal execution fees from each other by immediately canceling each other's orders, but the protocol deems this acceptable given the trust model of the protocol.

60. Not validating that `_minOut` is not 0 could enable maximum
    slippage on the order

Acknowledged. A check like `_minOut > 0` could be circumvented by `_minOut = 1` or some other extremely low value. The alternative would be to use an oracle or other USD-denominating value check, or a hardcoded slippage value. The protocol has elected not to pursue these paths.

61. Missing warning in the `init_GMX_orderBook` NatSpec

This finding is disputed. The router address and order book address are immutable in the facet. If the `init_GMX_OrderBook` function was added to the selectors (with the correct facet address), all that could be done would be to again call `approvePlugin` with the correct hardcoded parameters. No harm would thus result.

The recommendation to add a natspec warning against adding the function to selectors has been implemented anyway, for good luck.

62. Necessary approvals

Acknowledged.

## GMX_PositionRouter_Module

63. Privileged address has full control of funds

Acknowledged. The recommendation to enforce a cap on `_executionFee` has been partially implemented by way of no longer allowing the `_executionFee` to access strategy funds. The executor may specify any execution fee they wish, but it must be passed as `msg.value`.

64. Cancellation allows for arbitrary `executionFee` receiver

Removed the ability for the strategy to pay for its own execution fees, fees must now be paid by the executor. Fee recipients do not have to be `msg.sender`, but must have an executor or admin role. This eliminates the value leak path described in the issue.

65. Missing warning in the `init_GMX_positionRouter` NatSpec

This finding is disputed. The router address and position router address are immutable in the facet. If the `init_GMX_PositionRouter` function was added to the selectors (with the correct facet address), all that could be done would be to again call `approvePlugin` with the correct hardcoded parameters. No harm would thus result.

The recommendation to add a natspec warning against adding the function to selectors has been implemented anyway, for good luck.

## GMX_Swap_Router

66. Not validating that `_minOut` is not 0 could enable maximum
    slippage on the order

Acknowledged. A check like `_minOut > 0` could be circumvented by `_minOut = 1` or some other extremely low value. The alternative would be to use an oracle or other USD-denominating value check, or a hardcoded slippage value. The protocol has elected not to pursue these paths.

67. Critical necessary approvals

Acknowledged.

## 1Inch_LimitOrder_Module

68. High possibility of filling a malicious or wrong order

Acknowledged.

69. Missing decimal comparison

Implemented the recommended changes. Moved validation from `base` to `module` to match codebase design philosophy.

70. Critical necessary approvals

Acknowledged.

## 1Inch_Swap_Module

71. Arbitrary swap data can be abused

Acknowledged.

72. Flawed token validation

Implemented the recommended changes.

## Lyra_LP_Module

73. Potential malfunction of Lyra

Acknowledged.

## Lyra_Options_Module

74. Potential risky operations

Acknowledged.

75. Unused IERC20 import

Implemented the recommended changes.

76. Referrer can be an arbitrary address

Acknowledged.

## Lyra_Rewards_Module

77. Hardcoded swap path might not be the most optimal/liquid one

TODO: Test fully TEST PENDING
TODO: Fix interface issue

Implemented the recommended changes.

78. No flexibility for token claims

TODO: Test fully

Implemented the recommended changes.

79. Lack of referrer setting

TODO: Test fully

Implemented the recommended changes.

80. Lack of validation

TODO: Test fully

Implemented the recommended changes.

81. Enhanced flexibility on the swap router

Acknowledged.

## Lyra_Storage_Module

82. Missing safeguards when adding Lyra components

TODO: Test fully TEST PENDING

Implemented the recommended change to verify that `quoteAsset` and `baseAsset` are in `allowedTokens`. Implemented the recommended change to remove USDC hardcoded address and store the quote asset of each lyra pool.

## TraderJoe_LP_Module

83. Flexibility in bin ids allows theft of reserves

Acknowledged.

84. Any liquidity deposit to the active id may experience losses if they
    do not follow the active composition

Acknowledged. The protocol has elected to retain the ability to add at non-composition ratios in the contract, but checks will be added to the frontend executor interface.

## TraderJoe_Swap_Module

85. Governance can swap over their own liquidity

Acknowledged.

86. Limited swap path can create various issues

Acknowledged. See issue 49.
