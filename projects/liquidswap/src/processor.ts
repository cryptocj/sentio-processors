import { liquidity_pool } from './types/aptos/liquidswap'
import { AccountEventTracker, aptos, Counter, Gauge } from "@sentio/sdk";
import { caculateValueInUsd, delay, getCoinInfo, scaleDown, whiteListed } from "./utils";
import { coin } from "@sentio/sdk/lib/builtin/aptos/0x1";
import { getRpcClient } from "@sentio/sdk/lib/aptos";
import { AptosClient } from "aptos-sdk";

import * as crypto from "crypto"
import { BigDecimal } from "@sentio/sdk/lib/core/big-decimal";

const commonOptions = { sparse:  true }
const valueByPool = new Gauge("value_by_pool", commonOptions)
const valueByCoin = new Gauge("value_by_coin", commonOptions)
const amountCounter = new Gauge("amount", commonOptions)
const volumeGauge = new Gauge("vol", commonOptions)
const volumeByBridge = new Gauge("vol_by_bridge", commonOptions)

// const eventCounter = new Counter("num_event", commonOptions)

// const accountTracker = AccountEventTracker.register("trading")

liquidity_pool.bind({startVersion: 29999})
  .onEventPoolCreatedEvent(async (evt, ctx) => {
    ctx.meter.Counter("num_pools").add(1)
    await syncPools(ctx)
  })
  .onEventLiquidityAddedEvent(async (evt, ctx) => {
    ctx.meter.Counter("event_liquidity_add").add(1)
    await syncPools(ctx)
  })
  .onEventLiquidityRemovedEvent(async (evt, ctx) => {
    ctx.meter.Counter("event_liquidity_removed").add(1)
    await syncPools(ctx)
  })
  .onEventSwapEvent(async (evt, ctx) => {
    const pool = await getPoolName(evt.type_arguments)
    await recordTradingVolume(ctx, evt.type_arguments[0], evt.type_arguments[1], evt.data_typed.x_in, evt.data_typed.y_in, pool)

    const coinXInfo = await getCoinInfo(evt.type_arguments[0])
    const coinYInfo = await getCoinInfo(evt.type_arguments[1])
    ctx.meter.Counter("event_swap_total").add(1)
    ctx.meter.Counter("event_swap_by_bridge").add(1, { bridge: coinXInfo.bridge })
    ctx.meter.Counter("event_swap_by_bridge").add(1, { bridge: coinYInfo.bridge })

    await syncPools(ctx)
  })
  .onEventFlashloanEvent(async (evt, ctx) => {
    const pool = await getPoolName(evt.type_arguments)
    await recordTradingVolume(ctx, evt.type_arguments[0], evt.type_arguments[1], evt.data_typed.x_in, evt.data_typed.y_in, pool)

    const coinXInfo = await getCoinInfo(evt.type_arguments[0])
    const coinYInfo = await getCoinInfo(evt.type_arguments[1])
    ctx.meter.Counter("event_flashloan").add(1)
    ctx.meter.Counter("event_flashloan_by_bridge").add(1, { bridge: coinXInfo.bridge })
    ctx.meter.Counter("event_flashloan_by_bridge").add(1, { bridge: coinYInfo.bridge })

    await syncPools(ctx)
  })

// async function addForVolume(ctx: aptos.AptosContext, type: string, amount: bigint, timestamp: string, pool: string, valueOverride?: BigDecimal): Promise<BigDecimal> {
//   if (!whiteListed(type)) {
//     if (valueOverride) {
//       const coin = await getCoinInfo(type)
//       volumeGauge.record(ctx, value, {coin: coin.symbol, pool: pool})
//       return valueOverride
//     }
//   }
//   const coin = await getCoinInfo(type)
//   const value = await caculateValueInUsd(amount, coin, timestamp)
//   volumeGauge.record(ctx, value, {coin: coin.symbol, pool: pool})
//   return value
// }

async function recordTradingVolume(ctx: aptos.AptosContext, coinx: string, coiny: string, coinx_amount: bigint, coiny_amount: bigint, poolName: string) {
  // const coinx = pool.type_arguments[0]
  // const coiny = pool.type_arguments[1]

  const whitelistx = whiteListed(coinx)
  const whitelisty = whiteListed(coiny)
  if (!whitelistx && !whitelisty) {
    return
  }

  const timestamp = ctx.transaction.timestamp
  const coinXInfo = await getCoinInfo(coinx)
  const coinYInfo = await getCoinInfo(coiny)

  if (whitelistx) {
    const value = await caculateValueInUsd(coinx_amount, coinXInfo, timestamp)
    volumeGauge.record(ctx, value, {coin: coinXInfo.symbol, pool: poolName})
    volumeByBridge.record(ctx, value, {coin: coinXInfo.symbol, bridge: coinXInfo.bridge})
    // if (coinXInfo.bridge)

    if (!whitelisty) {
      volumeGauge.record(ctx, value, {coin: coinYInfo.symbol, pool: poolName})
    }
  }
  if (whitelisty) {
    const value = await caculateValueInUsd(coiny_amount, coinYInfo, timestamp)
    volumeGauge.record(ctx, value, {coin: coinYInfo.symbol, pool: poolName})
    volumeByBridge.record(ctx, value, {coin: coinYInfo.symbol, bridge: coinXInfo.bridge})

    if (!whitelistx) {
      volumeGauge.record(ctx, value, {coin: coinXInfo.symbol, pool: poolName})
    }
  }

}

