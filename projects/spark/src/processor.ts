import { OrderbookProcessor } from "./types/fuel/OrderbookProcessor.js";
import { FuelNetwork } from "@sentio/sdk/fuel";

OrderbookProcessor.bind({
  chainId: FuelNetwork.TEST_NET,
  // startBlock: 10977001n,
  // address: '0x7134802bdefd097f1c9d8ad86ef27081ae609b84de0afc87b58bd4e04afc6a23'
  address: '0x0f0c1065a7b82d026069c5cf070b21ee65713fd1ac92ec1d25eacc3100187f78'
})
//     .onCallMatch_orders(async (order, ctx) => {
//   const trades = order.getLogsOfTypeTradeEvent()
//   console.log("decode trades: ", trades.length)
//   for (const trade of trades) {
//     ctx.eventLogger.emit('trade', {
//       ...trade
//     })
//   }
// })
    .onLogTradeEvent(async (trade, ctx) => {
        const pool = trade.data.base_token.value
        ctx.eventLogger.emit('trade', {
          distinctId: ctx.transaction?.sender,
          ...trade
        })
    })
    .onLogMarketCreateEvent(async (order, ctx) => {
        ctx.eventLogger.emit('order', {
          distinctId: ctx.transaction?.sender,
          ...order
        })
    })
