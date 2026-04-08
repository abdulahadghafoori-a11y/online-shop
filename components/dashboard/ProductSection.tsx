"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
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
import { Pencil, Plus, Package, Trash2, Search, AlertTriangle } from "lucide-react";

export type ProductCatalogRow = {
  id: string;
  name: string;
  sku: string;
  defaultsaleprice: number;
  isactive: boolean;
  stockonhand: number;
  avgcost: number;
  inventoryvalue: number;
  wa_message: string | null;
  description: string | null;
  image_url: string | null;
  reorder_point: number;
  unitssold: number;
};

const initialAction: ProductActionState = {};

type StatusFilter = "all" | "active" | "inactive";

export function ProductSection({ rows }: { rows: ProductCatalogRow[] }) {
  const { formatMoney, baseToDisplay, currencySymbol } = useAppCurrency();
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<ProductCatalogRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<ProductCatalogRow | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [addState, addAction, addPending] = useActionState(
    createProductAction,
    initialAction
  );
  const [editState, editAction, editPending] = useActionState(
    updateProductAction,
    initialAction
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteProductAction,
    initialAction
  );

  useEffect(() => {
    if (addState.ok) setAddOpen(false);
  }, [addState.ok]);

  useEffect(() => {
    if (editState.ok) setEditRow(null);
  }, [editState.ok]);

  useEffect(() => {
    if (deleteState.ok) {
      setDeleteRow(null);
      toast.success("Product deleted");
    } else if (deleteState.error) {
      toast.error(deleteState.error);
    }
  }, [deleteState]);

  useEffect(() => {
    if (addState.error) toast.error(addState.error);
    else if (addState.ok) toast.success("Product created");
  }, [addState]);

  useEffect(() => {
    if (editState.error) toast.error(editState.error);
    else if (editState.ok) toast.success("Product updated");
  }, [editState]);

  const filtered = rows.filter((r) => {
    if (statusFilter === "active" && !r.isactive) return false;
    if (statusFilter === "inactive" && r.isactive) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const lowStockCount = rows.filter(
    (r) => r.reorder_point > 0 && r.stockonhand <= r.reorder_point && r.isactive
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm">
            SKUs are generated automatically. <strong>WAC</strong> updates from
            receipts and purchase receives.
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add product
        </Button>
      </div>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <strong>{lowStockCount}</strong> product{lowStockCount > 1 ? "s" : ""} at
            or below reorder point.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Inactive products are hidden on new orders. Open a product to
            receive stock and view receipt history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "active", "inactive"] as StatusFilter[]).map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={statusFilter === v ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(v)}
                  className="capitalize"
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">WAC</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="px-3 py-2 text-right font-medium">On hand</th>
                  <th className="px-3 py-2 text-right font-medium">Sold</th>
                  <th className="px-3 py-2 text-right font-medium">Inv. value</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => {
                  const margin =
                    r.defaultsaleprice > 0
                      ? ((r.defaultsaleprice - r.avgcost) / r.defaultsaleprice) *
                        100
                      : null;
                  const isLowStock =
                    r.reorder_point > 0 &&
                    r.stockonhand <= r.reorder_point &&
                    r.isactive;
                  return (
                    <tr
                      key={r.id}
                      className={isLowStock ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {r.image_url ? (
                            <img
                              src={r.image_url}
                              alt={r.name}
                              className="size-8 rounded object-cover"
                            />
                          ) : null}
                          <span className="font-medium">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(r.defaultsaleprice)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatMoney(r.avgcost)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {margin != null && Number.isFinite(margin)
                          ? `${margin.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className="flex items-center justify-end gap-1">
                          {r.stockonhand}
                          {isLowStock && (
                            <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.unitssold}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(r.inventoryvalue)}
                      </td>
                      <td className="px-3 py-2">
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
                      <td className="px-3 py-2 text-right">
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
            {!filtered.length ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {rows.length === 0
                  ? "No products yet. Add your first SKU to use it on orders."
                  : "No products match the current filter."}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ── Add product dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
            <DialogDescription>
              Creates a product with an auto-generated SKU. Optional initial unit
              cost seeds WAC before the first receipt.
            </DialogDescription>
          </DialogHeader>
          <form action={addAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name</Label>
              <Input id="add-name" name="name" required autoComplete="off" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-desc">Description <span className="font-normal">(optional)</span></Label>
              <textarea
                id="add-desc"
                name="description"
                rows={2}
                placeholder="Internal notes, supplier info…"
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-image">Image URL <span className="font-normal">(optional)</span></Label>
              <Input id="add-image" name="image_url" type="url" placeholder="https://…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-price">
                  Sale price <span className="text-muted-foreground font-normal tabular-nums">({currencySymbol})</span>
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
                  Initial cost <span className="text-muted-foreground font-normal tabular-nums">({currencySymbol})</span>
                  {" "}<span className="font-normal">(opt.)</span>
                </Label>
                <Input
                  id="add-initial-cost"
                  name="initialunitcost"
                  type="number"
                  step="0.01"
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-reorder">Reorder point</Label>
                <Input
                  id="add-reorder"
                  name="reorder_point"
                  type="number"
                  min={0}
                  defaultValue={0}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-active">Status</Label>
                <select
                  id="add-active"
                  name="isactive"
                  defaultValue="true"
                  required
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-wa-message">
                WhatsApp message <span className="font-normal">(optional)</span>
              </Label>
              <textarea
                id="add-wa-message"
                name="wa_message"
                rows={3}
                placeholder={"Salam! I want to order {product}.\n\nCode: {code}"}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
              />
              <p className="text-muted-foreground text-xs">
                Use <code className="text-xs">{"{product}"}</code> and{" "}
                <code className="text-xs">{"{code}"}</code> as placeholders.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addPending}>
                {addPending ? "Saving…" : "Create product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit product dialog ── */}
      <Dialog
        open={editRow != null}
        onOpenChange={(o) => !o && setEditRow(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              SKU stays fixed after creation. Use Inventory to receive stock
              and update WAC.
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
                <Label htmlFor="edit-desc">Description</Label>
                <textarea
                  id="edit-desc"
                  name="description"
                  rows={2}
                  defaultValue={editRow.description ?? ""}
                  placeholder="Internal notes, supplier info…"
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-image">Image URL</Label>
                <Input
                  id="edit-image"
                  name="image_url"
                  type="url"
                  defaultValue={editRow.image_url ?? ""}
                  placeholder="https://…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-price">
                    Sale price <span className="text-muted-foreground font-normal tabular-nums">({currencySymbol})</span>
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
                  <Label htmlFor="edit-reorder">Reorder point</Label>
                  <Input
                    id="edit-reorder"
                    name="reorder_point"
                    type="number"
                    min={0}
                    defaultValue={editRow.reorder_point}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-active">Status</Label>
                <select
                  id="edit-active"
                  name="isactive"
                  defaultValue={editRow.isactive ? "true" : "false"}
                  required
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-wa-message">WhatsApp message</Label>
                <textarea
                  id="edit-wa-message"
                  name="wa_message"
                  rows={3}
                  defaultValue={editRow.wa_message ?? ""}
                  placeholder={"Salam! I want to order {product}.\n\nCode: {code}"}
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
                />
                <p className="text-muted-foreground text-xs">
                  Use <code className="text-xs">{"{product}"}</code> and{" "}
                  <code className="text-xs">{"{code}"}</code> as placeholders.
                </p>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setEditRow(null);
                    setDeleteRow(editRow);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
                <Button type="submit" disabled={editPending}>
                  {editPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog
        open={deleteRow != null}
        onOpenChange={(o) => !o && setDeleteRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteRow?.name}</strong> ({deleteRow?.sku}).
              Products with existing orders cannot be deleted — set them to Inactive instead.
            </DialogDescription>
          </DialogHeader>
          {deleteRow ? (
            <form action={deleteAction}>
              <input type="hidden" name="id" value={deleteRow.id} />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteRow(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={deletePending}>
                  {deletePending ? "Deleting…" : "Delete permanently"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
