"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createProductAction,
  updateProductAction,
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
import { Pencil, Plus, Package } from "lucide-react";

export type ProductCatalogRow = {
  id: string;
  name: string;
  sku: string;
  defaultsaleprice: number;
  isactive: boolean;
  stockonhand: number;
  avgcost: number;
  inventoryvalue: number;
};

const initialAction: ProductActionState = {};

export function ProductSection({ rows }: { rows: ProductCatalogRow[] }) {
  const { formatMoney, baseToDisplay, currencySymbol } = useAppCurrency();
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<ProductCatalogRow | null>(null);

  const [addState, addAction, addPending] = useActionState(
    createProductAction,
    initialAction
  );
  const [editState, editAction, editPending] = useActionState(
    updateProductAction,
    initialAction
  );

  useEffect(() => {
    if (addState.ok) setAddOpen(false);
  }, [addState.ok]);

  useEffect(() => {
    if (editState.ok) setEditRow(null);
  }, [editState.ok]);

  useEffect(() => {
    if (addState.error) toast.error(addState.error);
    else if (addState.ok) toast.success("Product created");
  }, [addState]);

  useEffect(() => {
    if (editState.error) toast.error(editState.error);
    else if (editState.ok) toast.success("Product updated");
  }, [editState]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm">
            SKUs are generated automatically. <strong>WAC</strong> updates from
            receipts and purchase receives. Enter cost breakdown on purchase
            lines or <strong>Receive stock</strong>.
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
            Inactive products are hidden on new orders. Open a product to
            receive stock and view receipt history.
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
                    Avg cost (WAC)
                  </th>
                  <th className="pb-2 pr-4 font-medium text-right">Margin</th>
                  <th className="pb-2 pr-4 font-medium text-right">On hand</th>
                  <th className="pb-2 pr-4 font-medium text-right">
                    Inv. value
                  </th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const margin =
                    r.defaultsaleprice > 0
                      ? ((r.defaultsaleprice - r.avgcost) / r.defaultsaleprice) *
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
                        {formatMoney(r.avgcost)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {margin != null && Number.isFinite(margin)
                          ? `${margin.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {r.stockonhand}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatMoney(r.inventoryvalue)}
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
                          <Button type="button" variant="ghost" size="sm" asChild>
                            <Link
                              href={`/dashboard/products/${r.id}`}
                              className="h-8 px-2"
                            >
                              <Package className="size-3.5" />
                              Inventory
                            </Link>
                          </Button>
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
              auto-generated SKU. Optional initial unit cost seeds{" "}
              <code className="text-xs">avg_cost</code> before the first receipt.
              Detailed costing uses purchases or Receive stock.
            </DialogDescription>
          </DialogHeader>
          <form action={addAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name</Label>
              <Input id="add-name" name="name" required autoComplete="off" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-price">
                Default sale price{" "}
                <span className="text-muted-foreground font-normal tabular-nums">
                  ({currencySymbol})
                </span>
              </Label>
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
                Initial unit cost{" "}
                <span className="text-muted-foreground font-normal tabular-nums">
                  ({currencySymbol})
                </span>{" "}
                <span className="font-normal">(optional)</span>
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
              SKU stays fixed after creation. Use{" "}
              <strong>Inventory</strong> to receive stock and update WAC.
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
                <Label htmlFor="edit-price">
                  Default sale price{" "}
                  <span className="text-muted-foreground font-normal tabular-nums">
                    ({currencySymbol})
                  </span>
                </Label>
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
              <DialogFooter>
                <Button type="submit" disabled={editPending}>
                  {editPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
