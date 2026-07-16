/** Sipariş durum/ödeme/kargo etiketleri — tablo ve toplu düzenleme paylaşır. */

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak', confirmed: 'Onaylandı', processing: 'Hazırlanıyor',
  shipped: 'Kargolandı', delivered: 'Teslim Edildi', cancelled: 'İptal',
};

export const ORDER_STATUS_TONE: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  draft: 'secondary', confirmed: 'default', processing: 'warning',
  shipped: 'default', delivered: 'success', cancelled: 'destructive',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Ödenmedi', partial: 'Kısmi', paid: 'Ödendi', refunded: 'İade',
};

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor', preparing: 'Hazırlanıyor', shipped: 'Kargoda',
  delivered: 'Teslim Edildi', returned: 'İade',
};

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }));
export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }));
export const SHIPMENT_STATUS_OPTIONS = Object.entries(SHIPMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }));
