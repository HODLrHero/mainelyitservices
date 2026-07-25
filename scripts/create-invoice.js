#!/usr/bin/env node
/**
 * Create and email a Stripe invoice to a client.
 *
 * Usage:
 *   node scripts/create-invoice.js \
 *     --email client@example.com \
 *     --name "Jane Client" \
 *     --description "Website build — March 2026" \
 *     --amount 1500 \
 *     --due 30
 *
 * --amount is in dollars (1500 = $1,500.00)
 * Loads STRIPE_SECRET_KEY from .env in the project root.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createAndSendInvoice } = require('../lib/create-stripe-invoice');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = val;
    i++;
  }
  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/create-invoice.js \\
    --email client@example.com \\
    --name "Client Name" \\
    --description "Service description" \\
    --amount 1500 \\
    [--due 30]

  --amount  Dollar amount (e.g. 1500 = $1,500.00)
  --due     Days until due (default: 30)`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.email || !args.description || !args.amount) {
    printUsage();
    process.exit(1);
  }

  const amountDollars = parseFloat(args.amount);
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    console.error('Error: --amount must be a positive number in dollars.');
    process.exit(1);
  }

  const amountCents = Math.round(amountDollars * 100);

  try {
    const result = await createAndSendInvoice({
      customerEmail: args.email,
      customerName: args.name,
      description: args.description,
      amountCents,
      dueDays: args.due,
      send: true,
    });

    console.log('Invoice created and sent to client.');
    console.log('  Number:  ', result.invoiceNumber || '(pending)');
    console.log('  Status:  ', result.status);
    console.log('  Amount:  ', (result.amountDue / 100).toFixed(2), result.currency.toUpperCase());
    console.log('  Pay link:', result.hostedInvoiceUrl);
    if (result.invoicePdf) {
      console.log('  PDF:     ', result.invoicePdf);
    }
  } catch (err) {
    console.error('Failed to create invoice:', err.message);
    process.exit(1);
  }
}

main();
