import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleTitles } from "@/lib/navigation";
export default async function AdminModulePage({ params }: { params: Promise<{ module: string }> }) { const { module } = await params; const title = moduleTitles[`/admin/${module}`]; if (!title || module === "dashboard") notFound(); return <ModulePlaceholder title={title}/>; }
