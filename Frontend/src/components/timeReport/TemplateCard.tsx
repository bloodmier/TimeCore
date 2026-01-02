// src/components/time/TemplateCard.tsx
import type { ReportTemplate } from "../../models/Draft";
import { Tag, User, Calendar, Clock, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../../components/ui/separator";

type TemplateCardProps = {
  t: ReportTemplate;
  companyName: string;
  categoryName: string;
  onDelete: () => void;
};

export const TemplateCard = ({
  t,
  companyName,
  categoryName,
  onDelete,
}: TemplateCardProps) => {
  const hours = Number(String(t.hours).replace(",", "."));
  const dateLabel = (t.date ?? "").slice(0, 10);

  return (
    <Card className="group w-full min-w-0 overflow-hidden rounded-2xl transition-shadow hover:shadow-md min-h-[260px] pt-4 pb-4">
      <CardHeader className="pb-2 min-w-0 ">
        <div className="flex items-start justify-between gap-2 min-w-0">
          {/* left block must be min-w-0 so line-clamp works */}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
              {t.name}
            </CardTitle>

            <CardDescription className="mt-1 flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{companyName}</span>
            </CardDescription>
          </div>

          {/* badge should never expand layout */}
          <Badge variant="secondary" className="shrink-0 flex items-center gap-1 max-w-[50%]">
            <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{categoryName}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 min-w-0 flex-1 ">
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{dateLabel || "—"}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {Number.isFinite(hours) ? hours.toFixed(2) : "—"} h
          </span>
        </div>

        {(t as any).work_labor ? (
          <p className="text-sm text-foreground/90 line-clamp-2 break-words">
            {(t as any).work_labor}
          </p>
        ) : null}
      </CardContent>

      <Separator />

      <CardFooter className="pt-3 min-w-0">
        <Button
          size="sm"
          variant="destructive"
          className="w-full rounded-xl"
          type="button"
          onClick={onDelete}
        >
          <Trash2 className="mr-1 h-4 w-4 shrink-0" aria-hidden="true" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
};
