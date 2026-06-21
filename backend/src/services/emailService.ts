import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    // Production: use configured SMTP
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured in production (missing SMTP_HOST)');
    }

    // Development: use Ethereal (free fake SMTP)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[Email] Using Ethereal test account:', testAccount.user);
  }

  return transporter;
}

const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@birokt.no';

function emailTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#fef3c7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef3c7;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#f59e0b;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;">Birøkt</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:16px 24px;text-align:center;color:#6b7280;font-size:12px;">
              <p style="margin:0;">Denne e-posten ble sendt fra Birøkt - Digital birøktstyring</p>
              <p style="margin:4px 0 0;">Du mottar denne fordi du har en konto hos Birøkt.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: `"Birøkt" <${FROM_ADDRESS}>`,
      to,
      subject,
      html,
    });

    // In dev mode, log the Ethereal preview URL
    if (!process.env.SMTP_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('[Email] Preview URL:', previewUrl);
      }
    }

    console.log('[Email] Sent to:', to, '| Subject:', subject);
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
  }
}

export async function sendWelcomeEmail(name: string, email: string): Promise<void> {
  const html = emailTemplate('Velkommen til Birøkt', `
    <h2 style="color:#1f2937;margin:0 0 16px;">Velkommen, ${name}!</h2>
    <p style="color:#4b5563;line-height:1.6;">
      Takk for at du registrerte deg hos Birøkt - din digitale birøktstyring.
    </p>
    <p style="color:#4b5563;line-height:1.6;">
      Med Birøkt kan du:
    </p>
    <ul style="color:#4b5563;line-height:1.8;">
      <li>Holde oversikt over bigårdene og kubene dine</li>
      <li>Registrere inspeksjoner og behandlinger</li>
      <li>Følge med på honningproduksjon og fôring</li>
      <li>Få varsler om inspeksjoner og værforhold</li>
    </ul>
    <p style="color:#4b5563;line-height:1.6;">
      Kom i gang ved å opprette din første bigård!
    </p>
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;background-color:#f59e0b;color:#ffffff;padding:12px 24px;border-radius:6px;font-weight:bold;font-size:16px;">
        God birøkting!
      </span>
    </div>
  `);

  await sendEmail(email, 'Velkommen til Birøkt!', html);
}

export async function sendInspectionReminderEmail(
  email: string,
  name: string,
  hives: Array<{ hiveNumber: string; apiaryName: string; daysSinceInspection: number | string }>
): Promise<void> {
  const hiveList = hives
    .map(h => `<li>Kube <strong>${h.hiveNumber}</strong> i ${h.apiaryName} - ${h.daysSinceInspection} dager siden siste inspeksjon</li>`)
    .join('');

  const html = emailTemplate('Inspeksjonspåminnelse', `
    <h2 style="color:#1f2937;margin:0 0 16px;">Hei, ${name}!</h2>
    <p style="color:#4b5563;line-height:1.6;">
      Følgende kuber trenger inspeksjon:
    </p>
    <ul style="color:#4b5563;line-height:1.8;">
      ${hiveList}
    </ul>
    <p style="color:#4b5563;line-height:1.6;">
      Vi anbefaler å inspisere kubene minst hver 14. dag i sesongen.
    </p>
  `);

  await sendEmail(email, 'Inspeksjonspåminnelse - Birøkt', html);
}

export async function sendWithholdingWarningEmail(
  email: string,
  name: string,
  treatments: Array<{ productName: string; hiveNumber: string; apiaryName: string; daysRemaining: number }>
): Promise<void> {
  const treatmentList = treatments
    .map(t => `<li><strong>${t.productName}</strong> - kube ${t.hiveNumber} i ${t.apiaryName} (utløper om ${t.daysRemaining} dager)</li>`)
    .join('');

  const html = emailTemplate('Tilbakeholdelse utløper snart', `
    <h2 style="color:#1f2937;margin:0 0 16px;">Hei, ${name}!</h2>
    <p style="color:#4b5563;line-height:1.6;">
      Tilbakeholdelsesperioden utløper om 7 dager for følgende behandlinger:
    </p>
    <ul style="color:#4b5563;line-height:1.8;">
      ${treatmentList}
    </ul>
    <p style="color:#4b5563;line-height:1.6;">
      Husk å ikke høste honning før tilbakeholdelsesperioden er over.
    </p>
  `);

  await sendEmail(email, 'Tilbakeholdelse utløper snart - Birøkt', html);
}

export async function sendWeeklySummaryEmail(
  email: string,
  name: string,
  summaryData: {
    apiaries: Array<{
      name: string;
      activeHives: number;
      hivesNeedingInspection: number;
      activeWithholdings: number;
      honeyKgThisYear: number;
    }>;
  }
): Promise<void> {
  const apiaryRows = summaryData.apiaries
    .map(a => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#1f2937;font-weight:500;">${a.name}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#4b5563;text-align:center;">${a.activeHives}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;color:${a.hivesNeedingInspection > 0 ? '#dc2626' : '#16a34a'};font-weight:500;">${a.hivesNeedingInspection}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#4b5563;text-align:center;">${a.activeWithholdings}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#4b5563;text-align:center;">${a.honeyKgThisYear.toFixed(1)} kg</td>
      </tr>
    `)
    .join('');

  const html = emailTemplate('Ukentlig sammendrag', `
    <h2 style="color:#1f2937;margin:0 0 8px;">Hei, ${name}!</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">Her er ditt ukentlige sammendrag fra Birøkt.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;border-collapse:collapse;">
      <thead>
        <tr style="background-color:#f9fafb;">
          <th style="padding:12px;text-align:left;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Bigård</th>
          <th style="padding:12px;text-align:center;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Kuber</th>
          <th style="padding:12px;text-align:center;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Trenger inspeksjon</th>
          <th style="padding:12px;text-align:center;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Aktive karenstider</th>
          <th style="padding:12px;text-align:center;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Honning i år</th>
        </tr>
      </thead>
      <tbody>
        ${apiaryRows}
      </tbody>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;">Du mottar dette sammendraget hver søndag. Innstillingene kan endres i Birøkt-appen.</p>
  `);

  await sendEmail(email, 'Ukentlig sammendrag - Birøkt', html);
}

export async function sendTreatmentReminderEmail(
  email: string,
  name: string,
  treatments: Array<{ productName: string; hiveNumber: string; apiaryName: string }>
): Promise<void> {
  const treatmentList = treatments
    .map(t => `<li><strong>${t.productName}</strong> - kube ${t.hiveNumber} i ${t.apiaryName}</li>`)
    .join('');

  const html = emailTemplate('Tilbakeholdelse utløper', `
    <h2 style="color:#1f2937;margin:0 0 16px;">Hei, ${name}!</h2>
    <p style="color:#4b5563;line-height:1.6;">
      Tilbakeholdelsesperioden utløper i dag for følgende behandlinger:
    </p>
    <ul style="color:#4b5563;line-height:1.8;">
      ${treatmentList}
    </ul>
    <p style="color:#4b5563;line-height:1.6;">
      Du kan nå høste honning fra disse kubene igjen.
    </p>
  `);

  await sendEmail(email, 'Tilbakeholdelse utløper i dag - Birøkt', html);
}


