import type { AuthCustomer, AuthUser } from '@/store/auth.store';

export type ProfileFieldState = 'complete' | 'missing' | 'verify';

export type ProfilePresentation = {
  displayName: string;
  initials: string;
  customerReference: string;
  emailLabel: string;
  emailState: ProfileFieldState;
  phoneLabel: string;
  phoneState: ProfileFieldState;
  addressLabel: string;
  addressState: ProfileFieldState;
  authenticationEmailLabel: string | null;
  profileCompletion: number;
  missingInformation: string[];
};

type PresentProfileInput = {
  customer: AuthCustomer | null;
  user: AuthUser | null;
};

const PLACEHOLDER_VALUES = new Set([
  '',
  '-',
  'n/a',
  'na',
  'non renseigne',
  'non renseignee',
  'null',
]);

function normalize(value?: string | null): string {
  return (
    value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr-FR')
      .replace(/\s+/g, ' ') ?? ''
  );
}

function isTestValue(value?: string | null): boolean {
  const normalized = normalize(value);

  return PLACEHOLDER_VALUES.has(normalized) || /^test\d*$/.test(normalized);
}

function cleanNamePart(value?: string | null): string | null {
  if (isTestValue(value)) {
    return null;
  }

  const cleaned = value?.trim().replace(/\s+/g, ' ');

  return cleaned || null;
}

function cleanName(firstName?: string | null, lastName?: string | null): string | null {
  const name = [cleanNamePart(firstName), cleanNamePart(lastName)]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+-\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return name && name !== '-' ? name : null;
}

function getInitials(displayName: string, hasRealName: boolean): string {
  if (!hasRealName) {
    return 'CS';
  }

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('fr-FR');

  return initials || 'CS';
}

function isInternalEmail(value?: string | null): boolean {
  return normalize(value).endsWith('.local');
}

function isValidEmail(value?: string | null): value is string {
  const email = value?.trim() ?? '';

  return (
    !isTestValue(email) &&
    !isInternalEmail(email) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function presentEmail(
  customerEmail?: string | null,
  authenticationEmail?: string | null
): { label: string; state: ProfileFieldState; isComplete: boolean } {
  const candidate = isValidEmail(customerEmail)
    ? customerEmail.trim()
    : isValidEmail(authenticationEmail)
      ? authenticationEmail.trim()
      : null;

  if (candidate) {
    return { label: candidate, state: 'complete', isComplete: true };
  }

  const doubtfulEmail = [customerEmail, authenticationEmail].find(
    (value) =>
      value?.trim() &&
      !isTestValue(value) &&
      !isInternalEmail(value)
  );

  if (doubtfulEmail) {
    return {
      label: doubtfulEmail.trim(),
      state: 'verify',
      isComplete: false,
    };
  }

  return {
    label: 'Adresse e-mail à compléter',
    state: 'missing',
    isComplete: false,
  };
}

function formatMoroccanPhone(nationalNumber: string): string {
  return `+212 ${nationalNumber[0]} ${nationalNumber.slice(1, 3)} ${nationalNumber.slice(3, 5)} ${nationalNumber.slice(5, 7)} ${nationalNumber.slice(7, 9)}`;
}

function presentPhone(
  value?: string | null
): { label: string; state: ProfileFieldState; isComplete: boolean } {
  const phone = value?.trim() ?? '';

  if (isTestValue(phone)) {
    return {
      label: 'Téléphone à compléter',
      state: 'missing',
      isComplete: false,
    };
  }

  if (!/^[+\d\s().-]+$/.test(phone)) {
    return { label: phone, state: 'verify', isComplete: false };
  }

  const compact = phone.replace(/[\s().-]/g, '');
  let nationalNumber: string | null = null;

  if (/^\+2120?[5-7]\d{8}$/.test(compact)) {
    nationalNumber = compact.replace(/^\+2120?/, '');
  } else if (/^2120?[5-7]\d{8}$/.test(compact)) {
    nationalNumber = compact.replace(/^2120?/, '');
  } else if (/^0[5-7]\d{8}$/.test(compact)) {
    nationalNumber = compact.slice(1);
  }

  if (nationalNumber) {
    return {
      label: formatMoroccanPhone(nationalNumber),
      state: 'complete',
      isComplete: true,
    };
  }

  return { label: phone, state: 'verify', isComplete: false };
}

function presentAddress(
  value?: string | null
): { label: string; state: ProfileFieldState; isComplete: boolean } {
  if (isTestValue(value)) {
    return {
      label: 'Adresse à compléter',
      state: 'missing',
      isComplete: false,
    };
  }

  const address = value?.trim().replace(/\s+/g, ' ') ?? '';

  return {
    label: address,
    state: 'complete',
    isComplete: true,
  };
}

export function presentProfile({
  customer,
  user,
}: PresentProfileInput): ProfilePresentation {
  const customerName = cleanName(customer?.firstName, customer?.lastName);
  const userName = cleanName(user?.firstName, user?.lastName);
  const realName = customerName ?? userName;
  const displayName = realName ?? 'Client SMEIA';
  const email = presentEmail(customer?.email, user?.email);
  const phone = presentPhone(customer?.phone);
  const address = presentAddress(customer?.address);
  const authenticationEmailLabel = isValidEmail(user?.email)
    ? user.email.trim()
    : null;
  const missingInformation: string[] = [];

  if (!realName) missingInformation.push('nom');
  if (!email.isComplete) missingInformation.push('adresse e-mail');
  if (!phone.isComplete) missingInformation.push('téléphone');
  if (!address.isComplete) missingInformation.push('adresse postale');

  return {
    displayName,
    initials: getInitials(displayName, Boolean(realName)),
    customerReference: customer
      ? `Référence SMEIA-C-${customer.id}`
      : 'Référence SMEIA à confirmer',
    emailLabel: email.label,
    emailState: email.state,
    phoneLabel: phone.label,
    phoneState: phone.state,
    addressLabel: address.label,
    addressState: address.state,
    authenticationEmailLabel,
    profileCompletion: Math.round(((4 - missingInformation.length) / 4) * 100),
    missingInformation,
  };
}
