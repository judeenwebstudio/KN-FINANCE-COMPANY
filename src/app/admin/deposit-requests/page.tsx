import { redirect } from "next/navigation";

export default function AdminDepositRequestsPage() {
  redirect("/admin/deposits?tab=requests");
}
