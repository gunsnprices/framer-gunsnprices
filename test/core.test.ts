import { describe, expect, it } from "vitest"
import { ammoCalibers, ammoText, searchAmmo, TEXT_FORMATS } from "../src/core/ammo-text"
import { AMMO, CALIBERS, caliberNamed, GUNS, SITE, SNAPSHOT } from "../src/core/catalog"
import {
    availableCount,
    buildFields,
    buildItems,
    DATASETS,
    defaultConfig,
    normalizeConfig,
    parseConfig,
    planSync,
    removalSummary,
    serializeConfig,
    type SyncConfig,
} from "../src/core/collection"
import { costPerRound, costPerRoundCents, costPerRoundText, count, money } from "../src/core/format"
import { ammoPopular, roundRobin, selectCalibers, selectProducts } from "../src/core/select"
import { shortSlug, slugify, uniqueSlugs } from "../src/core/slug"

const config = (c: Partial<SyncConfig> & Pick<SyncConfig, "dataset">): SyncConfig => ({ ...defaultConfig(c.dataset), ...c })

describe("format", () => {
    it("writes prices", () => {
        expect(money(757.49)).toBe("$757.49")
        expect(money(1670.99)).toBe("$1,670.99")
        expect(money(12199.99)).toBe("$12,199.99")
        expect(money(0.2598)).toBe("$0.26")
        expect(money(649)).toBe("$649.00")
    })
    it("writes cost per round", () => {
        expect(costPerRound(12.99, 50)).toBe(0.26)
        expect(costPerRound(219.99, 1000)).toBe(0.22)
        expect(costPerRound(4.95, 5)).toBe(0.99)
        expect(costPerRoundText(12.99, 50)).toBe("$0.26/rd")
        expect(costPerRoundCents(12.99, 50)).toBe("26¢/rd")
        expect(costPerRoundCents(33.99, 425)).toBe("8¢/rd")
        expect(costPerRoundCents(30.97, 400)).toBe("7.7¢/rd")
        expect(costPerRoundCents(54.99, 20)).toBe("$2.75/rd")
        expect(costPerRoundCents(19.95, 20)).toBe("$1.00/rd")
    })
    it("groups thousands", () => {
        expect(count(2841)).toBe("2,841")
        expect(count(25)).toBe("25")
    })
})

describe("slug", () => {
    it("makes URL slugs", () => {
        expect(slugify("9×19mm Parabellum")).toBe("9x19mm-parabellum")
        expect(slugify(".38 S&W Special")).toBe("38-sw-special")
        expect(slugify(".30-06 Springfield")).toBe("30-06-springfield")
        expect(slugify('Glock 19 Gen 5 9mm 4.02" 15rd Pistol')).toBe("glock-19-gen-5-9mm-4-02-15rd-pistol")
        expect(slugify("Señor 12 Ga.")).toBe("senor-12-ga")
    })
    it("shortens at a hyphen", () => {
        const s = shortSlug("word ".repeat(40), 30)
        expect(s.length).toBeLessThanOrEqual(30)
        expect(s.endsWith("-")).toBe(false)
        expect(s).toMatch(/^(word-)*word$/)
    })
    it("makes slugs unique", () => {
        expect(uniqueSlugs(["a", "b", "a", "a", ""])).toEqual(["a", "b", "a-2", "a-3", "item"])
        expect(uniqueSlugs(["a-2", "a", "a"])).toEqual(["a-2", "a", "a-3"])
    })
})

describe("catalog", () => {
    it("has the bundled rows", () => {
        expect(SNAPSHOT).toBe("2026-10-12")
        expect(GUNS.length).toBe(2105)
        expect(AMMO.length).toBe(736)
        expect(CALIBERS.length).toBe(293)
    })
    it("has unique, short item IDs", () => {
        const ids = [...GUNS.map(g => g.id), ...AMMO.map(a => a.id)]
        expect(new Set(ids).size).toBe(ids.length)
        expect(new Set(CALIBERS.map(c => c.id)).size).toBe(CALIBERS.length)
        for (const id of ids) expect(id).toMatch(/^[ga]-[a-z0-9-]+$/)
        expect(Math.max(...ids.map(id => id.length))).toBeLessThanOrEqual(64)
    })
    it("keeps price pages as paths on gunsnprices.com", () => {
        for (const g of GUNS) expect(g.url).toMatch(/^\/[^\s]+$/)
        for (const c of CALIBERS) expect(c.url === "" || c.url.startsWith("/")).toBe(true)
        expect(caliberNamed("9×19mm Parabellum")?.url).toBe("/ammo/handgun-ammo/9-19mm-parabellum")
    })
    it("knows every caliber the products use", () => {
        for (const p of [...GUNS, ...AMMO]) expect(caliberNamed(p.caliber), p.caliber).toBeDefined()
    })
})

