const ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const CONFIRMATION_CODE_PATTERN = /^WD-[A-Z0-9-]{6,64}$/;

export class WithdrawalNotificationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WithdrawalNotificationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new WithdrawalNotificationError(code, message, details);
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) fail('INVALID_WITHDRAWAL_NOTIFICATION', `${field} is required.`, { field });
  if (normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('INVALID_WITHDRAWAL_NOTIFICATION', `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeEmail(value) {
  const email = requiredText(value, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('INVALID_WITHDRAWAL_NOTIFICATION', 'Email address is invalid.', { field: 'email' });
  }
  return email;
}

export function createWithdrawalConfirmationMessage({
  email,
  orderId,
  confirmationCode,
  withdrawnAt,
} = {}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedOrderId = requiredText(orderId, 'orderId', 36).toUpperCase();
  if (!ORDER_ID_PATTERN.test(normalizedOrderId)) {
    fail('INVALID_WITHDRAWAL_NOTIFICATION', 'Order ID is invalid.', { field: 'orderId' });
  }
  const normalizedCode = requiredText(confirmationCode, 'confirmationCode', 80).toUpperCase();
  if (!CONFIRMATION_CODE_PATTERN.test(normalizedCode)) {
    fail('INVALID_WITHDRAWAL_NOTIFICATION', 'Confirmation code is invalid.', { field: 'confirmationCode' });
  }
  if (!Number.isInteger(withdrawnAt) || withdrawnAt <= 0) {
    fail('INVALID_WITHDRAWAL_NOTIFICATION', 'Withdrawal timestamp is invalid.', { field: 'withdrawnAt' });
  }

  const withdrawnAtIso = new Date(withdrawnAt * 1000).toISOString();
  return Object.freeze({
    to: normalizedEmail,
    template: 'withdrawal-confirmation',
    subject: `LegendMural withdrawal confirmation — ${normalizedOrderId}`,
    data: Object.freeze({
      orderId: normalizedOrderId,
      confirmationCode: normalizedCode,
      withdrawnAt,
      withdrawnAtIso,
    }),
  });
}

export function requireWithdrawalNotifier(notifier) {
  if (!notifier || typeof notifier.sendWithdrawalConfirmation !== 'function') {
    fail(
      'WITHDRAWAL_NOTIFIER_NOT_CONFIGURED',
      'Withdrawal confirmation delivery is not configured.',
    );
  }
  return notifier;
}

export async function sendWithdrawalConfirmation(notifier, input) {
  const transport = requireWithdrawalNotifier(notifier);
  const message = createWithdrawalConfirmationMessage(input);
  try {
    const result = await transport.sendWithdrawalConfirmation(message);
    if (!result || result.accepted !== true) {
      fail('WITHDRAWAL_NOTIFICATION_NOT_ACCEPTED', 'Withdrawal confirmation was not accepted for delivery.');
    }
    return Object.freeze({
      accepted: true,
      providerMessageId: String(result.providerMessageId || '').trim() || null,
    });
  } catch (error) {
    if (error instanceof WithdrawalNotificationError) throw error;
    fail('WITHDRAWAL_NOTIFICATION_FAILED', 'Withdrawal confirmation delivery failed.', {
      causeCode: error?.code || error?.name || 'UNKNOWN',
    });
  }
}
