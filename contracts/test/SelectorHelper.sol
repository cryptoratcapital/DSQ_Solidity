pragma solidity ^0.8.13;

import "../trader/modules/lyra/lp/ILyra_LP_Module.sol";
import "../trader/modules/lyra/options/ILyra_Options_Module.sol";
import "../trader/modules/lyra/storage/ILyra_Storage_Module.sol";

import "../trader/modules/traderjoe/legacy_lp/ITraderJoe_Legacy_LP_Module.sol";
import "../trader/modules/traderjoe/lp/ITraderJoe_LP_Module.sol";
import "../trader/modules/traderjoe/swap/ITraderJoe_Swap_Module.sol";

import "../trader/modules/inch/limitorder/IInch_LimitOrder_Module.sol";
import "../trader/modules/inch/swap/IInch_Swap_Module.sol";

import "hardhat/console.sol";

contract SelectorHelper {
    // solhint-disable no-console
    function lyraSelectors() external view {
        console.log("\n");
        console.log("lyra_initiateDeposit ");
        console.logBytes4(ILyra_LP_Module.lyra_initiateDeposit.selector);
        console.log("lyra_initiateWithdraw ");
        console.logBytes4(ILyra_LP_Module.lyra_initiateWithdraw.selector);

        console.log("\n");
        console.log("lyra_openPosition ");
        console.logBytes4(ILyra_Options_Module.lyra_openPosition.selector);
        console.log("lyra_addCollateral ");
        console.logBytes4(ILyra_Options_Module.lyra_addCollateral.selector);
        console.log("lyra_closePosition ");
        console.logBytes4(ILyra_Options_Module.lyra_closePosition.selector);
        console.log("lyra_forceClosePosition ");
        console.logBytes4(ILyra_Options_Module.lyra_forceClosePosition.selector);

        console.log("\n");
        console.log("addLyraMarket ");
        console.logBytes4(ILyra_Storage_Module.addLyraMarket.selector);
        console.log("getAllowedLyraMarkets ");
        console.logBytes4(ILyra_Storage_Module.getAllowedLyraMarkets.selector);
        console.log("getAllowedLyraPools ");
        console.logBytes4(ILyra_Storage_Module.getAllowedLyraPools.selector);
    }

    function traderJoeSelectors() external view {
        console.log("\n");
        console.log("traderjoe_legacy_addLiquidity ");
        console.logBytes4(ITraderJoe_Legacy_LP_Module.traderjoe_legacy_addLiquidity.selector);
        console.log("traderjoe_legacy_addLiquidityAVAX ");
        console.logBytes4(ITraderJoe_Legacy_LP_Module.traderjoe_legacy_addLiquidityAVAX.selector);
        console.log("traderjoe_legacy_removeLiquidity ");
        console.logBytes4(ITraderJoe_Legacy_LP_Module.traderjoe_legacy_removeLiquidity.selector);
        console.log("traderjoe_legacy_removeLiquidityAVAX ");
        console.logBytes4(ITraderJoe_Legacy_LP_Module.traderjoe_legacy_removeLiquidityAVAX.selector);
        console.log("traderjoe_legacy_setApprovalForAll ");
        console.logBytes4(ITraderJoe_Legacy_LP_Module.traderjoe_legacy_setApprovalForAll.selector);

        console.log("\n");
        console.log("traderjoe_addLiquidity ");
        console.logBytes4(ITraderJoe_LP_Module.traderjoe_addLiquidity.selector);
        console.log("traderjoe_addLiquidityNATIVE ");
        console.logBytes4(ITraderJoe_LP_Module.traderjoe_addLiquidityNATIVE.selector);
        console.log("traderjoe_removeLiquidity ");
        console.logBytes4(ITraderJoe_LP_Module.traderjoe_removeLiquidity.selector);
        console.log("traderjoe_removeLiquidityNATIVE ");
        console.logBytes4(ITraderJoe_LP_Module.traderjoe_removeLiquidityNATIVE.selector);
        console.log("traderjoe_approveForAll ");
        console.logBytes4(ITraderJoe_LP_Module.traderjoe_approveForAll.selector);

        console.log("\n");
        console.log("traderjoe_swapExactTokensForTokens ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapExactTokensForTokens.selector);
        console.log("traderjoe_swapExactTokensForNATIVE ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapExactTokensForNATIVE.selector);
        console.log("traderjoe_swapExactNATIVEForTokens ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapExactNATIVEForTokens.selector);
        console.log("traderjoe_swapTokensForExactTokens ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapTokensForExactTokens.selector);
        console.log("traderjoe_swapTokensForExactNATIVE ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapTokensForExactNATIVE.selector);
        console.log("traderjoe_swapNATIVEForExactTokens ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapNATIVEForExactTokens.selector);
        console.log("traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapExactTokensForTokensSupportingFeeOnTransferTokens.selector);
        console.log("traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapExactTokensForNATIVESupportingFeeOnTransferTokens.selector);
        console.log("traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens ");
        console.logBytes4(ITraderJoe_Swap_Module.traderjoe_swapExactNATIVEForTokensSupportingFeeOnTransferTokens.selector);
    }

    function inchSelectors() external view {
        console.log("\n");
        console.log("inch_fillOrder ");
        console.logBytes4(IInch_LimitOrder_Module.inch_fillOrder.selector);
        console.log("inch_cancelOrder ");
        console.logBytes4(IInch_LimitOrder_Module.inch_cancelOrder.selector);
        console.log("inch_addOrder ");
        console.logBytes4(IInch_LimitOrder_Module.inch_addOrder.selector);
        console.log("inch_removeOrder ");
        console.logBytes4(IInch_LimitOrder_Module.inch_removeOrder.selector);
        console.log("isValidSignature ");
        console.logBytes4(IInch_LimitOrder_Module.isValidSignature.selector);

        console.log("\n");
        console.log("inch_swap ");
        console.logBytes4(IInch_Swap_Module.inch_swap.selector);
        console.log("inch_uniswapV3Swap ");
        console.logBytes4(IInch_Swap_Module.inch_uniswapV3Swap.selector);
        console.log("inch_clipperSwap ");
        console.logBytes4(IInch_Swap_Module.inch_clipperSwap.selector);
    }

    // solhint-enable no-console
}
