// How values are written as text. Same formats as the GunsNPrices Figma plugin.

/** $1,670.99 */
export function money(value: number): string {
    const [int = "0", dec = "00"] = value.toFixed(2).split(".")
    return "$" + int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + dec
}

/** price of one round in USD, rounded to a tenth of a cent: 12.99 / 50 → 0.26 */
export function costPerRound(price: number, rounds: number): number {
    return Math.round((price / rounds) * 1000) / 1000
}

/** $0.26/rd */
export function costPerRoundText(price: number, rounds: number): string {
    return money(price / rounds) + "/rd"
}

/** 26¢/rd, 7.7¢/rd; a dollar or more stays in dollars */
export function costPerRoundCents(price: number, rounds: number): string {
    const cents = (price / rounds) * 100
    if (cents >= 99.5) return costPerRoundText(price, rounds)
    return (cents < 10 ? (Math.round(cents * 10) / 10).toString() : Math.round(cents).toString()) + "¢/rd"
}

/** 4.02" */
export function inches(value: number): string {
    return `${value}"`
}

/** 1,045 */
export function count(value: number): string {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
