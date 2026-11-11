import "@framer/plugin/framer.css"
import "./App.css"

import { FramerPluginClosedError, framer } from "@framer/plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { CanvasApp } from "./canvas/CanvasApp"
import { parseConfig } from "./core/collection"
import { CmsApp } from "./cms/CmsApp"
import { PLUGIN_KEYS, syncWithoutUI } from "./cms/sync"

function render(node: React.ReactNode) {
    const root = document.getElementById("root")
    if (!root) throw new Error("Root element not found")
    createRoot(root).render(<StrictMode>{node}</StrictMode>)
}

async function start() {
    if (framer.mode === "configureManagedCollection" || framer.mode === "syncManagedCollection") {
        const collection = await framer.getActiveManagedCollection()
        const saved = parseConfig(await collection.getPluginData(PLUGIN_KEYS.CONFIG))

        // "Sync" in the CMS: repeat the saved settings with no panel. Without saved settings (or permission), or
        // when the sync fails, the panel opens.
        const synced = framer.mode === "syncManagedCollection" && saved !== null && (await syncWithoutUI(collection, saved))
        if (!synced) render(<CmsApp collection={collection} saved={saved} />)
        return
    }
    render(<CanvasApp />)
}

start().catch((error: unknown) => {
    // closePlugin ends the plugin by throwing FramerPluginClosedError; Framer says to ignore it.
    if (!(error instanceof FramerPluginClosedError)) throw error
})
