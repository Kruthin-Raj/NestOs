/**
 * Pulls the API's own error message out of an axios failure.
 *
 * Every error the API returns uses the same envelope
 * (`{ success: false, message, error: { code } }`), but the value arriving in
 * a mutation's onError is typed `unknown` — so each call site was either
 * re-declaring the same nested shape inline or reaching for `any`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message ?? fallback
}

/** The API's machine-readable error code, when it sent one. */
export function apiErrorCode(err: unknown): string | undefined {
  const response = (err as { response?: { data?: { error?: { code?: string } } } })?.response
  return response?.data?.error?.code
}
