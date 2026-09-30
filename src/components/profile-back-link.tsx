"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useFilters } from "@/hooks/use-filters";
import { viewHref } from "@/lib/directory";

// URL state is a small client island, not an input to the cached profile page.
export function ProfileBackLink() {
    const { filters } = useFilters();
    return <Link href={viewHref("/mvps", filters)} className="back-link"><ArrowLeft size={14} aria-hidden="true" />Back to directory</Link>;
}