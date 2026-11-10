"use client";
import { use } from "react";
import { ErrorBox, Loading, Page, PageHeader } from "@/components/ui";
import { OrderForm } from "@/components/OrderForm";
import { useAuth } from "@/components/providers";
import { useData } from "@/lib/hooks";
import { db } from "@/lib/db";

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { canEdit } = useAuth();
  const { data, error, loading, reload } = useData(async () => {
    const [customers, products, rates, draft, planStatus] = await Promise.all([
      db.customers(), db.products(), db.latestRates(), db.loadOrderDraft(id), db.planStatus(id),
    ]);
    return { customers, products, rates, draft, planStatus };
  }, [id], { refetchOnFocus: false });

  if (!canEdit) return <Page><ErrorBox error="Düzenlemek için editör yetkisi gerekli." /></Page>;
  return (
    <>
      <PageHeader title={data ? `Sipariş düzenle · ${data.draft.order.order_number}` : "Sipariş düzenle"} />
      <Page>
        {loading ? <Loading /> : error || !data ? <ErrorBox error={error || "Yüklenemedi"} onRetry={reload} /> : (
          <OrderForm initial={data.draft} customers={data.customers} products={data.products} rates={data.rates} planStatus={data.planStatus} />
        )}
      </Page>
    </>
  );
}
