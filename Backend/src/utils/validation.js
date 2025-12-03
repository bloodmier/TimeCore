/**
 * Simple email format validation.
 * @param {string} email - Email address to validate.
 * @returns {boolean} True if email looks valid, false otherwise.
 */
export function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Basic password validation rules.
 * For now we only enforce a minimum length.
 * You can extend this with more advanced rules later
 * (uppercase, numbers, symbols, etc.) if needed.
 *
 * @param {string} password - Password to validate.
 * @returns {boolean} True if password satisfies the minimum requirements.
 */
export function isValidPassword(password) {
  if (!password) return false;
  return password.length >= 8;
}
