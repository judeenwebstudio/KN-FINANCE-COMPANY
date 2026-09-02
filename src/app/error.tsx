"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-2xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-slate-500">We could not load this view. Please try again.</p><Button className="mt-5" onClick={reset}>Try again</Button></div></div>; }
