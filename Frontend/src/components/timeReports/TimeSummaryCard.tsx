import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

type Props = {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  amount?: number;
  daysReported: number;
  Titel?: string;
  sick?: number;
  vacation?: number;
};

export function TimeSummaryCard({
  totalHours,
  billableHours,
  nonBillableHours,
  daysReported,
  sick = 0,
  vacation = 0,
  Titel,
}: Props) {
  return (
    <Card
      className="rounded-2xl shadow-sm pt-2 pb-3"
      aria-label="Time report summary"
    >
      <CardHeader>
        <CardTitle className="text-lg text-center">
          {Titel ?? "Monthly overview"}
        </CardTitle>
      </CardHeader>

      <CardContent
        className="
          grid gap-4 text-center
          grid-cols-2
          sm:grid-cols-3
          xl:grid-cols-6
        "
      >
        <SummaryItem label="Total hours" value={totalHours} />
        <SummaryItem label="Billable" value={billableHours} />
        <SummaryItem label="Non-billable" value={nonBillableHours} />
        <SummaryItem label="Days reported" value={daysReported} />
        <SummaryItem label="Sick" value={sick} />
        <SummaryItem label="Vacation" value={vacation} />
      </CardContent>
    </Card>
  );
}

/* ---------------- helper ---------------- */

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[72px]">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
