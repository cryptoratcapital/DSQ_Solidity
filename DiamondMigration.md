# Migrating to Diamonds

To overcome issues with the strategy size, we are moving to an immutable version of the EIP-2535 Diamonds standard. This pattern extends the simple case of a transparent proxy, where `delegatecall` is used to host implementation at another contract and storage at the main proxy point. Diamonds, in a nutshell, allows mapping different function selectors to be delegated to different implementations. This lets you create contracts of effectively infinite size, and host logic across multiple implementation units - called "facets".

The primary concern with Diamonds is handling storage - a way must be provided to flexibly handle storage needs of each facet, without interfering with other facets storage needs. There are two patterns for this, AppStorage (one giant struct containing all the storage needed everywhere) and Diamond storage (each unique storage need has its own struct). We are using Diamond storage pattern.

To support the Diamond storage pattern, we are using the [Solidstate](https://github.com/solidstate-network/solidstate-solidity) implementation repo in Diamonds contracts as a stand-in for OpenZeppelin. OZ libraries which contain type primitives, interfaces, etc. can still be used. We have to use Solidstate everywhere we are inheriting a conteract which has state variables, like access control etc.

The TL;DR on Diamond storage is that every state variable has to go into a struct, that struct is summoned via a getter. You can assign it to a storage pointer and proceed from there.

Further reading:

- https://eips.ethereum.org/EIPS/eip-2535#facets-state-variables-and-diamond-storage
- https://eip2535diamonds.substack.com/p/how-storage-works-in-eip2535-diamonds
- Diamonds Discord: https://discord.gg/nJXY7cEmfJ
- https://github.com/mudgen/awesome-diamonds

## Layout

### Layout of a Diamond Strategy

The **Diamond** is the main strategy address, and the point of interaction. Prior to deploying it, **Facets** must be deployed to hold all the implementation logic. **Cutters** are used in the diamond to add modules. Each cutter is responsible for adding the facet's selectors to the diamond's mappings, and calling facet initializers if needed.

Each Strategy starts by importing the `StrategyDiamond` base diamond contract and the `TraderV0Cutter` cutter. This will provide the basic functionality of the strategy. View `TestFixture_TrivialStrategy` for an example.

Each module is added by importing its relevant Cutter and invoking the appropriate `_XXX_cut` function.

### Layout of a Module

The modules retain the basic layout as before with the **Base** and **Module** contracts. The key differences are:

- Module contract shifts from `abstract` to a deployable `contract`, this will be deployed as the facet.
- Base contract must perform any construction needed
- Module contract must invoke the base constructor if one exists, this should only set immutables as nothing else will come through when delegatecalled.
- If the module requires construction which sets a state variable or makes a call (ie. GMX router plugin adding, adding addresses to an allowed struct, etc), an initializer must be used
- The initializer should take a struct of parameters as its only argument

If any state variable storage needs are present in a module, they _MUST_ be declared in a separate contract containing the storage struct and the storage struct getter. View `DSQ_Trader_Storage` for an example of the storage struct. Facets may contain constants and immutable variables without issue, as these are baked into the bytecode.

If the storage needs to be modified, as in Lyra or Camelot where addresses can be added to the whitelist, these functions must be declared with a module and a cutter. Using the Base -> Module pattern is not necessary in this case as we are not making provisions for easy override of input guard hooks.

We also have to create an interface for each module. We are currently storing this in the same directory for convenience and clarity.

Each subunit should be contained in its own subdirectory. Ie: `../trader/modules/protocol/function1`

As such, a typical directory will look like

```
protocol
├── function1
|   ├── IProtocol_Function1_Module.sol
|   ├── Protocol_Function1_Base.sol
|   ├── Protocol_Function1_Module.sol
|   └── Procotol_Function1_Cutter.sol
├── function2
|   ├── IProtocol_Function2_Module.sol
|   ├── Protocol_Function2_Base.sol
|   ├── Protocol_Function2_Module.sol
|   └── Procotol_Function2_Cutter.sol
└── storage
    ├── IProtocol_Storage_Module.sol
    ├── Protocol_Common_Storage.sol
    ├── Protocol_Storage_Module.sol
    └── Procotol_Storage_Cutter.sol
```

### Layout of a cutter

Taking as an example the GMX Swap cutter:

```solidity
abstract contract GMX_Swap_Cutter is DiamondWritableInternal, ERC165Base {
  function cut_GMX_Swap(address _facet) internal {
    // only one internal function
    uint256 selectorIndex;
    // Register
    bytes4[] memory selectors = new bytes4[](3); // length of the static array is the amount of selectors we are adding

    selectors[selectorIndex++] = IGMX_Swap.gmx_swap.selector; // Add all the selectors
    selectors[selectorIndex++] = IGMX_Swap.gmx_swapETHToTokens.selector;
    selectors[selectorIndex++] = IGMX_Swap.gmx_swapTokensToETH.selector;

    _setSupportsInterface(type(IGMX_Swap).interfaceId, true); // Support the interface

    // Diamond cut

    FacetCut[] memory facetCuts = new FacetCut[](1); // This line will never change

    facetCuts[0] = FacetCut({ target: _facet, action: FacetCutAction.ADD, selectors: selectors }); // This line will never change

    _diamondCut(facetCuts, address(0), ""); // This line will look like this if you are not invoking an initializer
  }
}
```

Should you need to call an initializer, you will change out the last line for `_diamondCut(facetCuts, _facet_, payload);` where `payload` is the `abi.encodeWithSelector` encoded bytestring of the initializer arguments.

## Migrating a test suite

- Replace all instances of `trader` with `strategyDiamond`
- Copy in `traderInitializerParams` from another test
- Copy in the setup of the facets and strategy diamond from another test and replace the necessary facets with what you need
- Add a diamond ABI to `hardhat.config.js`
- Change all references to use the correct strategy and diamond ABI

It should run with only minimal changes from that point.
