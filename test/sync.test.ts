// The Framer side of a sync, against a fake managed collection and a fake `framer` object.
import { beforeEach, describe, expect, it, vi } from "vitest"

class ClosedError extends Error {}

const framerMock = vi.hoisted(() => ({
    isAllowedTo: vi.fn(() => true),
    notify: vi.fn(),
    closePlugin: vi.fn((): never => {
        throw new Error("closed")
    }),
}))

vi.mock("@framer/plugin", () => ({ framer: framerMock }))

import { defaultConfig, parseConfig } from "../src/core/collection"
import { applyPlan, makePlan, PLUGIN_KEYS, resultMessage, syncWithoutUI } from "../src/cms/sync"

interface Field {
    id: string
    name: string
}

/** an in-memory ManagedCollection with the methods the plugin uses */
function fakeCollection() {
    const calls: string[] = []
    const store = {
        items: new Map<string, unknown>(),
        order: [] as string[],
        fields: [] as Field[],
        data: new Map<string, string | null>(),
    }
    const collection = {
        getItemIds: vi.fn(async () => [...store.order]),
        getFields: vi.fn(async () => store.fields.map(f => ({ ...f }))),
        setFields: vi.fn(async (fields: Field[]) => {
            calls.push("setFields")
            store.fields = fields.map(f => ({ id: f.id, name: f.name }))
        }),
        removeItems: vi.fn(async (ids: string[]) => {
            calls.push("removeItems")
            for (const id of ids) store.items.delete(id)
            store.order = store.order.filter(id => !ids.includes(id))
        }),
        addItems: vi.fn(async (items: { id: string }[]) => {
            calls.push("addItems")
            for (const item of items) {
                if (!store.items.has(item.id)) store.order.push(item.id)
                store.items.set(item.id, item)
            }
        }),
        setItemOrder: vi.fn(async (ids: string[]) => {
            calls.push("setItemOrder")
            store.order = ids.filter(id => store.items.has(id))
        }),
        setPluginData: vi.fn(async (key: string, value: string | null) => {
            calls.push(`setPluginData:${key}`)
            store.data.set(key, value)
        }),
        getPluginData: vi.fn(async (key: string) => store.data.get(key) ?? null),
    }
    return { collection, store, calls }
}

type Fake = ReturnType<typeof fakeCollection>
// The fake implements the subset of ManagedCollection the plugin calls.
const asCollection = (fake: Fake) => fake.collection as unknown as Parameters<typeof applyPlan>[0]

beforeEach(() => {
    framerMock.isAllowedTo.mockReturnValue(true)
    framerMock.notify.mockClear()
    framerMock.closePlugin.mockClear()
    framerMock.closePlugin.mockImplementation((): never => {
        throw new ClosedError("closed")
    })
})

describe("applyPlan", () => {
    it("writes fields, items, order and settings, in that order", async () => {
        const fake = fakeCollection()
        const config = defaultConfig("calibers")
        const plan = await makePlan(asCollection(fake), config)
        await applyPlan(asCollection(fake), config, plan)
        expect(fake.calls).toEqual([
            "setFields",
            "addItems",
            "setItemOrder",
            `setPluginData:${PLUGIN_KEYS.CONFIG}`,
            `setPluginData:${PLUGIN_KEYS.SNAPSHOT}`,
        ])
        expect(fake.store.order.length).toBe(50)
        expect(fake.store.order[0]).toBe("9x19mmparabellum")
        expect(fake.store.fields.map(f => f.id)).toEqual(["name", "type", "aliases"])
        expect(parseConfig(fake.store.data.get(PLUGIN_KEYS.CONFIG))).toEqual(config)
        expect(fake.store.data.get(PLUGIN_KEYS.SNAPSHOT)).toBe("2026-10-12")
        expect(resultMessage(plan)).toBe("Synced 50 items")
    })

    it("removes items that the new settings leave out", async () => {
        const fake = fakeCollection()
        const first = { ...defaultConfig("calibers"), limit: 10 }
        await applyPlan(asCollection(fake), first, await makePlan(asCollection(fake), first))
        const smaller = { ...first, limit: 5 }
        const plan = await makePlan(asCollection(fake), smaller)
        expect(plan.removeItemIds.length).toBe(5)
        fake.calls.length = 0
        await applyPlan(asCollection(fake), smaller, plan)
        expect(fake.calls.slice(0, 3)).toEqual(["setFields", "removeItems", "addItems"])
        expect(fake.store.order.length).toBe(5)
        expect(resultMessage(plan)).toBe("Synced 5 items, removed 5")
    })

    it("replaces calibers with products when the data set changes", async () => {
        const fake = fakeCollection()
        const calibers = defaultConfig("calibers")
        await applyPlan(asCollection(fake), calibers, await makePlan(asCollection(fake), calibers))
        const products = defaultConfig("products")
        const plan = await makePlan(asCollection(fake), products)
        expect(plan.removeItemIds.length).toBe(50)
        expect(plan.removeFieldIds).toEqual(["name", "type", "aliases"])
        await applyPlan(asCollection(fake), products, plan)
        expect(fake.store.order.length).toBe(25)
        expect(fake.store.order.every(id => id.startsWith("g-") || id.startsWith("a-"))).toBe(true)
    })
})

describe("syncWithoutUI", () => {
    it("syncs the saved settings and closes the plugin with a message", async () => {
        const fake = fakeCollection()
        await expect(syncWithoutUI(asCollection(fake), defaultConfig("products"))).rejects.toBeInstanceOf(ClosedError)
        expect(framerMock.closePlugin).toHaveBeenCalledWith("Synced 25 items", { variant: "success" })
        expect(framerMock.notify).not.toHaveBeenCalled()
        expect(fake.store.order.length).toBe(25)
    })

    it("opens the panel instead when the user may not edit", async () => {
        framerMock.isAllowedTo.mockReturnValue(false)
        const fake = fakeCollection()
        await expect(syncWithoutUI(asCollection(fake), defaultConfig("products"))).resolves.toBe(false)
        expect(fake.calls).toEqual([])
        expect(framerMock.closePlugin).not.toHaveBeenCalled()
    })

    it("reports a failed sync and opens the panel", async () => {
        const fake = fakeCollection()
        fake.collection.addItems.mockRejectedValueOnce(new Error("Item limit reached"))
        await expect(syncWithoutUI(asCollection(fake), defaultConfig("products"))).resolves.toBe(false)
        expect(framerMock.notify).toHaveBeenCalledWith("Sync failed: Item limit reached", { variant: "error" })
        expect(framerMock.closePlugin).not.toHaveBeenCalled()
    })
})