describe("select", () => {
    it("alternates lists", () => {
        expect(roundRobin<number | string | boolean>([[1, 2, 3], ["a"], [true, false]])).toEqual([1, "a", true, 2, false, 3])
        expect(roundRobin([])).toEqual([])
    })
    it("orders ammo one caliber at a time", () => {
        const first = ammoPopular().slice(0, 3).map(a => a.caliber)
        expect(first).toEqual(["9×19mm Parabellum", "12 Gauge", ".22 LR"])
        expect(ammoPopular().length).toBe(736)
    })
    it("mixes product types in a fixed order", () => {
        const rows = selectProducts(["ammo", "handgun", "rifle"], 6)
        expect(rows.map(r => (r.kind === "gun" ? r.type : "ammo"))).toEqual(["handgun", "rifle", "ammo", "handgun", "rifle", "ammo"])
        expect(rows[0]?.title).toBe('Glock 43X 9mm 3.41" 10rd Pistol')
        expect(selectProducts(["shotgun"], 0).length).toBe(320)
        expect(selectProducts(["handgun", "rifle", "shotgun", "ammo"], 0).length).toBe(2841)
    })
    it("picks calibers by type, most listed first", () => {
        expect(selectCalibers(["handgun"], 2).map(c => c.name)).toEqual(["9×19mm Parabellum", ".45 ACP"])
        expect(selectCalibers(["airgun", "muzzleloader"], 0).length).toBe(9)
    })
})

describe("settings", () => {
    it("has stable field IDs", () => {
        // Field IDs must never change: Framer binds layers to them.
        expect(DATASETS.calibers.fields.map(f => f.id)).toEqual(["name", "type", "aliases", "listings", "pricePage"])
        expect(DATASETS.products.fields.map(f => f.id)).toEqual([
            "title",
            "brand",
            "model",
            "caliber",
            "category",
            "capacity",
            "barrel",
            "rounds",
            "price",
            "priceText",
            "lowestPrice",
            "costPerRound",
            "costPerRoundText",
            "specs",
            "pricePage",
        ])
    })
    it("leaves the price page link off by default", () => {
        expect(defaultConfig("calibers").fields).not.toContain("pricePage")
        expect(defaultConfig("products").fields).not.toContain("pricePage")
        expect(defaultConfig("products").limit).toBe(25)
        expect(defaultConfig("calibers").types).toEqual(["handgun", "rifle", "rimfire", "shotgun"])
    })
    it("normalizes", () => {
        const n = normalizeConfig({ v: 1, dataset: "products", types: ["ammo", "bogus", "rifle"], limit: -3, fields: ["price", "nope"] })
        expect(n).toEqual({ v: 1, dataset: "products", types: ["rifle", "ammo"], limit: 0, fields: ["title", "price"] })
        expect(normalizeConfig({ v: 1, dataset: "calibers", types: [], limit: 10, fields: [] })).toBeNull()
    })
    it("round-trips and rejects bad saved settings", () => {
        const c = defaultConfig("calibers")
        expect(parseConfig(serializeConfig(c))).toEqual(c)
        expect(parseConfig(null)).toBeNull()
        expect(parseConfig("")).toBeNull()
        expect(parseConfig("{oops")).toBeNull()
        expect(parseConfig("[]")).toBeNull()
        expect(parseConfig(JSON.stringify({ ...c, v: 2 }))).toBeNull()
        expect(parseConfig(JSON.stringify({ ...c, dataset: "x" }))).toBeNull()
        expect(parseConfig(JSON.stringify({ ...c, types: "rifle" }))).toBeNull()
        expect(serializeConfig(defaultConfig("products")).length).toBeLessThan(400)
    })
    it("counts what the types allow", () => {
        expect(availableCount(config({ dataset: "products", types: ["handgun"] }))).toBe(1045)
        expect(availableCount(config({ dataset: "calibers" }))).toBe(284)
    })
})

