"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";

const expenseData = [
  { month: "Mar", amount: 38 }, { month: "Apr", amount: 55 }, { month: "May", amount: 43 },
  { month: "Jun", amount: 70 }, { month: "Jul", amount: 62 }, { month: "Aug", amount: 79 }, { month: "Sep", amount: 68 },
];
const movementData = [
  { month: "Mar", deposits: 52, withdrawals: 32 }, { month: "Apr", deposits: 68, withdrawals: 38 },
  { month: "May", deposits: 60, withdrawals: 44 }, { month: "Jun", deposits: 82, withdrawals: 48 },
  { month: "Jul", deposits: 74, withdrawals: 52 }, { month: "Aug", deposits: 91, withdrawals: 58 },
  { month: "Sep", deposits: 78, withdrawals: 46 },
];

function ChartHeader({ title, subtitle, accent }: { title: string; subtitle: string; accent: string }) {
  return <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><span className={`mt-1 size-2.5 rounded-full ${accent}`} aria-hidden="true" /></div>;
}
const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,.08)", fontSize: 12 };

export function ExpenseChart() {
  return <Card className="p-5 md:p-6"><ChartHeader title="Expense Overview" subtitle="Monthly operating expense trend" accent="bg-amber-500"/><div className="h-64 w-full" aria-label="Expense overview chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={expenseData} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}><CartesianGrid stroke="#eef0f4" strokeDasharray="4 4" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }}/><Tooltip cursor={{ fill: "#fffbeb" }} contentStyle={tooltipStyle}/><Bar dataKey="amount" name="Expense index" fill="#f59e0b" radius={[6,6,2,2]} maxBarSize={34}/></BarChart></ResponsiveContainer></div></Card>;
}

export function MovementChart() {
  return <Card className="p-5 md:p-6"><ChartHeader title="Deposit & Withdraw Analytics" subtitle="Monthly request activity comparison" accent="bg-emerald-500"/><div className="h-64 w-full" aria-label="Deposit and withdrawal analytics chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={movementData} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barGap={4}><CartesianGrid stroke="#eef0f4" strokeDasharray="4 4" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }}/><Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={tooltipStyle}/><Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 12 }}/><Bar dataKey="deposits" name="Deposits" fill="#10b981" radius={[5,5,2,2]} maxBarSize={24}/><Bar dataKey="withdrawals" name="Withdrawals" fill="#f43f5e" radius={[5,5,2,2]} maxBarSize={24}/></BarChart></ResponsiveContainer></div></Card>;
}
