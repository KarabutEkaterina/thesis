import {ApiPromise, WsProvider} from '@polkadot/api';
import '@polkadot/api-augment/polkadot';
import {bnToBn, BN} from '@polkadot/util'


import axios from 'axios';

let APY_KEY_TOKEN = "7069eaf578f244c3af4de2ce22425d3b"

// const options = {
//     headers: {
//         'Content-Type': 'application/json',
//         'X-API-Key': '7069eaf578f244c3af4de2ce22425d3b'},
//
//     params : {
//         row: 20,
//         page: 1,
//         address: "15fTw39Ju2jJiHeGe1fJ5DtgugUauy9tr2HZuiRNFwqnGQ1Q"}
// };

// const response = await axios.get(src, options)

const src = 'https://api.subquery.network/sq/nova-wallet/nova-wallet-polkadot'

async function getRewardsSlashes() {


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
        console.log(nodes)
        return data
        //list[0].amount
    } catch (error) {
        console.error(error)
    }

}

async function main() {
    let rewardsSlashes = getRewardsSlashes()
}

main().catch(console.error)