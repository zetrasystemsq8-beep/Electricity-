// A typed error we can throw anywhere in a service and have the error
// handler middleware turn into the right HTTP status + a message that's
// safe to show the user (section 35: no raw technical jargon).
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, code = "BAD_REQUEST", details?: unknown) {
    return new ApiError(400, code, message, details);
  }
  static unauthorized(message = "Please sign in again.") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You don't have access to this.") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message: string) {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new ApiError(409, "CONFLICT", message);
  }
  static providerNotConfigured(providerName: string) {
    return new ApiError(
      503,
      "PROVIDER_NOT_CONFIGURED",
      `${providerName} is not configured yet. Add real API credentials to the backend .env file before this feature will work - we never fake a provider response.`
    );
  }
  static providerFailure(providerName: string, message: string) {
    return new ApiError(502, "PROVIDER_FAILURE", `${providerName} error: ${message}`);
  }
  static internal(message = "Something went wrong. Please try again.") {
    return new ApiError(500, "INTERNAL", message);
  }
}
