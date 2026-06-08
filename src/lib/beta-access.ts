export function getBetaAllowedEmails() {
  return String(process.env.NEXT_PUBLIC_BETA_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBetaAllowed(email: string) {
  const allowedEmails = getBetaAllowedEmails();
  if (allowedEmails.length === 0) {
    return process.env.NODE_ENV !== 'production';
  }

  return allowedEmails.includes(email.trim().toLowerCase());
}
