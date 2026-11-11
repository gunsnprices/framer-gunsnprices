// What a synced CMS collection holds: the two data sets, their fields, the saved settings, and the fields and items
// sent to Framer. No Framer API calls here (only its types), so all of it runs in unit tests.
import type { ManagedCollectionFieldInput, ManagedCollectionItemInput, ManagedFieldDataEntryInput } from "@framer/plugin"
import { type Caliber, CALIBERS, caliberNamed, GUNS, type Product, siteUrl } from "./catalog"
import { costPerRound, costPerRoundText, inches, money } from "./format"
import { PRODUCT_TYPES, type ProductType, selectCalibers, selectProducts } from "./select"
import { shortSlug, uniqueSlugs } from "./slug"

export type DatasetId = "calibers" | "products"
type FieldType = "string" | "number" | "enum" | "link"

export interface EnumCase {
    id: string
    name: string
}

export interface FieldOption {
    /** stable field ID in the collection; never change it, or bound layers lose their data */
    id: string
    name: string
    type: FieldType
    /** what the field holds, shown in the panel */
    help: string
    defaultOn: boolean
    /** always included: the item's main text */
    locked?: boolean
    cases?: EnumCase[]
}

export interface TypeOption {
    id: string
    label: string
    /** rows of this type in the bundled data */
    count: number
    defaultOn: boolean
}

export interface Dataset {
    id: DatasetId
    label: string
    /** one line for the panel */
    summary: string
    types: TypeOption[]
    fields: FieldOption[]
    /** item count choices; 0 means all */
    limits: number[]
    defaultLimit: number
}

const CALIBER_TYPES: readonly EnumCase[] = [
    { id: "handgun", name: "Handgun" },
    { id: "rifle", name: "Rifle" },
    { id: "rimfire", name: "Rimfire" },
    { id: "shotgun", name: "Shotgun" },
    { id: "airgun", name: "Airgun" },
    { id: "muzzleloader", name: "Muzzleloader" },
]

const PRODUCT_CATEGORIES: readonly EnumCase[] = [
    { id: "handgun", name: "Handgun" },
    { id: "rifle", name: "Rifle" },
    { id: "shotgun", name: "Shotgun" },
    { id: "ammo", name: "Ammo" },
]

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
    handgun: "Handguns",
    rifle: "Rifles",
    shotgun: "Shotguns",
    ammo: "Ammo",
}

const PRICE_PAGE_HELP = "Link to the price comparison page on gunsnprices.com"

export const DATASETS: Record<DatasetId, Dataset> = {
    calibers: {
        id: "calibers",
        label: "Calibers",
        summary: "Cartridge names with type and the spellings stores use.",
        types: CALIBER_TYPES.map(c => ({
            id: c.id,
            label: c.name,
            count: CALIBERS.filter(caliber => caliber.type === c.id).length,
            defaultOn: c.id !== "airgun" && c.id !== "muzzleloader",
        })),
        fields: [
            { id: "name", name: "Name", type: "string", help: "9×19mm Parabellum", defaultOn: true, locked: true },
            { id: "type", name: "Type", type: "enum", help: "Handgun, Rifle, Rimfire, Shotgun ...", defaultOn: true, cases: [...CALIBER_TYPES] },
            { id: "aliases", name: "Aliases", type: "string", help: "9mm, 9x19, 9mm Luger ...", defaultOn: true },
            { id: "listings", name: "Listings", type: "number", help: "Gun and ammo listings in this caliber", defaultOn: false },
            { id: "pricePage", name: "Price page", type: "link", help: PRICE_PAGE_HELP, defaultOn: false },
        ],
        limits: [10, 25, 50, 100, 0],
        defaultLimit: 50,
    },
    products: {
        id: "products",
        label: "Guns and ammo",
        summary: "Sample products with brand, caliber, price and cost per round.",
        types: PRODUCT_TYPES.map(type => ({
            id: type,
            label: PRODUCT_TYPE_LABELS[type],
            count: type === "ammo" ? productsCount("ammo") : GUNS.filter(gun => gun.type === type).length,
            defaultOn: true,
        })),
        fields: [
            { id: "title", name: "Title", type: "string", help: 'Glock 19 Gen 5 9mm 4.02" 15rd Pistol', defaultOn: true, locked: true },
            { id: "brand", name: "Brand", type: "string", help: "Glock", defaultOn: true },
            { id: "model", name: "Model", type: "string", help: "Glock 19 Gen 5 (guns)", defaultOn: true },
            { id: "caliber", name: "Caliber", type: "string", help: "9×19mm Parabellum", defaultOn: true },
            { id: "category", name: "Category", type: "enum", help: "Handgun, Rifle, Shotgun, Ammo", defaultOn: true, cases: [...PRODUCT_CATEGORIES] },
            { id: "capacity", name: "Capacity", type: "number", help: "15, rounds in the magazine (guns)", defaultOn: true },
            { id: "barrel", name: "Barrel length", type: "number", help: "4.02, inches (guns)", defaultOn: false },
            { id: "rounds", name: "Rounds per box", type: "number", help: "50 (ammo)", defaultOn: true },
            { id: "price", name: "Price", type: "number", help: "757.49, USD", defaultOn: true },
            { id: "priceText", name: "Price text", type: "string", help: "$757.49", defaultOn: true },
            { id: "lowestPrice", name: "Lowest price", type: "number", help: "500.99, USD", defaultOn: false },
            { id: "costPerRound", name: "Cost per round", type: "number", help: "0.26, USD (ammo)", defaultOn: true },
            { id: "costPerRoundText", name: "Cost per round text", type: "string", help: "$0.26/rd (ammo)", defaultOn: true },
            { id: "specs", name: "Specs", type: "string", help: '9×19mm Parabellum · 4.02" · 15 rounds', defaultOn: false },
            { id: "pricePage", name: "Price page", type: "link", help: PRICE_PAGE_HELP, defaultOn: false },
        ],
        limits: [10, 25, 50, 100, 250, 500, 1000, 0],
        defaultLimit: 25,
    },
}

