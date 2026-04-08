"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import {
  updateExpenseAction,
  deleteExpenseAction,
  type ExpenseActionState,
} from "@/app/dashboard/expenses/actions";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CategoryOption = { id: string; name: string };
type ExpenseRow = {
  id: string;
  category: string;
  amount: string;
  date: string;
  notes: string | null;
  amountFormatted: string;
};

const initial: ExpenseActionState = {};

export function ExpenseTable({
  expenses,
  categories,
}: {
  expenses: ExpenseRow[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const { currencySymbol } = useAppCurrency();

  const [editRow, setEditRow] = useState<ExpenseRow | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [editState, editAction, editPending] = useActionState(
    updateExpenseAction,
    initial,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteExpenseAction,
    initial,
  );

  useEffect(() => {
    if (editState.ok) {
      setEditRow(null);
      toast.success("Expense updated");
      router.refresh();
    } else if (editState.error) {
      toast.error(editState.error);
    }
  }, [editState, router]);

  useEffect(() => {
    if (deleteState.ok) {
      setDeleteTarget(null);
      toast.success("Expense deleted");
      router.refresh();
    } else if (deleteState.error) {
      toast.error(deleteState.error);
    }
  }, [deleteState, router]);

  function openEdit(row: ExpenseRow) {
    setEditRow(row);
    setEditCategory(row.category);
    setEditAmount(row.amount);
    setEditDate(row.date);
    setEditNotes(row.notes ?? "");
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Category</th>
              <th className="pb-2 pr-4 font-medium">Notes</th>
              <th className="pb-2 pr-4 font-medium text-right">Amount</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="py-2 pr-4 whitespace-nowrap">{e.date}</td>
                <td className="py-2 pr-4">{e.category}</td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {e.notes ?? "—"}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums font-medium">
                  {e.amountFormatted}
                </td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(e)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => setDeleteTarget(e.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!expenses.length ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No expenses recorded yet. Use the form above to add one.
          </p>
        ) : null}
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editRow !== null}
        onOpenChange={(open) => {
          if (!open) setEditRow(null);
        }}
      >
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              fd.set("id", editRow?.id ?? "");
              fd.set("category", editCategory);
              fd.set("amount", editAmount);
              fd.set("date", editDate);
              fd.set("notes", editNotes);
              editAction(fd);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                {!categories.some((c) => c.name === editCategory) && editCategory && (
                  <option value={editCategory}>{editCategory}</option>
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({currencySymbol})</Label>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="e.g. warehouse rent April"
              />
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditRow(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editPending}>
                {editPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>
              This will permanently remove this expense record. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) => {
              fd.set("id", deleteTarget ?? "");
              deleteAction(fd);
            }}
          >
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
              >
                Keep
              </Button>
              <Button type="submit" variant="destructive" disabled={deletePending}>
                {deletePending ? "Deleting…" : "Confirm delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
