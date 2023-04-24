import Big from "big.js";
import {INumber} from "@polkadot/types-codec/types/interfaces";

export function BigFromINumber(number: INumber): Big {
    return Big(number.toString())
}

export function toPlanks(amount: Big, decimals: number): Big {
    return amount.mul(Big(10).pow(decimals))
}

export function fromPlanks(amount: Big, decimals: number): Big {
    return amount.div(Big(10).pow(decimals))
}