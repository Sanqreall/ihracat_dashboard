"use client";
import { Badge } from "./ui";
import { ORDER_STATUSES, PLAN_STATUSES, PLAN_TYPES, labelOf, orderStatusTone } from "@/lib/constants";

export const OrderStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={orderStatusTone(status)}>{labelOf(ORDER_STATUSES, status)}</Badge>
);

export const PlanStatusBadge = ({ status, days }: { status: string; days?: number }) => {
  const s = PLAN_STATUSES[status] || { label: status, tone: "muted" as const };
  return <Badge tone={s.tone}>{s.label}{status === "overdue" && days ? ` · ${days} gün` : ""}</Badge>;
};

export const planTypeLabel = (t?: string | null) => labelOf(PLAN_TYPES, t);
