"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorBox, Loading, Page, PageHeader } from "@/components/ui";
import { OrderForm } from "@/components/OrderForm";
import { useAuth } from "@/components/providers";
import { useData } from "@/lib/hooks";
import { db, emptyDraft } from "@/lib/db";
import { templateFromCustomer } from "@/lib/plan";

function NewOrderInner() {
  const sp = useSearchParams();
  const preCustomer = sp.get("musteri");
  const { canEdit } = useAuth();
  const { data, error, loading, reload } = useData(async () => {
    const [customers, products, rates] = await Promise.all([db.customers(), db.products(), db.latestRates()]);
    const draft = emptyDraft();
    const c = customers.find((x) => x.id === preCustomer);
    if (c) {
      draft.order.customer_id = c.id;
      draft.order.currency = c.default_currency.trim();
      draft.order.incoterm = c.preferred_incoterm || "";
      draft.order.plan_template = templateFromCustomer(c);
    }
    return { customers, products, rates, draft };
  }, [preCustomer], { refetchOnFocus: false });

  if (!canEdit) return <Page><ErrorBox error="Sipariş eklemek için editör yetkisi gerekli." /></Page>;
  return (
    <>
      <PageHeader title="Yeni sipariş" />
      <Page>
        {loading ? <Loading /> : error || !data ? <ErrorBox error={error || "Yüklenemedi"} onRetry={reload} /> : (
          <OrderForm initial={data.draft} customers={data.customers} products={data.products} rates={data.rates} />
        )}
      </Page>
    </>
  );
}

export default function NewOrderPage() {
  return <Suspense fallback={<Loading />}><NewOrderInner /></Suspense>;
}
