const { createAndSendInvoice, DEFAULT_CURRENCY, DEFAULT_DUE_DAYS } = require('../lib/create-stripe-invoice');

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

  try {
    const result = await createAndSendInvoice({
      customerEmail,
      customerName,
      description,
      amountCents,
      currency: currency || DEFAULT_CURRENCY,
      dueDays: dueDays || DEFAULT_DUE_DAYS,
      send,
      metadata,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Stripe invoice error:', err);
    return res.status(502).json({
      error: err.message || 'Failed to create Stripe invoice.',
    });
  }
};
