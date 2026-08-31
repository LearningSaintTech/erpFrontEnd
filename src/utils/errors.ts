type ApiErrorBody = {
  message?: string;
  error?: string | { message?: string; details?: Array<{ message?: string }> };
};

export function getApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: ApiErrorBody } }).response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;

    const errorField = data?.error;
    if (typeof errorField === 'string' && errorField) return errorField;
    if (errorField && typeof errorField === 'object') {
      const details = errorField.details;
      if (Array.isArray(details) && details.length > 0) {
        const detailText = details
          .map((d) => d.message)
          .filter((m): m is string => !!m)
          .join('; ');
        if (detailText) {
          return errorField.message ? `${errorField.message}: ${detailText}` : detailText;
        }
      }
      if (typeof errorField.message === 'string' && errorField.message) return errorField.message;
    }
    return 'Request failed';
  }
  if (err instanceof Error && typeof err.message === 'string') return err.message;
  return 'Something went wrong';
}

export function toErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  return getApiErrorMessage(err);
}
