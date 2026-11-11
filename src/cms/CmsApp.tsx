// CMS panel: pick the data set, types, number of items and fields, then sync the managed collection.
import { FramerPluginClosedError, framer, type ManagedCollection, useIsAllowedTo } from "@framer/plugin"
import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { SNAPSHOT } from "../core/catalog"
import {
    availableCount,
    DATASETS,
    type DatasetId,
    defaultConfig,
    normalizeConfig,
    removalSummary,
    type SyncConfig,
    type SyncPlan,
} from "../core/collection"
import { count } from "../core/format"
import { Attribution, Segmented } from "../ui"
import { applyPlan, type CollectionState, errorText, makePlan, readCollectionState, resultMessage, SYNC_METHODS } from "./sync"

/** closePlugin throws FramerPluginClosedError to end the plugin; Framer says to ignore it */
function ignoreClosed(error: unknown) {
    if (!(error instanceof FramerPluginClosedError)) throw error
}

/** Framer's Basic plan allows 1,000 CMS items (framer.com/pricing, checked 2026-11-11) */
const BASIC_PLAN_ITEMS = 1000

interface Props {
    collection: ManagedCollection
    saved: SyncConfig | null
}

type Status = { kind: "editing" } | { kind: "confirming"; plan: SyncPlan; summary: string } | { kind: "syncing" }

export function CmsApp({ collection, saved }: Props) {
    const [config, setConfig] = useState<SyncConfig>(() => saved ?? defaultConfig("products"))
    const [state, setState] = useState<CollectionState | null>(null)
    const [status, setStatus] = useState<Status>({ kind: "editing" })
    const isAllowed = useIsAllowedTo(...SYNC_METHODS)

    useLayoutEffect(() => {
        void framer.showUI({ width: 320, height: 600, minWidth: 320, minHeight: 420, resizable: "height" })
    }, [])

    useEffect(() => {
        readCollectionState(collection)
            .then(setState)
            .catch(error => {
                console.error(error)
                framer.notify("Could not read the collection.", { variant: "error" })
            })
    }, [collection])

    const dataset = DATASETS[config.dataset]
    const normalized = useMemo(() => normalizeConfig(config), [config])
    const available = useMemo(() => (normalized ? availableCount(normalized) : 0), [normalized])
    const itemCount = config.limit > 0 ? Math.min(config.limit, available) : available
    const busy = status.kind === "syncing"
    const isNew = !saved && (state?.itemIds.length ?? 0) === 0

    const update = (change: Partial<SyncConfig>) => {
        setStatus({ kind: "editing" })
        setConfig(prev => ({ ...prev, ...change }))
    }
    const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

    const sync = async (plan: SyncPlan, next: SyncConfig) => {
        setStatus({ kind: "syncing" })
        await framer.setCloseWarning("Sync in progress. Closing the plugin stops it.")
        try {
            await applyPlan(collection, next, plan)
        } catch (error) {
            console.error(error)
            framer.notify(`Sync failed: ${errorText(error)}`, { variant: "error" })
            await framer.setCloseWarning(false)
            setStatus({ kind: "editing" })
            return
        }
        await framer.setCloseWarning(false)
        framer.closePlugin(resultMessage(plan), { variant: "success" })
    }

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!normalized || busy) return
        let plan: SyncPlan
        try {
            plan = await makePlan(collection, normalized)
        } catch (error) {
            console.error(error)
            framer.notify(`Could not read the collection: ${errorText(error)}`, { variant: "error" })
            return
        }
        const summary = removalSummary(plan, state?.fieldNames)
        // Removing items or fields from the collection asks first: layers bound to them lose their content.
        if (summary && status.kind !== "confirming") {
            setStatus({ kind: "confirming", plan, summary })
            return
        }
        await sync(plan, normalized)
    }

    const actionLabel = isNew ? `Import ${count(itemCount)} item${itemCount === 1 ? "" : "s"}` : `Sync ${count(itemCount)} item${itemCount === 1 ? "" : "s"}`

    return (
        <main className="cms framer-hide-scrollbar">
            <form onSubmit={event => submit(event).catch(ignoreClosed)}>
                <section className="block">
                    <Segmented
                        label="Data"
                        value={config.dataset}
                        options={[
                            { value: "calibers", label: "Calibers" },
                            { value: "products", label: "Guns and ammo" },
                        ]}
                        onChange={value => {
                            if (value !== config.dataset) update(defaultConfig(value as DatasetId))
                        }}
                        disabled={busy}
                    />
                    <p className="hint">{dataset.summary}</p>
                </section>

                <section className="block">
                    <h2>Include</h2>
                    {dataset.types.map(type => (
                        <label key={type.id} className="check-row">
                            <input
                                type="checkbox"
                                checked={config.types.includes(type.id)}
                                onChange={() => update({ types: toggle(config.types, type.id) })}
                                disabled={busy}
                            />
                            <span className="grow">{type.label}</span>
                            <span className="muted">{count(type.count)}</span>
                        </label>
                    ))}
                    {!normalized && <p className="warning">Select at least one.</p>}
                </section>

                <section className="block">
                    <label className="field-row">
                        <span className="grow">Items</span>
                        <select
                            value={config.limit}
                            onChange={event => update({ limit: Number(event.target.value) })}
                            disabled={busy}
                        >
                            {dataset.limits.map(limit => (
                                <option key={limit} value={limit}>
                                    {limit === 0 ? `All (${count(available)})` : count(limit)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <p className="hint">
                        {dataset.id === "products"
                            ? "Most listed first, one of each category in turn."
                            : "Most listed first."}
                        {itemCount > BASIC_PLAN_ITEMS && ` Framer's Basic plan allows ${count(BASIC_PLAN_ITEMS)} CMS items.`}
                    </p>
                </section>

                <section className="block">
                    <h2>Fields</h2>
                    {dataset.fields.map(field => (
                        <label key={field.id} className={`check-row field ${field.locked ? "locked" : ""}`}>
                            <input
                                type="checkbox"
                                checked={field.locked || config.fields.includes(field.id)}
                                onChange={() => update({ fields: toggle(config.fields, field.id) })}
                                disabled={busy || field.locked}
                            />
                            <span className="field-text">
                                <span>{field.name}</span>
                                <span className="muted">{field.help}</span>
                            </span>
                        </label>
                    ))}
                </section>

                <footer>
                    <hr />
                    {status.kind === "confirming" ? (
                        <div className="confirm" role="alert">
                            <p>
                                This removes {status.summary} from the collection. Layers bound to them lose their
                                content.
                            </p>
                            <div className="row">
                                <button type="button" onClick={() => setStatus({ kind: "editing" })}>
                                    Cancel
                                </button>
                                <button type="submit" className="danger">
                                    Remove and sync
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="submit"
                            className="framer-button-primary"
                            disabled={!normalized || busy || !isAllowed || itemCount === 0}
                            title={isAllowed ? undefined : "You need permission to edit this collection"}
                        >
                            {busy ? <div className="framer-spinner" /> : actionLabel}
                        </button>
                    )}
                    {!isAllowed && <p className="warning">You need edit access to this project to sync.</p>}
                    <Attribution snapshot={SNAPSHOT} />
                </footer>
            </form>
        </main>
    )
}
