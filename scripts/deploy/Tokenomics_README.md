# Tokenomics Deployment README

## PreReqs

DSQ and esDSQ tokens must already be deployed prior to deploying tokenomics.

## Tokenomics

Here is a general overview of the process to deploy DSQ tokenomics.

- Deploy DSQStaking w/ Multisig, Treasury, esDSQ, and DSQ addresses
- Deploy esDSQStaking w/ Multisig, DSQ, esDSQ, and DSQStaking addresses
- Deploy Router w/ Multisig, DSQ, esDSQ, DSQStaking, and esDSQStaking addresses
- Set router for DSQStaking & esDSQStaking
- Add esDSQStaking, DSQStaking, & Router to esDSQ permanent whitelist
- Fund DSQStaking with esDSQ and start reward campaign
- Fund esDSQStaking with DSQ prior to first position fully vesting.

### Deploy DSQStaking

The first step is to deploy DSQStaking. Here are the constructor arguments.
`(address _owner, address _rewardsDistribution, address _rewardsToken, address _stakingToken)`

### Deploy esDSQStaking

Once DSQStaking is deployed, you can deploy esDSQStaking. Here are the constructor arguments, all of which are immutable.
`(address _owner, address _dsq, address _esdsq, address _dsqStaking)`

### Deploy Router

With DSQStaking and esDSQStaking deployed, the Router can be deployed. Here are the constructor arguments, all of which are immutable.
`(
        address _owner,
        address _dsq,
        address _esdsq,
        address _dsqStaking,
        address _esdsqStaking
    )`

### Set Router address on DSQStaking & esDSQStaking

Once the router is deployed, the router address needs to be set for DSQStaking and esDSQStaking. The router address can only be set once, and a sample call is below.

    ```
    await dsqStaking.connect(multisig).setRouter(router.address);
    await esdsqStaking.connect(multisig).setRouter(router.address);
    ```

### Add DSQStaking, esDSQStaking, and Router to permanent esDSQ whitelist

esDSQ token is automatically set to restrict transfers upon deployment. The staking contracts and router will need to be added to the permanent whitelist. Sample calls are provided below. It is important that these addresses are added to the permanent whitelist to avoid griefing attacks.

    ```
    await esdsq.connect(multisig).addWhitelistAddress(dsqStaking.address, true);
    await esdsq.connect(multisig).addWhitelistAddress(esdsqStaking.address, true);
    await esdsq.connect(multisig).addWhitelistAddress(router.address, true);
    ```

### DSQStaking needs to be funded with esDSQ and reward campaign started

In order for stakers to receive rewards, DSQStaking needs to have an esDSQ balance and a reward campaign needs to be started. Sample calls are provided below.

    ```
    await esdsq.connect(multisig).mint(dsqStaking.address, esdsqInitialSupply);
    await dsqStaking.connect(multisig).notifyRewardAmount(esdsqInitialSupply);
    ```

### Fund esDSQStaking with DSQ

In order for users to claim rewards from esDSQStaking, the contract will need to be funded with DSQ. The minimum vesting duration is 365 days, so the contract must be funded prior to the first position fully vesting. Sample calls are provided below.

    ```
    await dsq.connect(treasury).transfer(esdsqStaking.address, ethers.utils.parseEther("100"));
    ```
