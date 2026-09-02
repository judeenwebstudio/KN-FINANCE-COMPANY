import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { moduleTitles } from "@/lib/navigation";
export default async function MemberModulePage({ params }: { params: Promise<{ module: string }> }) { const { module } = await params; const title = moduleTitles[`/member/${module}`]; if (!title || module === "dashboard") notFound(); return <ModulePlaceholder title={title}/>; }
