import {ApiPromise, WsProvider} from '@polkadot/api';
import '@polkadot/api-augment/polkadot';
import {bnToBn, BN} from '@polkadot/util';
import {bestHistoricalApy, HistoricalApy} from './multi_era';
import {baselineApy, bestBaselineApy, baseInterestPerEra} from './baseline';

import axios from 'axios';
import {BigFromINumber, fromPlanks} from "./utils";

let APY_KEY_TOKEN = "7069eaf578f244c3af4de2ce22425d3b"

let NOMINATOR_ADRESS = "15fTw39Ju2jJiHeGe1fJ5DtgugUauy9tr2HZuiRNFwqnGQ1Q"

const src = 'https://api.subquery.network/sq/nova-wallet/nova-wallet-polkadot'

class RewardData {
    era: number;
    amount: BN;
    stash: string;
    eventIdx: number;
    validator: string;
    isReward: boolean;

    constructor(era: number, amount: BN, validator: string, stash: string, eventIdx: number, isReward: boolean) {
        this.amount = amount;
        this.era = era;
        this.validator = validator;
        this.stash = stash;
        this.eventIdx = eventIdx;
        this.isReward = isReward;
    }
}

class ValidatorData {
    commission: number;
    totalStake: BN;
    address: string;
    yearlyReward: number;

    constructor(commission: number, totalStake: BN, address: string) {
        this.commission = commission;
        this.totalStake = totalStake;
        this.address = address;
        this.yearlyReward = 0;
    }
}

interface AverageValidatorRewards {

    validatorId: string

    averageReward: number
}

async function getRewardsSlashes(): Promise<RewardData[]> {


    const options = {
        headers: {
                     'Content-Type': 'application/json'/*,
                     'X-API-Key': '7069eaf578f244c3af4de2ce22425d3b'*/}
    };

    const data = {
        query: `
        query {
  historyElements(filter: {
    and: [
      {address: {equalTo: "15fTw39Ju2jJiHeGe1fJ5DtgugUauy9tr2HZuiRNFwqnGQ1Q"}},
      {reward: {isNull: false}},
    ]
  }, orderBy: BLOCK_NUMBER_DESC){
    nodes{reward}
  }
}

        `
    }

    try {
        const { data: { data: { historyElements: { nodes } }} } = await axios.post(src, data, options)
       // console.log(nodes)
        return nodes.map((node) => node.reward)
        //list[0].amount
    } catch (error) {
        console.error(error)
    }

}

async function main() {
    //получаем список всех наград
    let rewardsSlashes: RewardData[] = await getRewardsSlashes()

    //получаем эру и адрес валидатора для первой награды
    let era: number = rewardsSlashes[0].era
    console.log("Era in which rewarded : ", era)
    let validatorAddress = rewardsSlashes[0].validator
    console.log("Address of validator : ", validatorAddress)

    // var historicalApy: AverageValidatorRewards[] = await bestHistoricalApy()
    // console.log("HistoricalApy: ", historicalApy)

    //получаем список APY всех валидаторов
    let baseApy: ValidatorData[] = await baselineApy()
    let validatorAPY = 0;
    for(let i = 0; i < baseApy.length; i++){
        if(baseApy[i].address == validatorAddress){
            validatorAPY = baseApy[i].yearlyReward
        }
    }
    //в случае, если необходимый валидатор не найден
    if(validatorAPY == 0){
        console.log("There is no such validator")
    }
    console.log("Validator APY: ", validatorAPY)


    const wsProvider = new WsProvider('wss://rpc.polkadot.io');
    const api = await ApiPromise.create({provider: wsProvider});
    const decimals = api.registry.chainDecimals[0]
  //  console.log('Our client is connected: ${api.isConnected}');

    // let multiQueries = [[era, NOMINATOR_ADRESS], [era + 1, NOMINATOR_ADRESS]]
    // const eraStakers = await api.query.staking.erasStakers.multi(multiQueries)


    //getting nominators and amount of their stake
    const eraStaker = await api.query.staking.erasStakers(era, validatorAddress)
    const nominatorStake = eraStaker.others.find(other => other.who.toString() == NOMINATOR_ADRESS)

    console.log("nominator stake : ", nominatorStake.value.toHuman())

    let stake = nominatorStake.value
    let stakeInDots = fromPlanks(BigFromINumber(stake), decimals).toNumber()
    console.log("stake in Dots : ", stakeInDots)

    //считаем прибыль не за год, а за эру = 1 день (изначальный алгоритм)
    let baselineAlgorithmProfit = baseInterestPerEra( validatorAPY,stakeInDots)
    console.log("baseline algorithm profit in dots: ", baselineAlgorithmProfit)

    //считаем настоящую прибыль за эру
    let realProfit = rewardsSlashes[0].amount
   // let realProfitInDots = fromPlanks(BigFromINumber(realProfit), decimals).toNumber()
    let realProfitInDots = Number(realProfit) / Math.pow(10,12)
    console.log("real profit: ", realProfitInDots)

    //console.log("validatorPrefs : ", validatorPrefs)

}

main().catch(console.error)