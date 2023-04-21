import {ApiPromise, WsProvider} from '@polkadot/api';
import '@polkadot/api-augment/polkadot';
import {bnToBn, BN} from '@polkadot/util'
import {bestHistoricalApy, HistoricalApy} from './multi_era';

import axios from 'axios';

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
        return nodes
        //list[0].amount
    } catch (error) {
        console.error(error)
    }

}

async function main() {
    let rewardsSlashes: RewardData[] = await getRewardsSlashes()
    var HistoricalApy: AverageValidatorRewards[] = await bestHistoricalApy()
    // console.log("HistoricalApy: ", HistoricalApy)
    // console.log("Rewards and slashes: ", rewardsSlashes)



}

main().catch(console.error)