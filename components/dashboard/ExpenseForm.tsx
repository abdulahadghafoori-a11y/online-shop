"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createExpenseAction,
  type ExpenseActionState,
} from "@/app/dashboard/expenses/actions";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CategoryOption = { id: string; name: string };

const initial: ExpenseActionState = {};

export function ExpenseForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const { currencySymbol } = useAppCurrency();
  const [category, setCategory] = useState(categories[0]?.name ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");

  const [state, action, pending] = useActionState(createExpenseAction, initial);

  useEffect(() => {
    if (state.ok) {
      setAmount("");
      setNotes("");
      toast.success("Expense recorded");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add expense</CardTitle>
        <CardDescription>
          Record an operational cost. Amounts entered in your display currency
          are converted to book currency.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) => {
            fd.set("category", category);
            fd.set("amount", amount);
            fd.set("date", date);
            fd.set("notes", notes);
            action(fd);
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label>Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Amount ({currencySymbol})</Label>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. warehouse rent April"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add expense"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
