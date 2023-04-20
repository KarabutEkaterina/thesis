import {ApiPromise, WsProvider} from '@polkadot/api';
import '@polkadot/api-augment/polkadot';
import {bnToBn, BN} from '@polkadot/util'


import axios from 'axios';

let APY_KEY_TOKEN = "7069eaf578f244c3af4de2ce22425d3b"

// curl -X POST 'https://polkadot.api.subscan.io/api/scan/account/reward_slash' \
//   --header 'Content-Type: application/json' \
//   --header 'X-API-Key: YOUR_KEY' \
//   --data-raw '{
// "row": 20,
//     "page": 1,
//     "address": "15fTw39Ju2jJiHeGe1fJ5DtgugUauy9tr2HZuiRNFwqnGQ1Q"
// }'

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

const src = 'https://polkadot.api.subscan.io/api/scan/account/reward_slash'

async function getRewardsSlashes() {


    const options = {
        headers: {
                     'Content-Type': 'application/json',
                     'X-API-Key': '7069eaf578f244c3af4de2ce22425d3b'}
    };

    const data = {
        row : 20,
        page : 1,
        address: "15fTw39Ju2jJiHeGe1fJ5DtgugUauy9tr2HZuiRNFwqnGQ1Q"
    }

    try {
        const { data: { data: { list }} } = await axios.post(src,
            { row : 20, page : 1, address: "15fTw39Ju2jJiHeGe1fJ5DtgugUauy9tr2HZuiRNFwqnGQ1Q"},
            options)

        console.log(list[0].amount)
    } catch (error) {
        console.error(error)
    }


}

async function main() {

    let rewardsSlashes = getRewardsSlashes()

}

main().catch(console.error)