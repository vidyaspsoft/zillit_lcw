/**
 * Extract a human-readable error message from an Axios error response.
 * Falls back to the provided default message when no server message is available.
 *
 * @param {Error} error - The error thrown by an Axios request
 * @param {string} [defaultMsg='Something went wrong'] - Fallback message
 * @returns {string} The error message to display to the user
 */
export function getApiErrorMessage(error, defaultMsg = 'Something went wrong') {
  return error?.response?.data?.message || defaultMsg;
}
