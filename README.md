# DSquared

## Architecture

The core unit of DSquared is the Vault/Strategy pair. The vault handles accounting, and the strategy provides a secure framework to execute trades to earn yield for the users.

The strategies are written in a modular framework using EIP-2535 Diamonds pattern to provide flexible scalability.

## Contracts

See [ContractOverview.md](ContractOverview.md) for details on the smart contracts.

## Contributing

The repo is set up with Conventional Commits and lint-staged to enforce formatting of commit messages.

Run code linters via:

```shell
yarn lint
yarn lint:sol
yarn lint:js
```

## Testing

Testing:

```shell
npx hardhat test
```

Testing verbosely using `hardhat-tracer`:

```shell
npx hardhat test --traceError # prints calls for failed txs
npx hardhat test --fulltraceError # prints calls and storage ops for failed txs
npx hardhat test --trace # prints calls for all txs
npx hardhat test --fulltrace # prints calls and storage ops for all txs

npx hardhat test --v    # same as --traceError
npx hardhat test --vv   # same as --fulltraceError
npx hardhat test --vvv  # same as --trace
npx hardhat test --vvvv # same as --fulltrace
```

Running line coverage:

```shell
npx hardhat coverage
```

## Static Analysis

Install Docker, and pull the `eth-security-toolbox` container from Trail of Bits

```shell
docker pull trailofbits/eth-security-toolbox
```

Run the container and mount the directory, replacing `/home/share` with the working directory of the repo

```shell
docker run -it -v /home/share:/share trailofbits/eth-security-toolbox
```

In the docker container, run

```shell
cd /share
```

Then run slither using whatever parameters you desire. Examples:

```shell
slither . # Run Slither on everything
slither contracts/VaultV0.sol
```

## Deploying

Verify/modify the necessary parameters in the deployment script under `scripts/deploy`, then call:

```shell
npx hardhat run scripts/deploy/xyz.js                       # Local Hardhat network
npx hardhat run scripts/deploy/xyz.js --network arbitrum    # Arbitrum Mainnet
npx hardhat run scripts/deploy/xyz.js --network avax        # Avalanche Mainnet
npx hardhat run scripts/deploy/xyz.js --network goerli      # Goerli testnet
```

## Sample Hardhat Commands

```shell
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat run scripts/xyz.js
npx hardhat help
npx hardhat coverage
```
# DSQ_Solidity
