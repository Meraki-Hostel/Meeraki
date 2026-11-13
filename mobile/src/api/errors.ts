/**
 * Error codes the API sends (BACKEND_HANDOFF.md), plus UNAVAILABLE, which is
 * client-side: offline, server down, or a reply that is not our envelope.
 * NOT_IMPLEMENTED / NOT_CONFIGURED mean "this feature is not set up": screens
 * show them as unavailable, never as success.
 */
export type ApiErrorCode =
  | 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'UNAUTHENTICATED' | 'EXPIRED'
  | 'NOT_IMPLEMENTED' | 'NOT_CONFIGURED' | 'UNAVAILABLE';

export const KNOWN_CODES: ApiErrorCode[] = [
  'VALIDATION', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'UNAUTHENTICATED', 'EXPIRED', 'NOT_IMPLEMENTED', 'NOT_CONFIGURED',
];

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The feature exists in the app but is not available on this server. */
  get isUnavailableFeature(): boolean {
    return this.code === 'NOT_IMPLEMENTED' || this.code === 'NOT_CONFIGURED';
  }
}

export const UNREACHABLE = "Can't reach StayPookie right now. Check your connection and try again.";

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError('UNAVAILABLE', err instanceof Error && err.message ? err.message : UNREACHABLE);
}
