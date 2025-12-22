type ArticleMode = "all" | "registered" | "custom";

type Props = {
  value: ArticleMode;
  onChange: (v: ArticleMode) => void;
};

/**
 * ArticleModeSwitch
 *
 * Small segmented control for switching article filter mode.
 * Uses buttons instead of radios for simplicity and styling.
 *
 * - Fully controlled via props
 * - No internal state
 * - Accessible via aria-pressed
 */
export const ArticleModeSwitch = ({ value, onChange }: Props) => {
  const options: { value: ArticleMode; label: string }[] = [
    { value: "all", label: "All" },
    { value: "registered", label: "Registered" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div
      className="inline-flex rounded-lg border bg-background p-1"
      role="group"
      aria-label="Article mode"
    >
      {options.map((opt) => {
        const active = value === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              active ? "bg-muted" : "hover:bg-muted/60"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
