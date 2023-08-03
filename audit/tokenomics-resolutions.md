# Tokenomics Audit Response

The Tokenomics contracts were audited by Paladin Blockchain Security at commit `9ec491b4`. Response to their findings is as follows:

## DSQStaking

### Issue 01

Implemented the recommended change.

### Issue 02

Implemented the recommended change.

### Issue 03

Acknowledged. We understand that no token with multiple entry points is to be used in this contract as either `stakingToken` or `rewardToken`, and have no plans to use such a token.

### Issue 04

Implemented the recommended change.

### Issue 05

Acknowledged. We understand that no fee-on-transfer token is to be used in these contracts, as either `stakingToken` or `rewardToken`, and have no plans to use such a token.

### Issue 06

Implemented the recommended change.

### Issue 07

**7.1:** Implemented the recommended change.

**7.2:** Implemented the recommended change.

**7.3:** A `_router == address(0)` input validation is not necessary, as `router == address(0)` is used as an implicit check for whether the router has been initialized. Should it accidentally be set with the zero address, it will remain in its uninitialized state and can be initialized a second time with the correct value. No change made.

### Issue 08

Acknowledged. This behavior will be documented in the operations manual.

### Issue 09

Implemented the recommended change.

### Issue 10

**10.1:** Implemented the recommended change.

**10.2:** Implemented the recommended change.

## DSQToken

### Issue 11

We confirm that `burn` and `burnFrom` are desired functionality and will retain this feature.

## esDSQToken

### Issue 12

This griefing risk vector was identified by the team, and is the reason the permanent whitelist feature was implemented. We confirm the understanding that `router`, `DSQStaking`, `ESDSQStaking`, LP pools, routers, and other such contracts have to be permanently whitelisted, and this is documented in our tokenomics deployment procedure.

### Issue 13

Implemented the recommended change.

### Issue 14

Implemented the recommended change.

### Issue 15

Implemented the recommended change.

## NFTStaking

### Issue 16

Implemented the recommended change. Added accounting for the token weight at the time of staking, and using that instead of the present weighted value when decrementing user balance and `_totalSupply`.

### Issue 17

Implemented the recommended change.

### Issue 18

Implemented the recommended change.

### Issue 19

Implemented the recommended change.

### Issue 20

We confirm that the maximum token ID for genesis NFT is 32, and maximum token ID is 2190 for regular NFT. This can be verified by inspection of the [Genesis contract](https://arbiscan.io/address/0xab5dd930f38bb2323ddf5239042b82c09a7f1777#code) and [Regular contract](https://arbiscan.io/address/0x6c5f8a0288fefe767a361144b76e0a41beda51b4) on Arbiscan.

### Issue 21

Implemented the recommended change.

### Issue 22

Implemented the recommended change.

### Issue 23

Implemented the recommended change.

### Issue 24

Acknowledged. This behavior will be documented in the operations manual.

### Issue 25

Implemented the recommended change.

### Issue 26

No changes made.

## Router

### Issue 27

Implemented the recommended change.

### Issue 28

After internal discussion, the team has elected to not add pausing to reward claiming. We are pursuing a design philosophy that is trustless where possible, and we feel that the benefits of being able to respond in the event a bug is uncovered are outweighed by the centralization risk of being able to block user rewards. No change made.

## StakingRewards

### Issue 29

Implemented the recommended change.

### Issue 30

Implemented the recommended change.

### Issue 31

Acknowledged. We understand that no fee-on-transfer token is to be used in these contracts, as either `stakingToken` or `rewardToken`, and have no plans to use such a token.

### Issue 32

Implemented the recommended change.

### Issue 33

Acknowledged. We understand that no token with multiple entry points is to be used in this contract as either `stakingToken` or `rewardToken`, and have no plans to use such a token.

### Issue 34

Implemented the recommended change.

### Issue 35

Acknowledged. This behavior will be documented in the operations manual.

### Issue 36

Implemented the recommended change.

## esDSQStaking

### Issue 37

Positions have been separated into two classes: regular, and admin. Admin positions are not subject to pausing via `notify` and not subject to DSQ staking balance requirements when staking esDSQ. Staking now explicitly allocates to either the admin or the regular position. Each address may have up to one of each type of tranche, both types blend using the same token-weighted pattern as before.

### Issue 38

Setting this argument as uint128 was intentional as a griefing protection measure. If the `_rate` argument of `setRewardRate` is allowed to be `uint256`, the admin can set the `rewardRate` to `type(uint256).max` and cause overflow which will block staking into existing positions. `type(uint128).max` was judged to be an overflow-safe maximum cap on the reward rate. If Paladin has a recommendation for a more idiomatic guard pattern, we will consider that for implementation.

### Issue 39

**39.1:** Implemented the recommended change.

**39.2:** A `_router == address(0)` input validation is not necessary, as `router == address(0)` is used as an implicit check for whether the router has been initialized. Should it accidentally be set with the zero address, it will remain in its uninitialized state and can be initialized a second time with the correct value. No change made.

### Issue 40

Implemented the recommended change.
