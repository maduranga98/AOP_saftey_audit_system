/** Employee numbers map to a hidden email so Firebase Auth's email/password provider can be used. */
export const EMAIL_DOMAIN = 'aop.internal';

export const PIN_LENGTH = 6;

export function normalizeEmpNo(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidEmpNo(empNo: string): boolean {
  return /^[A-Z0-9-]{2,20}$/.test(empNo);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function empNoToEmail(empNo: string): string {
  return `${normalizeEmpNo(empNo).toLowerCase()}@${EMAIL_DOMAIN}`;
}

export function emailToEmpNo(email: string | null | undefined): string {
  if (!email || !email.endsWith(`@${EMAIL_DOMAIN}`)) return '';
  return email.split('@')[0].toUpperCase();
}

export const MIN_PASSWORD = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !email.trim().toLowerCase().endsWith(`@${EMAIL_DOMAIN}`);
}

/** True for staff accounts (employee number + PIN); false for email accounts. */
export function isPinAccountEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${EMAIL_DOMAIN}`);
}
