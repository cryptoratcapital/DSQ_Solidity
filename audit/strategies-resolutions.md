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

TODO: Review and decide

The recommendation suggests requiring `msg.value == 0` for functions which are not intended to receive value. It seems that this is not possible, as the external (intended for delegatecall) functions in the facets which are not marked as payable cannot invoke `msg.value`. Making all functions payable and then requiring `msg.value == 0` feels hacky and gross. PoC suggests that it may not be possible to send value with a payable delegatecall function.

6. Implementations can be directly called

Implementation (aka. "facet") contracts are intended for delegate call only. The protocol has elected not to add protections preventing users from calling the contracts directly for gas efficiency reasons. Language has been added to the natspec of each implementation warning users against direct interaction.

7. Lack of validation for `_facet`

Implemented the suggested change.

8. tx.origin usage by projects

Acknowledged.

## Base/VaultV1

9. Architectural risk: Potential miscalculation of shares —
   totalDeposit denomination

TODO: Review

10. Governance risk

Acknowledged. These risks are inherent in the architecture, and plain-language risk disclosure will be provided to users.

11. Malicious users can manipulate share calculation

TODO: Review, decide, implement

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

TODO: Selector tests started failing unexpectedly, resolve

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

While the issue is not numbered, the report references that the issues from `StrategyETH` are all valid here. Each issue listed therein has been mitigated in the same manner for this contract. TODO

## Solidstate/DiamondReadable

33. Facets might run out of gas

Acknowledged.

## Solidstate/AccessControl

34. `setRoleAdmin` functionality is missing

TODO: Review

## StrategyDiamond

35. `DiamondFallback` cannot be set or used

TODO: Review fallback logic

Implemented the recommendation to remove the fallback functionality.

36. Missing function selectors

TODO: Review fallback logic more fully

Implemented the recommended changes.

37. `EXECUTOR_ROLE` can be set during contract deployment

Implemented the recommended changes.

38. `IAccessControl` interface is not supported

Implemented the recommended changes.

## DSQ Module/DSQ_Rescue_Module

39. `EXECUTOR_ROLE` can execute arbitrary calls

Acknowledged. This module is designed only for use during soft-launch conditions, with whitelisted vaults and/or extremely low TVL caps, as a last-resort hedge against unforseen errors in integration with other protocols. It is NOT intended for production environments and users should use extreme caution if it is present in a strategy being advertisted as production-ready.

## Aave_Lending_Module

40. `EXECUTOR_ROLE` can force liquidation

TODO: Review

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

TODO: Review and acknowledge if nothing else can be done.

51. Flexibility in ticks allows the theft of reserves

Acknowledged.

52. Missing logic for entering Algebra’s farming

TODO

Added functionality to farm Camelot V3 positions

53. Unused SafeERC20 import

Implemented the recommended changes.

## GMX_GLP_Module

54. Compounded funds will be locked forever

TODO: check validity

Implemented the recommended changes.

55. `gmx_mintAndStakeGlpETH` is payable

Implemented the recommended changes.

56. Underlying risk: isDepositToken can be set to false

Acknowledged. The protocol confirms the need to monitor the integrated GMX contracts for any issue on this front.

57. Unnecessary `inputGuards`

No change made. Leaving these unused is per the codebase style convention which mandates `Base`-type contracts always declare an empty input guard, wherever inputs are present, and `Module`-type contracts may choose to override the input guard, or not.

## GMX_OrderBook_Module

58. Privileged address has full control of funds

TODO: Execution fee upper bound

59. ExecutionFee is refunded to the proxy

TODO: Review

60. Not validating that `_minOut` is not 0 could enable maximum
    slippage on the order

TODO: Review but probably acknowledge

61. Missing warning in the `init_GMX_orderBook` NatSpec

This finding is disputed. The router address and order book address are immutable in the facet. If the `init_GMX_OrderBook` function was added to the selectors (with the correct facet address), all that could be done would be to again call `approvePlugin` with the correct hardcoded parameters. No harm would thus result.

The recommendation to add a natspec warning against adding the function to selectors has been implemented anyway, for good luck.

62. Necessary approvals

Acknowledged.

## GMX_PositionRouter_Module

63. Privileged address has full control of funds

TODO: Execution fee upper bound

64. Cancellation allows for arbitrary `executionFee` receiver

TODO: Review

65. Missing warning in the `init_GMX_positionRouter` NatSpec

This finding is disputed. The router address and position router address are immutable in the facet. If the `init_GMX_PositionRouter` function was added to the selectors (with the correct facet address), all that could be done would be to again call `approvePlugin` with the correct hardcoded parameters. No harm would thus result.

The recommendation to add a natspec warning against adding the function to selectors has been implemented anyway, for good luck.

## GMX_Swap_Router

66. Not validating that `_minOut` is not 0 could enable maximum
    slippage on the order

TODO: Review but probably acknowledge

67. Critical necessary approvals

Acknowledged.

## 1Inch_LimitOrder_Module

68. High possibility of filling a malicious or wrong order

Acknowledged.

69. Missing decimal comparison

TODO: Review if `validateLinearOrder` also needs to be done

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

TODO: Test fully

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

TODO: Test fully

Implemented the recommended change to verify that `quoteAsset` and `baseAsset` are in `allowedTokens`. Implemented the recommended change to remove USDC hardcoded address and store the quote asset of each lyra pool.

## TraderJoe_LP_Module

83. Flexibility in bin ids allows theft of reserves

Acknowledged.

84. Any liquidity deposit to the active id may experience losses if they
    do not follow the active composition

TODO Review

## TraderJoe_Swap_Module

85. Governance can swap over their own liquidity

Acknowledged.

86. Limited swap path can create various issues

Acknowledged. See issue 49.
