// Small shared controls, styled with Framer's plugin CSS variables (src/App.css).
import { SITE } from "./core/catalog"

interface SegmentedProps<T extends string> {
    label: string
    value: T
    options: readonly { value: T; label: string }[]
    onChange: (value: T) => void
    disabled?: boolean
}

export function Segmented<T extends string>({ label, value, options, onChange, disabled }: SegmentedProps<T>) {
    return (
        <div className="segmented" role="radiogroup" aria-label={label}>
            {options.map(option => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={option.value === value}
                    className={option.value === value ? "active" : undefined}
                    onClick={() => onChange(option.value)}
                    disabled={disabled}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

/** the CC BY 4.0 credit for the bundled data */
export function Attribution({ snapshot }: { snapshot: string }) {
    return (
        <p className="attribution">
            Data:{" "}
            <a href={SITE} target="_blank" rel="noopener">
                GunsNPrices
            </a>
            , CC BY 4.0. Prices of {snapshot}, US stores.
        </p>
    )
}
