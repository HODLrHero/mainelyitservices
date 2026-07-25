const Stripe = require('stripe');

const DEFAULT_CURRENCY = (process.env.STRIPE_DEFAULT_CURRENCY || 'usd').toLowerCase();
const DEFAULT_DUE_DAYS = 30;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiSecret = process.env.INVOICE_API_SECRET;
  if (!apiSecret) {
    return res.status(503).json({ error: 'Invoice API is not configured. Set INVOICE_API_SECRET in your environment.' });
  }

  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const bodyToken = req.body?.apiSecret || '';
  if (bearerToken !== apiSecret && bodyToken !== apiSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.' });
  }

  const {
    customerEmail,
    customerName,
    description,
    amount,
    currency,
    dueDays,
    send = true,
    metadata = {},
  } = req.body || {};

  if (!customerEmail || !description || amount == null) {
    return res.status(400).json({
      error: 'Required fields: customerEmail, description, amount (in cents).',
    });
  }

  const amountCents = parseInt(amount, 10);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return res.status(400).json({ error: 'amount must be a positive integer in cents.' });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(customerEmail)) {
    return res.status(400).json({ error: 'Invalid customerEmail.' });
  }

  if (String(description).length > 500) {
    return res.status(400).json({ error: 'description exceeds maximum length.' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
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

    let sent = null;
    if (send) {
      sent = await stripe.invoices.sendInvoice(finalized.id);
    }

    return res.status(200).json({
      success: true,
      invoiceId: finalized.id,
      invoiceNumber: finalized.number,
      status: sent?.status || finalized.status,
      hostedInvoiceUrl: sent?.hosted_invoice_url || finalized.hosted_invoice_url,
      invoicePdf: sent?.invoice_pdf || finalized.invoice_pdf,
      customerId: customer.id,
      amountDue: finalized.amount_due,
      currency: finalized.currency,
    });
  } catch (err) {
    console.error('Stripe invoice error:', err);
    return res.status(502).json({
      error: err.message || 'Failed to create Stripe invoice.',
    });
  }
};
