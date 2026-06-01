import { google } from 'googleapis';
import { env } from '../config/env.js';

const encodeMessage = (message) => {
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const createRawEmail = ({ to, from, subject, html }) => {
  const message = [
    `From: URL Shortener <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\n');

  return encodeMessage(message);
};

export const sendVerificationEmail = async ({ to, username, verificationLink }) => {
  const subject = 'Verify your URL Shortener account';

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Verify your URL Shortener account</h2>
      <p>Hello ${username},</p>
      <p>Please verify your email by clicking the button below:</p>

      <p>
        <a
          href="${verificationLink}"
          style="
            display:inline-block;
            padding:12px 18px;
            background:#2563eb;
            color:white;
            text-decoration:none;
            border-radius:8px;
            font-weight:bold;
          "
        >
          Verify Email
        </a>
      </p>

      <p>Or copy and paste this link into your browser:</p>
      <p>${verificationLink}</p>

      <p>This link will expire in 24 hours.</p>
    </div>
  `;

  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_REFRESH_TOKEN ||
    !env.GMAIL_FROM
  ) {
    console.log('\n================ EMAIL VERIFICATION LINK ================');
    console.log(`To: ${to}`);
    console.log(verificationLink);
    console.log('=========================================================\n');

    return {
      sent: false,
      fallback: true,
    };
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
  });

  const gmail = google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });

  const raw = createRawEmail({
    to,
    from: env.GMAIL_FROM,
    subject,
    html,
  });

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
    },
  });

  return {
    sent: true,
    fallback: false,
    id: result.data.id,
  };
};