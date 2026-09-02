import { redirect } from "next/navigation";

export default function AdminWithdrawalRequestsPage() {
  redirect("/admin/withdrawals?tab=requests");
}
