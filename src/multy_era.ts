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


function sortByYearlyReward(data: ValidatorData[], totalStake: BN, balanceTotalIssuance: BN): ValidatorData[] {

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

interface AverageValidatorRewards {

    validatorId: string

    averageReward: number
}


async function main() {
    const wsProvider = new WsProvider('wss://rpc.polkadot.io');
    const api = await ApiPromise.create({provider: wsProvider});

    let erasSortedValidators = new Map<number, ValidatorData[]>();

    console.log('Our client is connected: ${api.isConnected}');

    const eraOption = await api.query.staking.currentEra()
    const currentEra = eraOption.unwrap()
    console.log('Current era', currentEra)

    //fetch total issuance
    const balanceTotalIssuance = await api.query.balances.totalIssuance()
    console.log('Total issuance', balanceTotalIssuance)

    // let requested_eras: Array<number> = [];
    const numEras = 20;

    for (
        let processingEra = currentEra.toNumber() - numEras + 1;
        processingEra <= currentEra.toNumber();
        processingEra++
    ) {
        const eraStakers = await api.query.staking.erasStakers.entries(processingEra)
        const validatorPrefs = await api.query.staking.erasValidatorPrefs.entries(processingEra)
        console.log('processing era', processingEra)

        // calculate total stake in a whole system
        const totalStake = eraStakers.reduce((accumulator, current) => {
            let [key, exposure] = current
            // let era = key.args[0]
            // let validatorId = key.args[1]
            let [era, validatorId] = key.args
            return accumulator.add(exposure.total.toBn())
        }, bnToBn(0));

        console.log('culc total stake for era', processingEra)

        // associate validatorPrefix by its id to create hashMap validatorId -> validatorPrefs
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

        //sorted array of validators for one era and write it into map
        let sorted = sortByYearlyReward(data, totalStake, balanceTotalIssuance.toBn())
        erasSortedValidators.set(processingEra, sorted);
        console.log('sorted array for era', processingEra)
    }

    // set: {validatorId for validatorId in era in erasSortedValidators}

    let allValidatorIds = new Set<string>()

    erasSortedValidators.forEach((validatorsInEra) => {
        validatorsInEra.forEach((validator) => allValidatorIds.add(validator.address))
    })

    let averageHistoricalApys: AverageValidatorRewards[] = []
    allValidatorIds.forEach((validatorId) => {
        let apySum = 0.0

        erasSortedValidators.forEach((validatorsInEra) => {
            let targetValidatorDataInEra = validatorsInEra.find(
                (validator) => validator.address == validatorId
            )

            if (targetValidatorDataInEra != undefined) {
                apySum += targetValidatorDataInEra.yearlyReward
            }
        })

        const averageValidatorRewards: AverageValidatorRewards = {
            validatorId: validatorId,
            averageReward: apySum / numEras
        }

        averageHistoricalApys.push(averageValidatorRewards)
    })

    let sortedAverageHistoricalApys = averageHistoricalApys.sort(
        (a, b) =>
            b.averageReward - a.averageReward
    )

    let bestHistorical = sortedAverageHistoricalApys.splice(0, 16);
    let bestInstantaneous = erasSortedValidators.get(currentEra.toNumber()).splice(0, 16);

    console.log("Best historical: ", bestHistorical)
    console.log("====================")
    console.log("Best instantaneous: ", bestInstantaneous)
}

main().catch(console.error)