function productsCount(type: ProductType): number {
    return selectProducts([type], 0).length
}

// ---------- settings ----------

/** the settings saved on the collection; a sync without the panel repeats them */
export interface SyncConfig {
    v: 1
    dataset: DatasetId
    types: string[]
    /** number of items; 0 means all */
    limit: number
    fields: string[]
}

export function defaultConfig(dataset: DatasetId): SyncConfig {
    const d = DATASETS[dataset]
    return {
        v: 1,
        dataset,
        types: d.types.filter(t => t.defaultOn).map(t => t.id),
        limit: d.defaultLimit,
        fields: d.fields.filter(f => f.defaultOn).map(f => f.id),
    }
}

/**
 * Settings in canonical form: known types and fields only, in the data set's order, locked fields included.
 * Returns null when nothing usable is left (no types selected).
 */
export function normalizeConfig(config: SyncConfig): SyncConfig | null {
    const d = DATASETS[config.dataset]
    const types = d.types.map(t => t.id).filter(id => config.types.includes(id))
    if (types.length === 0) return null
    const fields = d.fields.filter(f => f.locked || config.fields.includes(f.id)).map(f => f.id)
    const limit = Number.isInteger(config.limit) && config.limit > 0 ? config.limit : 0
    return { v: 1, dataset: d.id, types, limit, fields }
}

export function serializeConfig(config: SyncConfig): string {
    return JSON.stringify(config)
}

/** reads saved settings; null when missing or not readable */
export function parseConfig(text: string | null | undefined): SyncConfig | null {
    if (!text) return null
    let value: unknown
    try {
        value = JSON.parse(text)
    } catch {
        return null
    }
    if (typeof value !== "object" || value === null) return null
    const o = value as Record<string, unknown>
    if (o.v !== 1 || (o.dataset !== "calibers" && o.dataset !== "products")) return null
    if (!isStringArray(o.types) || !isStringArray(o.fields) || typeof o.limit !== "number") return null
    return normalizeConfig({ v: 1, dataset: o.dataset, types: o.types, limit: o.limit, fields: o.fields })
}

function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every(x => typeof x === "string")
}

// ---------- fields and items ----------

export function enabledFields(config: SyncConfig): FieldOption[] {
    return DATASETS[config.dataset].fields.filter(f => f.locked || config.fields.includes(f.id))
}

/** the fields for `setFields` */
export function buildFields(config: SyncConfig): ManagedCollectionFieldInput[] {
    return enabledFields(config).map((f): ManagedCollectionFieldInput => {
        if (f.type === "enum") return { id: f.id, name: f.name, type: "enum", cases: (f.cases ?? []).map(c => ({ ...c })) }
        return { id: f.id, name: f.name, type: f.type }
    })
}

/** number of rows the types allow, before the limit */
export function availableCount(config: SyncConfig): number {
    return config.dataset === "calibers"
        ? selectCalibers(config.types, 0).length
        : selectProducts(config.types as ProductType[], 0).length
}

type Value = string | number | null | undefined

function entry(field: FieldOption, value: Value): ManagedFieldDataEntryInput | undefined {
    switch (field.type) {
        case "string":
            return { type: "string", value: typeof value === "string" ? value : "" }
        case "enum":
            return typeof value === "string" ? { type: "enum", value } : undefined
        case "link":
            return { type: "link", value: typeof value === "string" && value ? value : null }
        case "number":
            // A number field has no empty value in the API: a value that doesn't apply (capacity of an ammo box)
            // is left out, and the item keeps the field empty. Items never change between gun and ammo.
            return typeof value === "number" && Number.isFinite(value) ? { type: "number", value } : undefined
    }
}

