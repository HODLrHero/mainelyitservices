const RESEND_API = 'https://api.resend.com/emails';
const TO_EMAIL = 'mainelyit@tuta.com';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message, _honey } = req.body || {};

  if (_honey) {
    return res.status(200).json({ success: true });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (name.length > 200 || email.length > 254 || message.length > 5000) {
    return res.status(400).json({ error: 'Input exceeds maximum length.' });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const sanitize = (str) => str.replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const safeName = sanitize(name.trim());
  const safeEmail = sanitize(email.trim());
  const safeMessage = sanitize(message.trim());

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
      <div style="background:#2D5016;padding:24px 28px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;color:#fff;font-size:18px;">New Contact Form Submission</h2>
      </div>
      <div style="background:#f9f9f6;padding:28px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5016;width:90px;vertical-align:top;">Name</td>
            <td style="padding:8px 0;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5016;vertical-align:top;">Email</td>
            <td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#1B4965;">${safeEmail}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5016;vertical-align:top;">Message</td>
            <td style="padding:8px 0;white-space:pre-wrap;">${safeMessage}</td>
          </tr>
        </table>
      </div>
      <p style="margin-top:16px;font-size:12px;color:#888;">Sent from mainelyit.org contact form</p>
    </div>
  `;

  try {
    const response = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mainely IT Contact <contact@mainelyit.org>',
        to: TO_EMAIL,
        subject: `New Contact: ${safeName}`,
        reply_to: safeEmail,
        html,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('Resend API error:', data);
      return res.status(502).json({ error: 'Failed to deliver message. Please try again.' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};
