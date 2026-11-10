"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button, Card, Empty, ErrorBox, Input, Loading, Page, PageHeader, Table, Td, Th } from "@/components/ui";
import { CustomerFormModal, blankCustomer } from "@/components/CustomerForm";
import { useAuth } from "@/components/providers";
import { useData } from "@/lib/hooks";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { Customer, CustomerBalance } from "@/lib/types";

export default function CustomersPage() {
  const { canEdit } = useAuth();
  const { data, error, loading, reload } = useData(async () => {
    const [customers, balances] = await Promise.all([db.customers(), db.customerBalances()]);
    return { customers, balances };
  });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);

  const balByCustomer = useMemo(() => {
    const m = new Map<string, CustomerBalance[]>();
    (data?.balances || []).forEach((b) => m.set(b.customer_id, [...(m.get(b.customer_id) || []), b]));
    return m;
  }, [data]);

  const rows = useMemo(() => {
    const s = search.trim().toLocaleLowerCase("tr");
    return (data?.customers || []).filter((c) =>
      !s || [c.name, c.code, c.country, c.contact_person].some((v) => (v || "").toLocaleLowerCase("tr").includes(s))
    );
  }, [data, search]);

  return (
    <>
      <PageHeader title="Müşteriler" subtitle={data ? `${data.customers.length} müşteri` : undefined}>
        {canEdit && <Button icon={Plus} onClick={() => setEditing(blankCustomer())}>Yeni müşteri</Button>}
      </PageHeader>
      <Page>
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-3 text-muted" />
          <Input className="pl-9" placeholder="Ad, kod, ülke ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        <Card padded={false}>
          {loading ? <Loading /> : rows.length === 0 ? (
            <Empty title="Müşteri yok" hint={search ? "Aramayla eşleşen müşteri bulunamadı." : "İlk müşteriyi ekle veya eski sistemden aktar."} />
          ) : (
            <Table>
              <thead>
                <tr><Th>Kod</Th><Th>Müşteri</Th><Th>Ülke</Th><Th className="text-right">Sipariş</Th><Th className="text-right">Bakiye</Th><Th className="text-right">Gecikmiş</Th><Th>Son tahsilat</Th></tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const bals = balByCustomer.get(c.id) || [];
                  const last = bals.map((b) => b.last_collection_date).filter(Boolean).sort().pop();
                  return (
                    <tr key={c.id} className="hover:bg-cream/50">
                      <Td className="text-muted whitespace-nowrap">{c.code}</Td>
                      <Td><Link href={`/musteriler/${c.id}`} className="font-semibold text-navy hover:underline">{c.name}</Link></Td>
                      <Td>{c.country}</Td>
                      <Td className="text-right tabular-nums">{bals.reduce((s, b) => s + Number(b.order_count), 0)}</Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">
                        {bals.filter((b) => Math.abs(Number(b.balance)) > 0.005).map((b) => (
                          <div key={b.currency} className={Number(b.balance) < 0 ? "text-forest" : ""}>{fmtMoney(b.balance, b.currency)}</div>
                        ))}
                        {bals.every((b) => Math.abs(Number(b.balance)) <= 0.005) && <span className="text-muted">—</span>}
                      </Td>
                      <Td className="text-right tabular-nums whitespace-nowrap text-oxblood">
                        {bals.filter((b) => Number(b.overdue_amount) > 0.005).map((b) => (
                          <div key={b.currency}>{fmtMoney(b.overdue_amount, b.currency)}</div>
                        ))}
                      </Td>
                      <Td className="whitespace-nowrap">{fmtDate(last)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
      {editing && data && (
        <CustomerFormModal initial={editing} existing={data.customers} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
    </>
  );
}