// async function addFor(ctx: aptos.AptosContext, type: string, amount: bigint, timestamp: string, pool: string) {
//   const coin = await getCoinInfo(type)
//   if (coin) {
//     const value = await caculateValueInUsd(amount, coin, timestamp)
//     valueCounter.record(ctx, value, {coin: coin.symbol, pool: pool})
//     amountCounter.record(ctx, scaleDown(amount, coin.decimals), {coin: coin.symbol, pool: pool})
//   }
// }

// async function subFor(ctx: aptos.AptosContext, type: string, amount: bigint, timestamp: string, pool: string) {
//   const coin = await getCoinInfo(type)
//   const value = await caculateValueInUsd(amount, coin, timestamp)
//   valueCounter.sub(ctx, value, { coin: coin.symbol, pool: pool })
//   amountCounter.sub(ctx, scaleDown(amount, coin.decimals), { coin: coin.symbol, pool: pool })
// }

// TODO pool name should consider not just use symbol name
async function getPoolName(coins: [string, string, string]): Promise<string> {
  const coinx = await getCoinInfo(coins[0])
  const coiny = await getCoinInfo(coins[1])
  // if (!coinx || !coiny) {
  //   return undefined
  // }
  const token = coins[2].includes("curves::Stable") ? "S" : "U"
  // const xfullname = coins[0].split("::").slice(1).join("::")
  // const yfullname = coins[1].split("::").slice(1).join("::")
  const id = crypto.createHash("md5").update(coins.join()).digest("hex")
  return `${coinx.symbol}-${coiny.symbol}-${token}-${id.slice(0, 6)}`
   // return [coinx, coiny, pool]
}

const recorded = new Set<bigint>()

async function syncPools(ctx: aptos.AptosContext) {
  const version = BigInt(ctx.version.toString())
  const bucket = version / 100000n;
  if (recorded.has(bucket)) {
    return
  }
  recorded.add(bucket)

  // const client = getRpcClient(aptos.AptosNetwork.MAIN_NET)
  // const client = new AptosClient("https://mainnet.aptoslabs.com/")
  const client = new AptosClient("https://aptos-mainnet.nodereal.io/v1/0c58c879d41e4eab8fd2fc0406848c2b")
  //
  let resources = undefined
  while (!resources) {
    try {
      resources = await client.getAccountResources('0x5a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948', {ledgerVersion: version})
    } catch (e) {
      console.log("rpc error, retrying", e)
      await delay(1000)
    }
  }

  const pools = aptos.TYPE_REGISTRY.filterAndDecodeResources<liquidity_pool.LiquidityPool<any, any, any>>("0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::liquidity_pool::LiquidityPool", resources)
  const volumeByCoin = new Map<string, BigDecimal>()

  console.log("num of pools: ", pools.length)
  for (const pool of pools) {
    const coinx = pool.type_arguments[0]
    const coiny = pool.type_arguments[1]
    const whitelistx = whiteListed(coinx)
    const whitelisty = whiteListed(coiny)
    if (!whitelistx && !whitelisty) {
      continue
    }

    const coinXInfo = await getCoinInfo(coinx)
    const coinYInfo = await getCoinInfo(coiny)
    const timestamp = ctx.transaction.timestamp

    const coinx_amount = pool.data_typed.coin_x_reserve.value
    const coiny_amount = pool.data_typed.coin_y_reserve.value

    const poolName = await getPoolName(pool.type_arguments as [string,string,string])

    amountCounter.record(ctx, scaleDown(coinx_amount, coinXInfo.decimals), {coin: coinXInfo.symbol, pool: poolName})
    amountCounter.record(ctx, scaleDown(coiny_amount, coinYInfo.decimals), {coin: coinYInfo.symbol, pool: poolName})

    if (whitelistx) {
      const value = await caculateValueInUsd(coinx_amount, coinXInfo, timestamp)
      valueByPool.record(ctx, value, {coin: coinXInfo.symbol, pool: poolName})

      let coinXTotal = volumeByCoin.get(coinXInfo.type)
      if (!coinXTotal) {
        coinXTotal = value
      }
      coinXTotal = coinXTotal.plus(value)
      volumeByCoin.set(coinXInfo.type, coinXTotal)

      if (!whitelisty) {
        valueByPool.record(ctx, value, {coin: coinYInfo.symbol, pool: poolName})
      }
    }
    if (whitelisty) {
      const value = await caculateValueInUsd(coiny_amount, coinYInfo, timestamp)
      valueByPool.record(ctx, value, {coin: coinYInfo.symbol, pool: poolName})

      let coinYTotal = volumeByCoin.get(coinYInfo.type)
      if (!coinYTotal) {
        coinYTotal = value
      }
      coinYTotal = coinYTotal.plus(value)
      volumeByCoin.set(coinYInfo.type, coinYTotal)

      if (!whitelistx) {
        valueByPool.record(ctx, value, {coin: coinXInfo.symbol, pool: poolName})
      }
    }
  }

  for (const [k, v] of volumeByCoin) {
    const coinInfo = await getCoinInfo(k)

    valueByCoin.record(ctx, v, { coin: coinInfo.symbol, bridge: coinInfo.bridge })
  }
}