// Canvas mode: find an ammo box and write its cost per round as text.
import type { Ammo } from "./catalog"
import { costPerRoundCents, costPerRoundText, money } from "./format"
import { ammoPopular } from "./select"

export type TextFormat = "rd" | "cents" | "words" | "line"

export const TEXT_FORMATS: readonly { id: TextFormat; label: string }[] = [
    { id: "rd", label: "$0.26/rd" },
    { id: "cents", label: "26¢/rd" },
    { id: "words", label: "$0.26 per round" },
    { id: "line", label: "$12.99 · 50 rounds · $0.26/rd" },
]

export function isTextFormat(v: unknown): v is TextFormat {
    return TEXT_FORMATS.some(f => f.id === v)
}

/** the text inserted on the canvas */
export function ammoText(box: Ammo, format: TextFormat): string {
    switch (format) {
        case "rd":
            return costPerRoundText(box.price, box.rounds)
        case "cents":
            return costPerRoundCents(box.price, box.rounds)
        case "words":
            return `${money(box.price / box.rounds)} per round`
        case "line":
            return `${money(box.price)} · ${box.rounds} rounds · ${costPerRoundText(box.price, box.rounds)}`
    }
}

export interface CaliberCount {
    name: string
    count: number
}

/** calibers that have ammo boxes, most listed first, with the number of boxes */
export function ammoCalibers(): CaliberCount[] {
    const counts = new Map<string, number>()
    for (const box of ammoPopular()) counts.set(box.caliber, (counts.get(box.caliber) ?? 0) + 1)
    return [...counts].map(([name, count]) => ({ name, count }))
}

function fold(text: string): string {
    return text
        .normalize("NFKD")
        .replace(/×/g, "x")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
}

/**
 * Boxes whose title, brand or caliber contain every word of the query (case and accents ignored), in popular
 * order. `caliber` "" means any caliber.
 */
export function searchAmmo(query: string, caliber = ""): Ammo[] {
    const words = fold(query).split(/\s+/).filter(Boolean)
    return ammoPopular().filter(box => {
        if (caliber && box.caliber !== caliber) return false
        if (words.length === 0) return true
        const haystack = fold(`${box.title} ${box.brand} ${box.caliber}`)
        return words.every(word => haystack.includes(word))
    })
}
