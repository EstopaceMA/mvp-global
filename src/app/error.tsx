"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main-content" className="not-found page-container"><h1>We couldn’t load this view.</h1><p>Please try again, or return to the atlas.</p><div className="flex gap-4"><Button onClick={reset}>Try again</Button><Button asChild variant="outline"><Link href="/">Open the atlas</Link></Button></div></main>;
}
