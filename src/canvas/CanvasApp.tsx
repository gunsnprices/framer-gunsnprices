// Canvas panel: pick an ammo box and add its cost per round as a text layer.
import { framer, useIsAllowedTo } from "@framer/plugin"
import { useLayoutEffect, useMemo, useState } from "react"
import { ammoCalibers, ammoText, isTextFormat, searchAmmo, TEXT_FORMATS, type TextFormat } from "../core/ammo-text"
import { type Ammo, SNAPSHOT } from "../core/catalog"
import { costPerRoundText, count, money } from "../core/format"
import { ammoPopular } from "../core/select"
import { Attribution } from "../ui"

// Panel preferences stay on this computer (localStorage), not in the project.
const PREFS_KEY = "gunsnprices-canvas"

interface Prefs {
    caliber: string
    format: TextFormat
}

function loadPrefs(): Prefs {
    const prefs: Prefs = { caliber: "", format: "rd" }
    try {
        const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Record<string, unknown>
        if (typeof saved.caliber === "string") prefs.caliber = saved.caliber
        if (isTextFormat(saved.format)) prefs.format = saved.format
    } catch {
        // storage blocked or unreadable: defaults
    }
    return prefs
}

function savePrefs(prefs: Prefs) {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
        // storage blocked: preferences are not remembered
    }
}

export function CanvasApp() {
    const [prefs, setPrefs] = useState(loadPrefs)
    const [query, setQuery] = useState("")
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [adding, setAdding] = useState(false)
    const canAddText = useIsAllowedTo("addText")

    useLayoutEffect(() => {
        void framer.showUI({ position: "top right", width: 300, height: 560, minWidth: 280, minHeight: 420, resizable: true })
    }, [])

    const calibers = useMemo(ammoCalibers, [])
    const caliber = calibers.some(c => c.name === prefs.caliber) ? prefs.caliber : ""
    const results = useMemo(() => searchAmmo(query, caliber), [query, caliber])
    const selected: Ammo | undefined = results.find(box => box.id === selectedId) ?? results[0]
    const text = selected ? ammoText(selected, prefs.format) : ""

    const setPref = (change: Partial<Prefs>) => {
        const next = { ...prefs, ...change }
        setPrefs(next)
        savePrefs(next)
    }

    const addText = async () => {
        if (!text || adding) return
        setAdding(true)
        try {
            await framer.addText(text)
            framer.notify(`Added “${text}”`, { variant: "success", durationMs: 2000 })
        } catch (error) {
            console.error(error)
            framer.notify("Could not add the text layer.", { variant: "error" })
        } finally {
            setAdding(false)
        }
    }

    return (
        <main className="canvas">
            <div className="block">
                <p className="hint">Pick an ammo box. The plugin adds its cost per round as a text layer.</p>
                <select
                    aria-label="Caliber"
                    className="wide"
                    value={caliber}
                    onChange={event => setPref({ caliber: event.target.value })}
                >
                    <option value="">All calibers ({count(ammoPopular().length)})</option>
                    {calibers.map(c => (
                        <option key={c.name} value={c.name}>
                            {c.name} ({c.count})
                        </option>
                    ))}
                </select>
                <input
                    type="text"
                    className="wide"
                    placeholder="Search ammo, e.g. federal 124gr"
                    aria-label="Search ammo"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                />
            </div>

            <ul className="ammo-list framer-hide-scrollbar" role="listbox" aria-label="Ammo boxes">
                {results.map(box => (
                    <li
                        key={box.id}
                        role="option"
                        aria-selected={box === selected}
                        className={box === selected ? "selected" : undefined}
                        onClick={() => setSelectedId(box.id)}
                        onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") setSelectedId(box.id)
                        }}
                        tabIndex={0}
                    >
                        <span className="title">{box.title}</span>
                        <span className="muted">
                            {box.rounds} rds · {money(box.price)} · {costPerRoundText(box.price, box.rounds)}
                        </span>
                    </li>
                ))}
                {results.length === 0 && <li className="empty">No ammo matches. Try fewer words or all calibers.</li>}
            </ul>

            <div className="block">
                <label className="field-row">
                    <span className="grow">Format</span>
                    <select value={prefs.format} onChange={event => setPref({ format: event.target.value as TextFormat })}>
                        {TEXT_FORMATS.map(f => (
                            <option key={f.id} value={f.id}>
                                {f.label}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="preview" aria-live="polite">
                    {text || "—"}
                </div>
                <button
                    type="button"
                    className="framer-button-primary"
                    disabled={!text || adding || !canAddText}
                    title={canAddText ? undefined : "You need edit access to add layers"}
                    onClick={() => void addText()}
                >
                    {adding ? <div className="framer-spinner" /> : "Add text layer"}
                </button>
                <p className="hint">For a CMS collection of calibers or products, open this plugin from the CMS.</p>
                <Attribution snapshot={SNAPSHOT} />
            </div>
        </main>
    )
}
