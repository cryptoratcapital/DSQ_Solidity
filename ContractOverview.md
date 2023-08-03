# DSquared Smart Contract Overview

## Contracts

The contracts can be roughly divided into several sections.

The Sales and Vesting unit consists of single-purpose contracts faciliating the private sale, public sale, and team and presale investor vesting.

The Tokenomics unit consists of the ERC-20 DSQ token, the restricted-transfer ERC-20 esDSQ token, and the staking infrastructure to support the DSQ/esDSQ tokenomics.

The Core unit consists of the Vault and Strategy contracts which make up the protocol's core.

## Tokenomics Unit

### DSQToken.sol

Mintable/burnable ERC-20 token with cap on cumulative amount which can be minted. 500,000 token maximum supply, 18 decimals.

### esDSQToken.sol

Mintable/burnable ERC-20 token with cap on cumulative amount which can be minted. 250,000 token maximum supply, 18 decimals. This token can be placed into restricted transfer mode. Only whitelisted addresses can `transfer`, `transferFrom`, `burn` or `burnFrom` during restricted transfer. Addresses may be whitelisted in a revocable or permanent fashion, to prevent griefing.

### Router.sol

The Router is the entry point for DSQ and esDSQ staking. It is responsible for calling the two contracts in the correct order to ensure that esDSQ vesting pauses if DSQ staking drops below the required amount. It also provides convenience functions and emergency withdraw functions. The Router and the DSQStaking and esDSQStaking contracts form an immutable triad. The contracts can have deposits paused to deprecate them, but withdrawals cannot be paused.

### DSQStaking.sol

Token staking rewards contract, based directly on the Synthetix model. The contract has been modified to move pausable functionality to the Router, and to support use by the Router.

The contract takes a staking token (DSQ) and a reward token (esDSQ). Users stake the staking token and receive the reward token. The rewards drip at a constant rate, and are divided proportionately among stakers based on their share of the staked token balance. Reward campaigns may be added or extended at any time.

### esDSQStaking.sol

Users may deposit esDSQ into this contract to vest it. To continue vesting, they must maintain a balance of staked DSQ in `DSQStaking` >= their balance of esDSQ in `esDSQStaking`. esDSQStaking is prompted by the router via `notify` whenever a balance changing action takes place on the DSQStaking contract. If the balance requirement is ever not satisfied, vesting pauses. When the DSQ balance is increased to an appropriate level, vesting resumes.

A vested esDSQ position can be claimed once its vesting period has elapsed. This burns the esDSQ and sends DSQ to the recipient. If more esDSQ is added to a vesting position, the new vesting position parameters (vesting period and token reward) are calculated as the token-weighted average of the existing and incoming positions.

### StakingRewards.sol

Token staking rewards contract, based directly on the Synthetix model. This can be used to provide DSQ rewards to DSQ/X liquidity providers. Deployment of this contract is not planned at this time as its use case has been superceded by Camelot Nitro pools.

The contract takes a staking token (the LP token) and a reward token (DSQ). Users stake the staking token and receive the reward token. The rewards drip at a constant rate, and are divided proportionately among stakers based on their share of the staked token balance. Reward campaigns may be added or extended at any time.

### NFTStaking.sol

NFT staking rewards contract, based directly on the Synthetix model. This will be used to provide DSQ rewards to DopexNFT stakers. Deployment of this contract is on hold as its business case may be deprecated.

The contract takes staking NFTs from one of two collections: the DopexNFT Genesis and DopexNFT regular collections. It also takes a reward token (DSQ). Users stake the NFTs and receive the reward token. The rewards drip at a constant rate, and are divided proportionately among stakers based on their weighted share of the NFTs staked. Weight depends on rarity of the NFTs, and which collection they are from. Reward campaigns may be added or extended at any time.

## Core Unit

### VaultV0.sol and VaultV1.sol

An ERC-4626 single staking vault which runs in epochs. The epoch consists of the funding phase and the trading phase. During the funding phase users may deposit ERC-20 assets into the vault, or withdraw their balance. During the trading phase, withdrawals and deposits are blocked. Funds may then be taken into custody by a trader address.

At present this trading address is a multisig, but the Vault is agnostic to the properties of the trader. The trader will execute strategies, attempting to earn yields. By the end of the epoch, the trader returns the custodied funds, ending the epoch. Users may then withdraw funds freely. Deposits are still blocked until the next funding window. The contract owner may start an epoch at any time as long as no previous epoch is ongoing, and either the funds are returned or were never taken into custody.

`VaultV0.sol` contains a simple address mapping whitelist. Only whitelisted addresses may deposit or withdraw from the contract. `VaultV1.sol` does not contain this whitelist.

## Sales and Vesting Unit

### PrivateContribution.sol

The private contribution contract is a Merkle tree whitelisted receipt contract. Whitelisted users may deposit ETH into the contract. The contract logs each deposit, and the total deposits made by each user. The contract owner may then withdraw the funds. This contract is used for legal reasons to maintain a veil between investors and the DSquared protocol.

### TokenSale.sol

ETH-denominated fair sale contract for the DSQ token. The timestamps for the start and end times of the sale, and the amount of DSQ receieved per ETH contributed, are set once and cannot be altered once set. There is no per-user contribution cap.

The sale is conducted in three tiers based on amount of ETH contributed. There is a total cap on the amount of ETH for each tier, and purchases which exceed the remaining in a tier will spill into the next tier. A purchase which purchases the final tokens in tier three, and whose notional quantity exceeds the total amount remaining, will be refunded their excess amount.

After conclusion of the public phase users can claim their owed tokens based on the tier of their purchase. Tier 1 unlocks immediately. Tier 2 unlocks after 30 days. Tier 3 unlocks after 60 days. After 90 days, the admin will be able to retrieve any leftover tokens from the contract. At this time, the admin can also push a user's owed tokens to their account.

### TokenSalePhase4.sol

ETH-denominated fair sale contract for the DSQ token. The timestamps for the start and end times of the sale, and the amount of DSQ receieved per ETH contributed, are set once and cannot be altered once set. The sale is conducted in a whitelisted phase with per-user contribution cap, and a public phase with no per-user contribution cap. Tokens purchased unlock after 90 days. After 120 days, the admin will be able to retrieve any leftover tokens from the contract. At this time, the admin can also push a user's owed tokens to their account.

### Vesting Contracts

There are three different classes of vesting contract currently in use by DSquared.

**ContributorVesting** contracts are lump sum unlock.

**TeamVesting** contracts have a linear vesting schedule designed to start in the future.

**TeamVestingRevocable** contracts have a linear vesting schedule designed to start in the future. Between the accumulation start date and the vesting start date, tokens earn internally on a linear schedule. At any time during this period, the multisig has the ability to revoke unearned tokens. The remaining earned tokens will become available according to the unlock schedule.

All three types have the ability to "OTC" which sends 20% of the vesting tokens to the multisig address. This feature is available after the halfway point in the vesting schedule for `ContributorVesting` contracts, and at the halfway point between accumulation start and vesting start for `TeamVesting` contracts. This is designed to faciliate optional early OTC liquidity for vesting beneficiaries.
