"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import {
  createCategoryAction,
  updateCategoryAction,
  type ExpenseActionState,
} from "@/app/dashboard/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CategoryOption = { id: string; name: string };

const initial: ExpenseActionState = {};

export function CategoryManager({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editCat, setEditCat] = useState<CategoryOption | null>(null);
  const [editName, setEditName] = useState("");

  const [createState, createAction, createPending] = useActionState(
    createCategoryAction,
    initial,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateCategoryAction,
    initial,
  );

  useEffect(() => {
    if (createState.ok) {
      setNewName("");
      toast.success("Category added");
      router.refresh();
    } else if (createState.error) {
      toast.error(createState.error);
    }
  }, [createState, router]);

  useEffect(() => {
    if (updateState.ok) {
      setEditCat(null);
      toast.success("Category renamed");
      router.refresh();
    } else if (updateState.error) {
      toast.error(updateState.error);
    }
  }, [updateState, router]);

  function openEdit(cat: CategoryOption) {
    setEditCat(cat);
    setEditName(cat.name);
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <div
            key={c.id}
            className="bg-muted flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm"
          >
            <span>{c.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5"
              onClick={() => openEdit(c)}
            >
              <Pencil className="size-3" />
            </Button>
          </div>
        ))}
      </div>

      <form
        action={(fd) => {
          fd.set("name", newName.trim());
          createAction(fd);
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="max-w-xs"
          required
        />
        <Button type="submit" size="sm" disabled={createPending}>
          <Plus className="size-3.5 mr-1" />
          {createPending ? "Adding…" : "Add"}
        </Button>
      </form>

      <Dialog
        open={editCat !== null}
        onOpenChange={(open) => {
          if (!open) setEditCat(null);
        }}
      >
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              fd.set("id", editCat?.id ?? "");
              fd.set("name", editName.trim());
              updateAction(fd);
            }}
            className="space-y-4"
          >
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <p className="text-muted-foreground text-xs">
              All existing expenses with the old name will be updated to the new
              name.
            </p>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCat(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updatePending}>
                {updatePending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
