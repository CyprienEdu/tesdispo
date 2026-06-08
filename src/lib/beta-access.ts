export function getBetaAllowedEmails() {
  return String(process.env.NEXT_PUBLIC_BETA_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBetaAllowed(email: string) {
  return Boolean(email.trim());
}
