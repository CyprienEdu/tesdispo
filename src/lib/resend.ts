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

export function sendHelloWorldEmail() {
  return getResend().emails.send({
    from: 'onboarding@resend.dev',
    to: 'cyprien.rubio@tsm-education.fr',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
  });
}
