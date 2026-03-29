import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OrderNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Order not found</h1>
      <p className="text-muted-foreground text-sm">
        That ID does not exist or is not visible to your account. Check the link
        or open the order from the orders list.
      </p>
      <Button asChild variant="outline" className="w-fit">
        <Link href="/dashboard/orders">Back to orders</Link>
      </Button>
    </div>
  );
}
