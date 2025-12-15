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
    <Card className="group hover:shadow-md transition-shadow rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
            {t.name}
          </CardTitle>
          <Badge
            variant="secondary"
            className="shrink-0 flex items-center gap-1"
          >
            <Tag className="h-3.5 w-3.5" aria-hidden="true" /> {categoryName}
          </Badge>
        </div>
        <CardDescription className="mt-1 flex items-center gap-2">
          <User className="h-4 w-4" aria-hidden="true" />
          <span className="truncate">{companyName}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>{dateLabel || "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>{Number.isFinite(hours) ? hours.toFixed(2) : "—"} h</span>
        </div>
        {(t as any).work_labor ? (
          <p className="text-sm text-foreground/90 line-clamp-2">
            {(t as any).work_labor}
          </p>
        ) : null}
      </CardContent>

      <Separator />

      <CardFooter className="pt-3">
        <Button
          size="sm"
          variant="destructive"
          className="rounded-xl w-full"
          type="button"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
};
