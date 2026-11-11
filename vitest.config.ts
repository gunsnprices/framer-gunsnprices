import { defineConfig } from "vitest/config"

// Unit tests run in Node without the Framer plugins of vite.config.ts.
export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
        environment: "node",
    },
})
