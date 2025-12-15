import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "../../components/ui/command";
import { Card, CardContent } from "../../components/ui/card";
import type { Article, ReportItemInput } from "../../models/Article";

type ItemRowProps = {
  onAdd: (item: ReportItemInput) => void;
  onSearch: (q: string) => Promise<Article[]>;
};

export function AddReportItemRow({ onAdd, onSearch }: ItemRowProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Article[]>([]);
  const [isOther, setIsOther] = useState(false);
  const [picked, setPicked] = useState<Article | null>(null);
  const OTHER_ARTICLE_ID = 1;

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(1);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);

  const [flag, setFlag] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) {
        setFlag(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      const s = q.trim();
      if (s.length < 2) {
        setResults([]);
        return;
      }
      const res = await onSearch(s);
      setResults(res);
    },
    [onSearch]
  );

  const pickArticle = (a: Article) => {
    setFlag(true);
    setIsOther(false);
    setPicked(a);
    setDescription(a.name);
    setPurchasePrice(null);
  };

  const pickOther = () => {
    setFlag(true);
    setIsOther(true);
    setPicked(null);
    setDescription("");
    setPurchasePrice(null);
  };

  const add = () => {
    const trimmedDesc = description.trim();
    if (!trimmedDesc) return;

    const articleId = isOther ? OTHER_ARTICLE_ID : picked?.id ?? OTHER_ARTICLE_ID;
    const basePrice = isOther ? purchasePrice : picked?.purchase_price ?? null;

    const payload: ReportItemInput = {
      articleId,
      description: trimmedDesc,
      amount: Math.max(1, Number(amount || 1)),
      purchasePrice:
        isOther && purchasePrice != null
          ? Number(purchasePrice)
          : basePrice,
    };

    onAdd(payload);

    // reset
    setQuery("");
    setResults([]);
    setIsOther(false);
    setPicked(null);
    setDescription("");
    setAmount(1);
    setPurchasePrice(null);
    setFlag(false);
  };

  return (
    <Card className="p-1" ref={boxRef}>
      <CardContent className="grid gap-3 p-1">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search article by name or number…"
            aria-label="Search article by name or number"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              void runSearch(v);
            }}
          />
          <CommandList>
            <CommandEmpty>No results</CommandEmpty>
            {results.map((a) => (
              <CommandItem
                key={a.id}
                onSelect={() => pickArticle(a)}
                value={a.name}
              >
                {a.name}
                {a.art_nr ? ` • ${a.art_nr}` : ""}
              </CommandItem>
            ))}
            <CommandItem onSelect={pickOther} value="__other">
              + Use custom (Other)
            </CommandItem>
          </CommandList>
        </Command>

        {flag && (
          <>
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                className="flex-1"
                placeholder={isOther ? "Custom description…" : "Description"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-label="Article description"
              />
              <Input
                className="w-20"
                type="number"
                min={1}
                value={amount}
                onChange={(e) =>
                  setAmount(
                    Math.max(1, Math.floor(Number(e.target.value) || 1))
                  )
                }
                placeholder="Qty"
                aria-label="Quantity"
              />
              {isOther && (
                <Input
                  className="w-32"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Purchase price"
                  aria-label="Purchase price"
                  value={purchasePrice ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setPurchasePrice(null);
                      return;
                    }
                    const n = Number(String(v).replace(",", "."));
                    setPurchasePrice(
                      Number.isFinite(n) ? Number(n.toFixed(2)) : null
                    );
                  }}
                />
              )}
            </div>

            <div className="flex justify-end pr-4">
              <Button type="button" onClick={add} disabled={!description.trim()}>
                Add item
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