describe("fields", () => {
    it("sends only the chosen fields, in order", () => {
        const fields = buildFields(config({ dataset: "calibers", fields: ["aliases", "pricePage"] }))
        expect(fields.map(f => [f.id, f.type])).toEqual([
            ["name", "string"],
            ["aliases", "string"],
            ["pricePage", "link"],
        ])
    })
    it("defines enum cases with stable IDs", () => {
        const all = buildFields(config({ dataset: "products", fields: DATASETS.products.fields.map(f => f.id) }))
        expect(all.length).toBeLessThanOrEqual(30)
        const category = all.find(f => f.id === "category")
        expect(category).toMatchObject({ type: "enum", cases: [{ id: "handgun", name: "Handgun" }, { id: "rifle" }, { id: "shotgun" }, { id: "ammo" }] })
        for (const f of all) expect(f.id.length).toBeLessThanOrEqual(64)
    })
})

describe("items", () => {
    const allFields = (dataset: "calibers" | "products") => DATASETS[dataset].fields.map(f => f.id)

    it("builds caliber items", () => {
        const items = buildItems(config({ dataset: "calibers", limit: 3, fields: allFields("calibers") }))
        expect(items.map(i => [i.id, i.slug])).toEqual([
            ["9x19mmparabellum", "9x19mm-parabellum"],
            ["12gauge", "12-gauge"],
            ["22lr", "22-lr"],
        ])
        expect(items[0]).toEqual({
            id: "9x19mmparabellum",
            slug: "9x19mm-parabellum",
            draft: false,
            fieldData: {
                name: { type: "string", value: "9×19mm Parabellum" },
                type: { type: "enum", value: "handgun" },
                aliases: { type: "string", value: expect.stringContaining("9mm, 9x19, ") },
                listings: { type: "number", value: 10605 },
                pricePage: { type: "link", value: `${SITE}/ammo/handgun-ammo/9-19mm-parabellum` },
            },
        })
    })
    it("leaves the link empty for a caliber without a price page", () => {
        const items = buildItems(config({ dataset: "calibers", limit: 0, types: ["muzzleloader"], fields: ["pricePage"] }))
        const empty = items.filter(i => i.fieldData.pricePage?.value === null)
        expect(empty.length).toBeGreaterThan(0)
    })
    it("builds a gun and an ammo box", () => {
        const [gun, rifle, ammo] = buildItems(config({ dataset: "products", types: ["handgun", "ammo", "rifle"], limit: 3, fields: allFields("products") }))
        expect(gun?.fieldData).toEqual({
            title: { type: "string", value: 'Glock 43X 9mm 3.41" 10rd Pistol' },
            brand: { type: "string", value: "Glock" },
            model: { type: "string", value: "Glock 43X" },
            caliber: { type: "string", value: "9×19mm Parabellum" },
            category: { type: "enum", value: "handgun" },
            capacity: { type: "number", value: 10 },
            barrel: { type: "number", value: 3.41 },
            price: { type: "number", value: 649 },
            priceText: { type: "string", value: "$649.00" },
            lowestPrice: { type: "number", value: 448 },
            costPerRoundText: { type: "string", value: "" },
            specs: { type: "string", value: '9×19mm Parabellum · 3.41" · 10 rounds' },
            pricePage: { type: "link", value: `${SITE}/guns/glock-43x` },
        })
        expect(rifle?.fieldData.category).toEqual({ type: "enum", value: "rifle" })
        expect(ammo?.fieldData).toEqual({
            title: { type: "string", value: "Scorpion Ammo 9mm 115gr FMJ 50rd" },
            brand: { type: "string", value: "Scorpion" },
            model: { type: "string", value: "" },
            caliber: { type: "string", value: "9×19mm Parabellum" },
            category: { type: "enum", value: "ammo" },
            rounds: { type: "number", value: 50 },
            price: { type: "number", value: 12.99 },
            priceText: { type: "string", value: "$12.99" },
            lowestPrice: { type: "number", value: 12.99 },
            costPerRound: { type: "number", value: 0.26 },
            costPerRoundText: { type: "string", value: "$0.26/rd" },
            specs: { type: "string", value: "9×19mm Parabellum · 50 rounds · $0.26/rd" },
            pricePage: { type: "link", value: `${SITE}/ammo/handgun-ammo/9-19mm-parabellum` },
        })
    })
    it("uses lowest = median when a gun has no lowest price", () => {
        const gun = GUNS.find(g => g.priceMin === null)
        expect(gun).toBeDefined()
        const items = buildItems(config({ dataset: "products", limit: 0, fields: ["lowestPrice"] }))
        const item = items.find(i => i.id === gun?.id)
        expect(item?.fieldData.lowestPrice).toEqual({ type: "number", value: gun?.priceMedian })
    })
    it("makes every item of the full data set valid", () => {
        for (const dataset of ["calibers", "products"] as const) {
            const c = config({ dataset, types: DATASETS[dataset].types.map(t => t.id), limit: 0, fields: allFields(dataset) })
            const fields = new Map(buildFields(c).map(f => [f.id, f]))
            const items = buildItems(c)
            expect(items.length).toBe(dataset === "calibers" ? 293 : 2841)
            expect(new Set(items.map(i => i.id)).size).toBe(items.length)
            expect(new Set(items.map(i => i.slug)).size).toBe(items.length)
            for (const item of items) {
                expect(item.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
                expect(item.slug.length).toBeLessThanOrEqual(80)
                for (const [id, entry] of Object.entries(item.fieldData)) {
                    const field = fields.get(id)
                    expect(field, id).toBeDefined()
                    expect(entry.type).toBe(field?.type)
                    if (entry.type === "enum" && field?.type === "enum") {
                        expect(field.cases.map(c => c.id)).toContain(entry.value)
                    }
                    if (entry.type === "number") expect(Number.isFinite(entry.value)).toBe(true)
                    if (entry.type === "link" && entry.value !== null) expect(entry.value.startsWith(SITE + "/")).toBe(true)
                }
            }
        }
    })
    it("never writes a link field unless asked", () => {
        for (const item of buildItems(config({ dataset: "products", limit: 0 }))) {
            expect(item.fieldData.pricePage).toBeUndefined()
        }
    })
})

describe("sync plan", () => {
    it("adds, updates and removes", () => {
        const c = config({ dataset: "calibers", limit: 3, fields: ["type"] })
        const plan = planSync(c, ["12gauge", "old-item"], ["name", "type", "listings"])
        expect(plan.items.map(i => i.id)).toEqual(["9x19mmparabellum", "12gauge", "22lr"])
        expect(plan.added).toBe(2)
        expect(plan.updated).toBe(1)
        expect(plan.removeItemIds).toEqual(["old-item"])
        expect(plan.removeFieldIds).toEqual(["listings"])
        expect(removalSummary(plan, new Map([["listings", "Listings"]]))).toBe("1 item and the field Listings")
    })
    it("removes nothing when the settings did not change", () => {
        const c = defaultConfig("products")
        const first = planSync(c, [], [])
        const again = planSync(
            c,
            first.items.map(i => i.id),
            first.fields.map(f => f.id),
        )
        expect(again.removeItemIds).toEqual([])
        expect(again.removeFieldIds).toEqual([])
        expect(again.updated).toBe(25)
        expect(removalSummary(again)).toBe("")
    })
    it("summarizes many removals", () => {
        const plan = planSync(config({ dataset: "calibers", limit: 1, fields: [] }), ["a", "b"], ["name", "aliases", "type"])
        expect(removalSummary(plan)).toBe("2 items and 2 fields: aliases, type")
    })
})

describe("canvas text", () => {
    const box = AMMO.find(a => a.title === "Scorpion Ammo 9mm 115gr FMJ 50rd")!
    it("writes every format", () => {
        expect(TEXT_FORMATS.map(f => ammoText(box, f.id))).toEqual([
            "$0.26/rd",
            "26¢/rd",
            "$0.26 per round",
            "$12.99 · 50 rounds · $0.26/rd",
        ])
    })
    it("lists calibers with ammo", () => {
        const calibers = ammoCalibers()
        expect(calibers[0]).toEqual({ name: "9×19mm Parabellum", count: expect.any(Number) })
        expect(calibers.reduce((sum, c) => sum + c.count, 0)).toBe(736)
        expect(calibers.length).toBe(85)
    })
    it("searches by words and caliber", () => {
        expect(searchAmmo("").length).toBe(736)
        const hst = searchAmmo("federal hst 124")
        expect(hst.length).toBeGreaterThan(0)
        for (const b of hst) expect(b.title.toLowerCase()).toContain("hst")
        expect(searchAmmo("", "12 Gauge").every(b => b.caliber === "12 Gauge")).toBe(true)
        expect(searchAmmo("9x19").length).toBeGreaterThan(0)
        expect(searchAmmo("no such ammo here")).toEqual([])
        expect(searchAmmo("SCORPION 9MM")[0]?.title).toBe(box.title)
    })
})
