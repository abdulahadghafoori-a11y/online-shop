import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "default" | "positive" | "negative";
}

export function MetricCard({
  label,
  value,
  sub,
  variant = "default",
}: MetricCardProps) {
  const color =
    variant === "positive"
      ? "text-green-600 dark:text-green-500"
      : variant === "negative"
        ? "text-destructive"
        : "text-foreground";

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tabular-nums", color)}>
          {value}
        </p>
        {sub ? (
          <p className="text-muted-foreground mt-1 text-xs">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
