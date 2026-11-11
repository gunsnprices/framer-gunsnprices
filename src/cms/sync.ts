// Writes a sync plan into a managed collection. The plan itself is built in src/core/collection.ts.
import { framer, type ManagedCollection, type ProtectedMethod } from "@framer/plugin"
import { SNAPSHOT } from "../core/catalog"
import { planSync, serializeConfig, type SyncConfig, type SyncPlan } from "../core/collection"
import { count } from "../core/format"

/** plugin data keys on the collection (small, shared with collaborators: settings only) */
export const PLUGIN_KEYS = {
    CONFIG: "config",
    SNAPSHOT: "dataSnapshot",
} as const

export const SYNC_METHODS = [
    "ManagedCollection.setFields",
    "ManagedCollection.addItems",
    "ManagedCollection.removeItems",
    "ManagedCollection.setItemOrder",
    "ManagedCollection.setPluginData",
] as const satisfies ProtectedMethod[]

export interface CollectionState {
    itemIds: string[]
    fieldIds: string[]
    fieldNames: Map<string, string>
}

export async function readCollectionState(collection: ManagedCollection): Promise<CollectionState> {
    const [itemIds, fields] = await Promise.all([collection.getItemIds(), collection.getFields()])
    return {
        itemIds,
        fieldIds: fields.map(field => field.id),
        fieldNames: new Map(fields.map(field => [field.id, field.name])),
    }
}

export async function makePlan(collection: ManagedCollection, config: SyncConfig): Promise<SyncPlan> {
    const state = await readCollectionState(collection)
    return planSync(config, state.itemIds, state.fieldIds)
}

/** applies a plan: fields first, then removals, then the items in order, then the settings */
export async function applyPlan(collection: ManagedCollection, config: SyncConfig, plan: SyncPlan): Promise<void> {
    await collection.setFields(plan.fields)
    if (plan.removeItemIds.length > 0) await collection.removeItems(plan.removeItemIds)
    await collection.addItems(plan.items)
    await collection.setItemOrder(plan.items.map(item => item.id))
    await collection.setPluginData(PLUGIN_KEYS.CONFIG, serializeConfig(config))
    await collection.setPluginData(PLUGIN_KEYS.SNAPSHOT, SNAPSHOT)
}

export function resultMessage(plan: SyncPlan): string {
    const n = plan.items.length
    const removed = plan.removeItemIds.length
    return `Synced ${count(n)} item${n === 1 ? "" : "s"}` + (removed ? `, removed ${count(removed)}` : "")
}

/**
 * Sync mode: repeat the saved settings without showing the panel. Returns false when the panel should open instead
 * (no permission, or the sync failed).
 */
export async function syncWithoutUI(collection: ManagedCollection, config: SyncConfig): Promise<boolean> {
    if (!framer.isAllowedTo(...SYNC_METHODS)) return false
    let plan: SyncPlan
    try {
        plan = await makePlan(collection, config)
        await applyPlan(collection, config, plan)
    } catch (error) {
        console.error(error)
        framer.notify(`Sync failed: ${errorText(error)}`, { variant: "error" })
        return false
    }
    // closePlugin throws FramerPluginClosedError to stop the plugin; it is not caught here.
    framer.closePlugin(resultMessage(plan), { variant: "success" })
}

export function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
