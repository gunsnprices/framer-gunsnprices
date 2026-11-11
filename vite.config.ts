import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import framer from "vite-plugin-framer"
import mkcert from "vite-plugin-mkcert"

// Same setup as the official Framer plugin template. The dev server runs on https://localhost:5173 with a local
// certificate from mkcert. PLUGIN_HTTP=1 serves plain HTTP instead (no certificate), for a quick check outside Framer.
const http = process.env.PLUGIN_HTTP === "1"

export default defineConfig({
    plugins: [react(), ...(http ? [] : [mkcert()]), framer()],
    build: {
        // The source maps carry the readable source of every module into dist/ and plugin.zip.
        sourcemap: true,
        // The offline data (src/data/catalog.json, about 530 kB) is part of the one script.
        chunkSizeWarningLimit: 1024,
    },
})
