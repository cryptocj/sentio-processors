/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
    RocketDepositPoolProcessor,
    RocketTokenRETHProcessor,
    RocketTokenRPLProcessor,
} from "./types/eth/index.js";

RocketTokenRETHProcessor.bind({
    address: "0xae78736Cd615f374D3085123A210448E74Fc6393",
    network: 1,
})
    .onEventTransfer(async (evt, ctx) => {
        ctx.meter.Counter("event_count").add(1, { name: evt.name });
        ctx.eventLogger.emit("Transfer", {
            distinctId: evt.args.from,
            amount: evt.args.value.scaleDown(18),
            to: evt.args.to,
        })
    })
    .onTimeInterval(async (_: any, ctx)=>{
        const total = await ctx.contract.totalSupply()
        ctx.meter.Gauge("total_supply").record(
            total.scaleDown(18), { symbol: "RETH" })
    })

RocketTokenRPLProcessor.bind({
    address: "0xD33526068D116cE69F19A9ee46F0bd304F21A51f",
    network: 1,
})
    .onEventTransfer(async (evt, ctx) => {
        ctx.meter.Counter("event_count").add(1, { name: evt.name });
        ctx.eventLogger.emit("Transfer", {
            distinctId: evt.args.from,
            amount: evt.args.value.scaleDown(18),
            to: evt.args.to,
        })
    })
    .onTimeInterval(async (_: any, ctx)=>{
        const total = await ctx.contract.totalSupply()
        ctx.meter.Gauge("total_supply").record(
            total.scaleDown(18), { symbol: "RPL" })
    })

// v1.1
RocketDepositPoolProcessor.bind({
    address: "0x2cac916b2A963Bf162f076C0a8a4a8200BCFBfb4",
    name: "RocketDepositPoolV1.1",
    network: 1,
})
    .onEventDepositReceived(async (evt, ctx) => {
        ctx.meter.Counter("event_count").add(1, { name: evt.name });
        ctx.eventLogger.emit("DepositReceived", {
            distinctId: evt.args.from,
            amount: evt.args.amount.scaleDown(18),
        })
    })
    .onTimeInterval(async (_: any, ctx)=>{
        const total = await ctx.contract.getBalance()
        ctx.meter.Gauge("balance").record(
            total.scaleDown(18), { symbol: "ETH" })
    })

// v1.0
RocketDepositPoolProcessor.bind({
    address: "0x4D05E3d48a938db4b7a9A59A802D5b45011BDe58",
    name: "RocketDepositPoolV1",
    network: 1,
})
    .onEventDepositReceived(async (evt, ctx) => {
        ctx.meter.Counter("event_count").add(1, { name: evt.name });
        ctx.eventLogger.emit("DepositReceived", {
            distinctId: evt.args.from,
            amount: evt.args.amount.scaleDown(18),
        })
    })
    .onTimeInterval(async (_: any, ctx)=>{
        try {
            const total = await ctx.contract.getBalance()
            ctx.meter.Gauge("balance").record(
                total.scaleDown(18), {symbol: "ETH"})
        } catch (e) {
            console.log(e)
        }
    })
