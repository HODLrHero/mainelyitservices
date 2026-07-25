const Stripe = require('stripe');

const DEFAULT_CURRENCY = (process.env.STRIPE_DEFAULT_CURRENCY || 'usd').toLowerCase();
const DEFAULT_DUE_DAYS = 30;

async function createAndSendInvoice({
  customerEmail,
  customerName,
  description,
  amountCents,
  currency,
  dueDays,
  send = true,
  metadata = {},
}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set in your environment.');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const existing = await stripe.customers.list({
    email: customerEmail.trim().toLowerCase(),
    limit: 1,
  });

  let customer = existing.data[0];
  if (!customer) {
    customer = await stripe.customers.create({
      email: customerEmail.trim().toLowerCase(),
      name: customerName?.trim() || undefined,
      metadata: typeof metadata === 'object' ? metadata : {},
    });
  } else if (customerName?.trim() && customer.name !== customerName.trim()) {
    customer = await stripe.customers.update(customer.id, {
      name: customerName.trim(),
    });
  }

  await stripe.invoiceItems.create({
    customer: customer.id,
    amount: amountCents,
    currency: (currency || DEFAULT_CURRENCY).toLowerCase(),
    description: String(description).trim(),
  });

  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: 'send_invoice',
    days_until_due: parseInt(dueDays, 10) || DEFAULT_DUE_DAYS,
    metadata: typeof metadata === 'object' ? metadata : {},
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

  let sent = finalized;
  if (send) {
    sent = await stripe.invoices.sendInvoice(finalized.id);
  }

  return {
    invoiceId: finalized.id,
    invoiceNumber: sent.number || finalized.number,
    status: sent.status,
    hostedInvoiceUrl: sent.hosted_invoice_url || finalized.hosted_invoice_url,
    invoicePdf: sent.invoice_pdf || finalized.invoice_pdf,
    customerId: customer.id,
    amountDue: sent.amount_due ?? finalized.amount_due,
    currency: sent.currency || finalized.currency,
  };
}

module.exports = { createAndSendInvoice, DEFAULT_CURRENCY, DEFAULT_DUE_DAYS };