export function caliberValue(field: string, caliber: Caliber): Value {
    switch (field) {
        case "name":
            return caliber.name
        case "type":
            return caliber.type
        case "aliases":
            return caliber.aliases.join(", ")
        case "listings":
            return caliber.listings
        case "pricePage":
            return siteUrl(caliber.url)
        default:
            return undefined
    }
}

export function productValue(field: string, p: Product): Value {
    if (p.kind === "gun") {
        switch (field) {
            case "title":
                return p.title
            case "brand":
                return p.brand
            case "model":
                return p.model
            case "caliber":
                return p.caliber
            case "category":
                return p.type
            case "capacity":
                return p.capacity
            case "barrel":
                return p.barrel
            case "price":
                return p.priceMedian
            case "priceText":
                return money(p.priceMedian)
            case "lowestPrice":
                return p.priceMin ?? p.priceMedian
            case "specs":
                return `${p.caliber} · ${inches(p.barrel)} · ${p.capacity} rounds`
            case "pricePage":
                return siteUrl(p.url)
            default:
                // rounds, cost per round: ammo only
                return undefined
        }
    }
    switch (field) {
        case "title":
            return p.title
        case "brand":
            return p.brand
        case "model":
            return ""
        case "caliber":
            return p.caliber
        case "category":
            return "ammo"
        case "rounds":
            return p.rounds
        case "price":
        case "lowestPrice":
            return p.price
        case "priceText":
            return money(p.price)
        case "costPerRound":
            return costPerRound(p.price, p.rounds)
        case "costPerRoundText":
            return costPerRoundText(p.price, p.rounds)
        case "specs":
            return `${p.caliber} · ${p.rounds} rounds · ${costPerRoundText(p.price, p.rounds)}`
        case "pricePage":
            return siteUrl(caliberNamed(p.caliber)?.url)
        default:
            return undefined
    }
}

/** the items for `addItems`, in collection order */
export function buildItems(config: SyncConfig): ManagedCollectionItemInput[] {
    const fields = enabledFields(config)
    const rows =
        config.dataset === "calibers"
            ? selectCalibers(config.types, config.limit).map(c => ({ id: c.id, text: c.name, value: (f: string) => caliberValue(f, c) }))
            : selectProducts(config.types as ProductType[], config.limit).map(p => ({
                  id: p.id,
                  text: p.title,
                  value: (f: string) => productValue(f, p),
              }))
    const slugs = uniqueSlugs(rows.map(r => shortSlug(r.text)))
    return rows.map((row, i) => {
        const fieldData: Record<string, ManagedFieldDataEntryInput> = {}
        for (const field of fields) {
            const e = entry(field, row.value(field.id))
            if (e) fieldData[field.id] = e
        }
        return { id: row.id, slug: slugs[i] ?? row.id, draft: false, fieldData }
    })
}

// ---------- sync plan ----------

export interface SyncPlan {
    fields: ManagedCollectionFieldInput[]
    items: ManagedCollectionItemInput[]
    /** items in the collection now that the new settings don't include */
    removeItemIds: string[]
    /** fields in the collection now that the new settings don't include */
    removeFieldIds: string[]
    added: number
    updated: number
}

export function planSync(config: SyncConfig, existingItemIds: readonly string[], existingFieldIds: readonly string[]): SyncPlan {
    const fields = buildFields(config)
    const items = buildItems(config)
    const keepItems = new Set(items.map(item => item.id))
    const keepFields = new Set(fields.map(field => field.id))
    const existing = new Set(existingItemIds)
    const updated = items.filter(item => existing.has(item.id)).length
    return {
        fields,
        items,
        removeItemIds: existingItemIds.filter(id => !keepItems.has(id)),
        removeFieldIds: existingFieldIds.filter(id => !keepFields.has(id)),
        added: items.length - updated,
        updated,
    }
}

/** "Remove 12 items and 2 fields" style summary of what a sync deletes; "" when nothing */
export function removalSummary(plan: SyncPlan, fieldNames: ReadonlyMap<string, string> = new Map()): string {
    const parts: string[] = []
    const n = plan.removeItemIds.length
    if (n) parts.push(`${n} item${n === 1 ? "" : "s"}`)
    const f = plan.removeFieldIds.length
    if (f) {
        const names = plan.removeFieldIds.map(id => fieldNames.get(id) ?? id)
        parts.push(`${f === 1 ? "the field" : `${f} fields:`} ${names.join(", ")}`)
    }
    return parts.join(" and ")
}
