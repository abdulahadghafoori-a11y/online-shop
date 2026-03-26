"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createProductAction,
  updateProductAction,
  addProductCostAction,
  type ProductActionState,
} from "@/app/dashboard/products/actions";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pencil, Plus, Receipt } from "lucide-react";

export type ProductCatalogRow = {
  id: string;
  name: string;
  sku: string;
  defaultsaleprice: number;
  isactive: boolean;
  stockonhand: number;
  latestunitcost: number | null;
};

const initialAction: ProductActionState = {};

function ActionError({ state }: { state: ProductActionState }) {
  if (!state.error) return null;
  return (
    <p className="text-destructive text-sm" role="alert">
      {state.error}
    </p>
  );
}

export function ProductSection({ rows }: { rows: ProductCatalogRow[] }) {
  const { formatMoney, baseToDisplay } = useAppCurrency();
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<ProductCatalogRow | null>(null);
  const [costRow, setCostRow] = useState<ProductCatalogRow | null>(null);

  const [addState, addAction, addPending] = useActionState(
    createProductAction,
    initialAction
  );
  const [editState, editAction, editPending] = useActionState(
    updateProductAction,
    initialAction
  );
  const [costState, costAction, costPending] = useActionState(
    addProductCostAction,
    initialAction
  );

  useEffect(() => {
    if (addState.ok) setAddOpen(false);
  }, [addState.ok]);

  useEffect(() => {
    if (editState.ok) setEditRow(null);
  }, [editState.ok]);

  useEffect(() => {
    if (costState.ok) setCostRow(null);
  }, [costState.ok]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm">
            SKUs are generated automatically. Pricing uses your sidebar display
            currency; database amounts are unchanged.
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Inactive products are hidden on new orders. COGS comes from the
            latest <code className="text-xs">productcosts</code> row at order
            time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Product</th>
                  <th className="pb-2 pr-4 font-medium">SKU</th>
                  <th className="pb-2 pr-4 font-medium text-right">
                    List price
                  </th>
                  <th className="pb-2 pr-4 font-medium text-right">
                    Unit cost
                  </th>
                  <th className="pb-2 pr-4 font-medium text-right">Margin</th>
                  <th className="pb-2 pr-4 font-medium text-right">On hand</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const margin =
                    r.latestunitcost != null && r.defaultsaleprice > 0
                      ? ((r.defaultsaleprice - r.latestunitcost) /
                          r.defaultsaleprice) *
                        100
                      : null;
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 font-medium">{r.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{r.sku}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatMoney(r.defaultsaleprice)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {r.latestunitcost != null
                          ? formatMoney(r.latestunitcost)
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {margin != null ? `${margin.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {r.stockonhand}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            r.isactive
                              ? "inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                              : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {r.isactive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setEditRow(r)}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setCostRow(r)}
                          >
                            <Receipt className="size-3.5" />
                            Cost
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No products yet. Add your first SKU to use it on orders.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
            <DialogDescription>
              Creates a row in <code className="text-xs">products</code> with an
              auto-generated SKU. Optional initial cost adds a{" "}
              <code className="text-xs">productcosts</code> row.
            </DialogDescription>
          </DialogHeader>
          <form action={addAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name</Label>
              <Input id="add-name" name="name" required autoComplete="off" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-price">Default sale price</Label>
              <Input
                id="add-price"
                name="defaultsaleprice"
                type="number"
                step="0.01"
                min={0}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-initial-cost">
                Initial unit cost <span className="font-normal">(optional)</span>
              </Label>
              <Input
                id="add-initial-cost"
                name="initialunitcost"
                type="number"
                step="0.01"
                min={0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-active">Status</Label>
              <select
                id="add-active"
                name="isactive"
                defaultValue="true"
                required
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-[3px] md:text-sm dark:bg-input/30"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <ActionError state={addState} />
            <DialogFooter>
              <Button type="submit" disabled={addPending}>
                {addPending ? "Saving…" : "Create product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editRow != null}
        onOpenChange={(o) => !o && setEditRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              SKU stays fixed after creation. To change COGS over time, use{" "}
              <strong>Cost</strong> (new history row).
            </DialogDescription>
          </DialogHeader>
          {editRow ? (
            <form key={editRow.id} action={editAction} className="grid gap-4">
              <input type="hidden" name="id" value={editRow.id} />
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  required
                  defaultValue={editRow.name}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label>SKU</Label>
                <p className="bg-muted/50 rounded-md border px-2.5 py-2 font-mono text-sm">
                  {editRow.sku}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-price">Default sale price</Label>
                <Input
                  id="edit-price"
                  name="defaultsaleprice"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={baseToDisplay(editRow.defaultsaleprice)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-active">Status</Label>
                <select
                  id="edit-active"
                  name="isactive"
                  defaultValue={editRow.isactive ? "true" : "false"}
                  required
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-[3px] md:text-sm dark:bg-input/30"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <ActionError state={editState} />
              <DialogFooter>
                <Button type="submit" disabled={editPending}>
                  {editPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={costRow != null}
        onOpenChange={(o) => !o && setCostRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record unit cost</DialogTitle>
            <DialogDescription>
              Appends a row to <code className="text-xs">productcosts</code>
              {costRow ? (
                <>
                  {" "}
                  for <strong>{costRow.name}</strong> ({costRow.sku}).
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {costRow ? (
            <form key={costRow.id} action={costAction} className="grid gap-4">
              <input type="hidden" name="productid" value={costRow.id} />
              <div className="grid gap-2">
                <Label htmlFor="cost-value">New unit cost</Label>
                <Input
                  id="cost-value"
                  name="unitcost"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  autoFocus
                />
              </div>
              <ActionError state={costState} />
              <DialogFooter>
                <Button type="submit" disabled={costPending}>
                  {costPending ? "Saving…" : "Add cost row"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
