import {ApiPromise, WsProvider} from '@polkadot/api';
import '@polkadot/api-augment/polkadot';
import {bnToBn, BN} from '@polkadot/util'

let PARACHAINS_ENABLED = false
let MINIMUM_INFLATION = 0.025

let INFLATION_IDEAL

if (PARACHAINS_ENABLED) {
    INFLATION_IDEAL = 0.2
} else {
    INFLATION_IDEAL = 0.1
}


let STAKED_PORTION_IDEAL
if (PARACHAINS_ENABLED) {
    STAKED_PORTION_IDEAL = 0.5
} else {
    STAKED_PORTION_IDEAL = 0.75
}

let INTEREST_IDEAL = INFLATION_IDEAL / STAKED_PORTION_IDEAL

let DECAY_RATE = 0.05

//let IGNORED_COMMISSION_THRESHOLD = 1.toBigDecimal()

let DAYS_IN_YEAR = 365

function convertPerBill(raw: BN): number {
    return raw.toNumber() / 10 ** 9
}

function getStakedPortion(totalStakeAmount: number, totalIssuanceAmount: number): number {
    return totalStakeAmount / totalIssuanceAmount
}

function calculateYearlyInflation(stakedPortion: number): number {
    if (stakedPortion <= STAKED_PORTION_IDEAL && stakedPortion >= 0.0) {
        return stakedPortion * (INTEREST_IDEAL - MINIMUM_INFLATION / STAKED_PORTION_IDEAL)
    } else {
        return (INTEREST_IDEAL * STAKED_PORTION_IDEAL - MINIMUM_INFLATION) * Math.pow(2.0, (STAKED_PORTION_IDEAL - stakedPortion) / DECAY_RATE)
    }
}

function getInterestRate(yearlyInflation: BN, stakedPortion: BN): BN {
    return yearlyInflation.div(stakedPortion)
}

function getAverageStakeOfValidator(totalStake: number, validatorsNum: number): number {
    return totalStake / validatorsNum
}

function planksToAmount(planks: BN): number {
    return planks.div(bnToBn(10 ** 10)).toNumber()
}


function percentageOfYearlyRewardForValidator(
    yearlyInflation: number,
    stakedPortion: number,
    averageStakeOfValidator: number,
    stakeOfValidator: number
): number {
    return (yearlyInflation / stakedPortion) * (averageStakeOfValidator / stakeOfValidator)
}

function getYearlyRewardForValidator(percentageOfYearlyRewardForValidator: number, commissionOfValidator: number): number {
    return percentageOfYearlyRewardForValidator * (1 - commissionOfValidator)
}


function sortByYearlyReward(data, totalStake: BN, balanceTotalIssuance: BN): [ValidatorData] {

    let balanceTotalIssuanceAmount = planksToAmount(balanceTotalIssuance)
    let totalStakeAmount = planksToAmount(totalStake)

    const stakedPortion = getStakedPortion(totalStakeAmount, balanceTotalIssuanceAmount)
    const yearlyInflation = calculateYearlyInflation(stakedPortion)
    const averageValStakeAmount = getAverageStakeOfValidator(totalStakeAmount, data.length)

    for (let i = 0; i < data.length; i++) {
        let stakeAmount = planksToAmount(data[i].totalStake)
        let percentage = percentageOfYearlyRewardForValidator(yearlyInflation, stakedPortion, averageValStakeAmount, stakeAmount)
        data[i].yearlyReward = getYearlyRewardForValidator(percentage, data[i].commission)
    }

    return data.sort((a, b) => b.yearlyReward - a.yearlyReward)
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

async function main() {
    const wsProvider = new WsProvider('wss://rpc.polkadot.io');
    const api = await ApiPromise.create({provider: wsProvider});

    console.log('Our client is connected: ${api.isConnected}');

    const eraOption = await api.query.staking.currentEra()
    const era = eraOption.unwrap()
    console.log('Current era', era)

    //fetch total issuance
    const balanceTotalIssuance = await api.query.balances.totalIssuance()
    console.log('Total issuance', balanceTotalIssuance)


    const eraStakers = await api.query.staking.erasStakers.entries(era)

    const validatorPrefs = await api.query.staking.erasValidatorPrefs.entries(era)

    // staking.eraStakers: (eraIndex, validatorId) => Exposure
    // entries(eraIndex) => [(fullKey, Exposure)], fullKey = (eraIndex, validatorId)

    // eraStakers: [(key, exposure.total)]
    //calculate total stake
    const totalStake = eraStakers.reduce((accumulator, current) => {
        let [key, exposure] = current
        // let era = key.args[0]
        // let validatorId = key.args[1]
        let [era, validatorId] = key.args
        return accumulator.add(exposure.total.toBn())
    }, bnToBn(0));

    // 1. data = [(commission, totalStake, address)]
    // 2. apys = data.map { apy = getYearlyRewardForValidator(..); (apy, address) }
    // 3. sorted_apys = data.sortBy { apy }
    // 4. best = sorted_apys.take(16)

    let validatorPrefsByAccountIdHex = validatorPrefs.reduce(function (map, [storageKey, prefs]) {
        let [_, validatorAccountId] = storageKey.args
        map[validatorAccountId.toHex()] = prefs;
        return map;
    }, {});


    // [VP1, VP2, VP3].associateBy(VP::address) => {VP.address: VP}

    let data = eraStakers.map(([storageKey, eraStaker]) => {
        let [_, validatorAccountId] = storageKey.args
        let prefs = validatorPrefsByAccountIdHex[validatorAccountId.toHex()]

        return new ValidatorData(convertPerBill(prefs.commission.toBn()), eraStaker.total.toBn(), validatorAccountId.toString())
    })

    let sorted = sortByYearlyReward(data, totalStake, balanceTotalIssuance.toBn())
    let best = sorted.slice(0, 16)

    console.log(best)
}

main().catch(console.error)