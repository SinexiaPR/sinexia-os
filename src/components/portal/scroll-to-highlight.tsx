"use client";

import { useEffect } from "react";

export function ScrollToHighlight({
  id,
  prefix,
}: {
  id?: string | null;
  prefix: string;
}) {
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(`${prefix}-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [id, prefix]);

  return null;
}
