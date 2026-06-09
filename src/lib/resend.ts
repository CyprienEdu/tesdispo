import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY_missing');
  }

  resend ??= new Resend(apiKey);
  return resend;
}

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? 'TesDispo <onboarding@resend.dev>';
}

export function sendHelloWorldEmail() {
  return getResend().emails.send({
    from: getFromAddress(),
    to: 'cyprien.rubio@tsm-education.fr',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
  });
}

export function sendSignupConfirmationEmail(to: string, confirmationUrl: string) {
  return getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: 'Confirme ton compte TesDispo',
    html: `
      <p>Confirme ton compte TesDispo :</p>
      <p><a href="${confirmationUrl}">Confirmer mon compte</a></p>
      <p>Si tu n'es pas à l'origine de cette demande, ignore ce mail.</p>
    `,
    text: `Confirme ton compte TesDispo: ${confirmationUrl}`
  });
}
