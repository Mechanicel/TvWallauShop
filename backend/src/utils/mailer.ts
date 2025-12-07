import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST!;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER!;
const pass = process.env.SMTP_PASS!;
const from = process.env.SMTP_FROM || user;

// Wenn EMAIL_SEND explizit auf "false" steht → nicht senden
// Default ist "true", wenn nichts gesetzt ist
const EMAIL_SEND =
    (process.env.EMAIL_SEND ?? 'true').toLowerCase() === 'true';

const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: {
        user,
        pass
    }
});

async function sendMailSafely(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
}) {
    if (!EMAIL_SEND) {
        console.log('[Mailer] EMAIL_SEND=false → E-Mail-Versand ist deaktiviert.');
        console.log('[Mailer] Würde senden:', {
            to: options.to,
            subject: options.subject
        });
        return;
    }

    const info = await transporter.sendMail({
        from,
        ...options
    });

    console.log('[Mailer] E-Mail gesendet, MessageId:', info.messageId);
    return info;
}

/**
 * Send a verification email with a confirm link
 */
export async function sendVerificationEmail({
                                                to,
                                                firstName,
                                                verifyUrl
                                            }: {
    to: string;
    firstName: string;
    verifyUrl: string;
}) {
    const subject = 'Bitte bestätige deine E-Mail-Adresse';

    const html = `
  <div style="font-family: Arial, sans-serif; background:#f7f8fb; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:10px; padding:24px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
      <h2 style="color:#172133; margin-top:0;">Hallo ${firstName},</h2>
      <p>vielen Dank für deine Registrierung bei <b>TvWallauShop</b>. Bitte bestätige deine E-Mail-Adresse, indem du auf den Button klickst:</p>
      <p style="text-align:center; margin:30px 0;">
        <a href="${verifyUrl}" style="background:#4f46e5; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:bold;">
          E-Mail bestätigen
        </a>
      </p>
      <p>Falls der Button nicht funktioniert, kannst du auch diesen Link öffnen:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <hr style="margin:30px 0; border:none; border-top:1px solid #e5e7eb;" />
      <p style="font-size:0.9rem; color:#6b7280;">Liebe Grüße,<br/>Dein TvWallauShop-Team</p>
    </div>
  </div>
  `;

    const text = `
Hallo ${firstName},

bitte bestätige deine E-Mail-Adresse:

${verifyUrl}

Liebe Grüße,
Dein TvWallauShop-Team
`;

    await sendMailSafely({
        to,
        subject,
        text,
        html
    });
}

export async function sendOrderConfirmationEmail({
                                                     to,
                                                     firstName,
                                                     orderId,
                                                     items,
                                                     total
                                                 }: {
    to: string;
    firstName: string;
    orderId: number;
    items: Array<{ productName: string; sizeLabel: string; quantity: number; price: number }>;
    total: number;
}) {
    const subject = `Bestellbestätigung #${orderId}`;

    const rows = items
        .map(
            (it) => `
        <tr>
          <td style="padding:8px; border:1px solid #e5e7eb;">${it.productName}</td>
          <td style="padding:8px; border:1px solid #e5e7eb;">${it.sizeLabel}</td>
          <td style="padding:8px; border:1px solid #e5e7eb; text-align:center;">${it.quantity}</td>
          <td style="padding:8px; border:1px solid #e5e7eb; text-align:right;">${it.price.toFixed(2)} €</td>
        </tr>
      `
        )
        .join('');

    const html = `
  <div style="font-family: Arial, sans-serif; background:#f7f8fb; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:10px; padding:24px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
      <h2 style="color:#172133; margin-top:0;">Hallo ${firstName},</h2>
      <p>vielen Dank für deine Bestellung bei <b>TvWallauShop</b>!</p>
      <p>Hier sind die Details zu deiner Bestellung <b>#${orderId}</b>:</p>

      <table style="border-collapse:collapse; width:100%; margin-top:20px; font-size:0.95rem;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px; border:1px solid #e5e7eb; text-align:left;">Produkt</th>
            <th style="padding:8px; border:1px solid #e5e7eb; text-align:left;">Größe</th>
            <th style="padding:8px; border:1px solid #e5e7eb; text-align:center;">Menge</th>
            <th style="padding:8px; border:1px solid #e5e7eb; text-align:right;">Preis</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <p style="margin-top:20px; font-size:1.05rem; font-weight:bold; text-align:right;">
        Gesamtsumme: ${total.toFixed(2)} €
      </p>

      <hr style="margin:30px 0; border:none; border-top:1px solid #e5e7eb;" />
      <p style="font-size:0.9rem; color:#6b7280;">Wir melden uns, sobald deine Bestellung versendet wird.<br/>Liebe Grüße,<br/>Dein TvWallauShop-Team</p>
    </div>
  </div>
  `;

    const text = `
Hallo ${firstName},

vielen Dank für deine Bestellung bei TvWallauShop!

Bestellnummer: ${orderId}

Artikel:
${items
        .map(
            (it) =>
                `- ${it.productName} (${it.sizeLabel}), Menge: ${it.quantity}, Preis: ${it.price.toFixed(
                    2
                )} €`
        )
        .join('\n')}

Gesamtsumme: ${total.toFixed(2)} €

Wir melden uns, sobald deine Bestellung versendet wird.

Liebe Grüße,
Dein TvWallauShop-Team
`;

    await sendMailSafely({
        to,
        subject,
        text,
        html
    });
}
