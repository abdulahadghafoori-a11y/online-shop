"use client";

import { Toaster } from "sonner";

/** Sonner toasts — top-right fly-ins. Import `toast` from `sonner` in client components. */
export function ToasterApp() {
  return (
    <Toaster
      position="top-right"
      offset={{ top: "4.5rem", right: "1rem" }}
      richColors
      closeButton
      duration={6000}
      toastOptions={{
        classNames: {
          toast:
            "group border-border bg-card text-foreground shadow-lg backdrop-blur-sm",
        },
      }}
    />
  );
}
