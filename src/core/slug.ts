// CMS item slugs. scripts/build-data.mjs uses the same rules for item IDs.

/** "9×19mm Parabellum" → "9x19mm-parabellum", ".38 S&W Special" → "38-sw-special" */
export function slugify(text: string): string {
    return text
        .normalize("NFKD")
        .replace(/×/g, "x")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/(\w)&(\w)/g, "$1$2")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

/** a slug of at most `max` characters, cut at a hyphen when possible */
export function shortSlug(text: string, max = 80): string {
    const slug = slugify(text)
    if (slug.length <= max) return slug
    const cut = slug.slice(0, max)
    const hyphen = cut.lastIndexOf("-")
    return (hyphen > max / 2 ? cut.slice(0, hyphen) : cut).replace(/-+$/, "")
}

/** makes slugs unique in order of appearance: "a", "a" → "a", "a-2" */
export function uniqueSlugs(slugs: readonly string[]): string[] {
    const used = new Set<string>()
    return slugs.map(base => {
        const start = base || "item"
        let slug = start
        for (let n = 2; used.has(slug); n++) slug = `${start}-${n}`
        used.add(slug)
        return slug
    })
}
