export type ServiceErrorCode =
  | 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'UNAUTHENTICATED' | 'EXPIRED'
  /** The feature is not built yet / the integration it needs is not set up. Show as unavailable, never as success. */
  | 'NOT_IMPLEMENTED' | 'NOT_CONFIGURED'
  /** Client-side only: the server could not be reached or failed unexpectedly. */
  | 'UNAVAILABLE';

/** Typed error thrown by every service. A future HTTP adapter maps status codes onto these. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly fieldErrors?: Record<string, string>;
  constructor(code: ServiceErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const isServiceError = (e: unknown): e is ServiceError => e instanceof ServiceError;

export function errorMessage(e: unknown): string {
  if (isServiceError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Try again.';
}

export const notFound = (what: string) => new ServiceError('NOT_FOUND', `${what} was not found.`);
export const forbidden = (msg = 'You do not have access to this record.') => new ServiceError('FORBIDDEN', msg);
export const invalid = (fieldErrors: Record<string, string>, msg = 'Check the highlighted fields.') => new ServiceError('VALIDATION', msg, fieldErrors);
