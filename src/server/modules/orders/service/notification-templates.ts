import type { SupportedLocale } from "@/constants";

import type { OrderNotificationIntent } from "../policy/order-state-machine";

type Template = Readonly<{ title: string; body: (code: string) => string }>;
type Catalog = Record<OrderNotificationIntent, Template>;

const en: Catalog = {
  "customer.order_received": {
    title: "Order received",
    body: (code) => `We received order ${code}. Payment is still pending.`,
  },
  "customer.order_confirmed": {
    title: "Payment received",
    body: (code) => `Your order ${code} is confirmed.`,
  },
  "customer.order_ready": { title: "Order ready", body: (code) => `Your order ${code} is ready.` },
  "customer.out_for_delivery": {
    title: "On the way",
    body: (code) => `Your order ${code} is out for delivery.`,
  },
  "customer.order_completed": {
    title: "Order completed",
    body: (code) => `Your order ${code} is complete. Thank you!`,
  },
  "customer.order_cancelled": {
    title: "Order cancelled",
    body: (code) => `Your order ${code} was cancelled.`,
  },
  "customer.payment_failed": {
    title: "Payment failed",
    body: (code) => `Payment for order ${code} failed. Please contact us for help.`,
  },
  "customer.payment_expired": {
    title: "Payment expired",
    body: (code) => `Payment for order ${code} expired.`,
  },
  "customer.order_refunded": {
    title: "Refund recorded",
    body: (code) => `A confirmed refund for order ${code} was recorded.`,
  },
  "employer.order_submitted": {
    title: "New order",
    body: (code) => `New order ${code} awaits payment. Review it in the dashboard.`,
  },
  "employer.order_paid": {
    title: "Order paid",
    body: (code) => `Order ${code} was paid and confirmed.`,
  },
  "employer.order_cancelled": {
    title: "Order cancelled",
    body: (code) => `Order ${code} was cancelled. Check refund follow-up in the dashboard.`,
  },
  "employer.order_refunded": {
    title: "Order refunded",
    body: (code) => `A confirmed refund was recorded for order ${code}.`,
  },
};

const pt: Catalog = {
  "customer.order_received": {
    title: "Encomenda recebida",
    body: (code) => `Recebemos a encomenda ${code}. O pagamento ainda está pendente.`,
  },
  "customer.order_confirmed": {
    title: "Pagamento recebido",
    body: (code) => `A sua encomenda ${code} está confirmada.`,
  },
  "customer.order_ready": {
    title: "Encomenda pronta",
    body: (code) => `A sua encomenda ${code} está pronta.`,
  },
  "customer.out_for_delivery": {
    title: "A caminho",
    body: (code) => `A sua encomenda ${code} está em entrega.`,
  },
  "customer.order_completed": {
    title: "Encomenda concluída",
    body: (code) => `A sua encomenda ${code} foi concluída. Obrigado!`,
  },
  "customer.order_cancelled": {
    title: "Encomenda cancelada",
    body: (code) => `A sua encomenda ${code} foi cancelada.`,
  },
  "customer.payment_failed": {
    title: "Pagamento falhou",
    body: (code) => `O pagamento da encomenda ${code} falhou. Contacte-nos para obter ajuda.`,
  },
  "customer.payment_expired": {
    title: "Pagamento expirado",
    body: (code) => `O pagamento da encomenda ${code} expirou.`,
  },
  "customer.order_refunded": {
    title: "Reembolso registado",
    body: (code) => `Foi registado um reembolso confirmado da encomenda ${code}.`,
  },
  "employer.order_submitted": en["employer.order_submitted"],
  "employer.order_paid": en["employer.order_paid"],
  "employer.order_cancelled": en["employer.order_cancelled"],
  "employer.order_refunded": en["employer.order_refunded"],
};

const fa: Catalog = {
  "customer.order_received": {
    title: "سفارش دریافت شد",
    body: (code) => `سفارش ${code} دریافت شد. پرداخت هنوز در انتظار است.`,
  },
  "customer.order_confirmed": {
    title: "پرداخت دریافت شد",
    body: (code) => `سفارش ${code} شما تأیید شد.`,
  },
  "customer.order_ready": {
    title: "سفارش آماده است",
    body: (code) => `سفارش ${code} شما آماده است.`,
  },
  "customer.out_for_delivery": {
    title: "در مسیر ارسال",
    body: (code) => `سفارش ${code} شما در مسیر ارسال است.`,
  },
  "customer.order_completed": {
    title: "سفارش تکمیل شد",
    body: (code) => `سفارش ${code} شما تکمیل شد. سپاسگزاریم!`,
  },
  "customer.order_cancelled": {
    title: "سفارش لغو شد",
    body: (code) => `سفارش ${code} شما لغو شد.`,
  },
  "customer.payment_failed": {
    title: "پرداخت ناموفق",
    body: (code) => `پرداخت سفارش ${code} ناموفق بود. لطفاً با ما تماس بگیرید.`,
  },
  "customer.payment_expired": {
    title: "مهلت پرداخت پایان یافت",
    body: (code) => `مهلت پرداخت سفارش ${code} پایان یافت.`,
  },
  "customer.order_refunded": {
    title: "بازپرداخت ثبت شد",
    body: (code) => `بازپرداخت تأییدشده سفارش ${code} ثبت شد.`,
  },
  "employer.order_submitted": en["employer.order_submitted"],
  "employer.order_paid": en["employer.order_paid"],
  "employer.order_cancelled": en["employer.order_cancelled"],
  "employer.order_refunded": en["employer.order_refunded"],
};

export function renderOrderNotification(
  intent: OrderNotificationIntent,
  locale: SupportedLocale,
  orderCode: string,
) {
  if (!/^SK-[A-Za-z0-9-]{1,35}$/u.test(orderCode))
    throw new Error("Invalid order code for notification.");
  const actualLocale = intent.startsWith("employer.") ? "en" : locale;
  const template = { en, "pt-PT": pt, fa }[actualLocale][intent];
  return { locale: actualLocale, title: template.title, body: template.body(orderCode) };
}
