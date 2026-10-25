"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function CanceledToast() {
  useEffect(() => {
    toast("Checkout canceled. You haven't been charged.");
  }, []);
  return null;
}
