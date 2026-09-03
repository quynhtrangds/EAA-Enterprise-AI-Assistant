export type AppErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'INVALID_TOOL_INPUT'
  | 'PERMISSION_DENIED'
  | 'CONNECTOR_ERROR'
  | 'INTEGRATION_NOT_CONFIGURED'
  | 'TOOL_TIMEOUT'
  | 'UNAUTHORIZED'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ACCOUNT_LOCKED';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}
