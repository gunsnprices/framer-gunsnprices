// Row order and picking: popular first, mixed across categories and calibers.
import { AMMO, type Ammo, CALIBERS, type Caliber, GUNS, type Gun, type Product } from "./catalog"

export type ProductType = "handgun" | "rifle" | "shotgun" | "ammo"
export const PRODUCT_TYPES: readonly ProductType[] = ["handgun", "rifle", "shotgun", "ammo"]

/**
 * Ammo boxes in popular order: one box of each caliber in turn (most listed caliber first), so that a short list
 * shows 9mm, 12 Gauge, .22 LR ... instead of 25 boxes of 9mm.
 */
export function interleaveByCaliber(boxes: readonly Ammo[]): Ammo[] {
    const groups = new Map<string, Ammo[]>()
    for (const box of boxes) {
        const group = groups.get(box.caliber)
        if (group) group.push(box)
        else groups.set(box.caliber, [box])
    }
    return roundRobin([...groups.values()])
}

let ammoPopularCache: Ammo[] | null = null
export function ammoPopular(): readonly Ammo[] {
    return (ammoPopularCache ??= interleaveByCaliber(AMMO))
}

/** takes the first item of each list, then the second of each, and so on */
export function roundRobin<T>(lists: readonly (readonly T[])[]): T[] {
    const out: T[] = []
    const longest = Math.max(0, ...lists.map(list => list.length))
    for (let i = 0; i < longest; i++) {
        for (const list of lists) {
            const item = list[i]
            if (item !== undefined) out.push(item)
        }
    }
    return out
}

/** every row of a product type, most listed first */
export function productsOfType(type: ProductType): readonly Product[] {
    if (type === "ammo") return ammoPopular()
    return GUNS.filter((gun: Gun) => gun.type === type)
}

/** products of the given types, one of each type in turn; `limit` 0 means all */
export function selectProducts(types: readonly ProductType[], limit: number): Product[] {
    const ordered = PRODUCT_TYPES.filter(type => types.includes(type))
    const all = roundRobin(ordered.map(productsOfType))
    return limit > 0 ? all.slice(0, limit) : all
}

/** calibers of the given types, most listed first; `limit` 0 means all */
export function selectCalibers(types: readonly string[], limit: number): Caliber[] {
    const all = CALIBERS.filter(caliber => types.includes(caliber.type))
    return limit > 0 ? all.slice(0, limit) : all
}
