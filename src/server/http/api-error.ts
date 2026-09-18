import { API_ERROR_DEFINITIONS } from "./api-contract";
import type {
  ApiErrorDetails,
  ApiErrorStatus,
  ApiErrorType,
  ApiValidationIssue,
} from "./api-contract";

type ApiErrorOptions = {
  cause?: unknown;
  details?: ApiErrorDetails;
  internalMessage?: string;
  publicMessage?: string;
};

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
  return value;
}

export class ApiError extends Error {
  readonly details?: ApiErrorDetails;
  readonly publicMessage: string;
  readonly status: ApiErrorStatus;
  readonly type: ApiErrorType;

  private constructor(type: ApiErrorType, options: ApiErrorOptions = {}) {
    const definition = API_ERROR_DEFINITIONS[type];
    super(options.internalMessage ?? options.publicMessage ?? definition.message, {
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = "ApiError";
    this.type = type;
    this.status = definition.status;
    this.publicMessage =
      type === "internal" ? definition.message : (options.publicMessage ?? definition.message);
    if (options.details) this.details = options.details;
  }

  static validation(issues: readonly ApiValidationIssue[], publicMessage?: string): ApiError {
    return new ApiError("validation", {
      details: { issues: issues.map((issue) => ({ ...issue, path: [...issue.path] })) },
      ...(publicMessage ? { publicMessage } : {}),
    });
  }

  static authentication(publicMessage?: string): ApiError {
    return new ApiError("authentication", publicMessage ? { publicMessage } : {});
  }

  static authorization(publicMessage?: string): ApiError {
    return new ApiError("authorization", publicMessage ? { publicMessage } : {});
  }

  static notFound(resource?: string, publicMessage?: string): ApiError {
    return new ApiError("notFound", {
      ...(resource ? { details: { resource } } : {}),
      ...(publicMessage ? { publicMessage } : {}),
    });
  }

  static conflict(
    options: {
      field?: string;
      publicMessage?: string;
      resource?: string;
    } = {},
  ): ApiError {
    const details: ApiErrorDetails = {
      ...(options.field ? { field: options.field } : {}),
      ...(options.resource ? { resource: options.resource } : {}),
    };
    return new ApiError("conflict", {
      ...(Object.keys(details).length > 0 ? { details } : {}),
      ...(options.publicMessage ? { publicMessage: options.publicMessage } : {}),
    });
  }

  static rateLimit(retryAfterSeconds: number, publicMessage?: string): ApiError {
    return new ApiError("rateLimit", {
      details: {
        retryAfterSeconds: positiveInteger(retryAfterSeconds, "retryAfterSeconds"),
      },
      ...(publicMessage ? { publicMessage } : {}),
    });
  }

  static unavailable(dependencies: NonNullable<ApiErrorDetails["dependencies"]>): ApiError {
    return new ApiError("unavailable", {
      details: {
        dependencies: {
          mongodb: dependencies.mongodb,
          objectStorage: dependencies.objectStorage,
        },
      },
    });
  }

  static serviceUnavailable(publicMessage?: string): ApiError {
    return new ApiError("unavailable", publicMessage ? { publicMessage } : {});
  }

  static internal(cause?: unknown, internalMessage = "Unhandled internal API error."): ApiError {
    return new ApiError("internal", { cause, internalMessage });
  }
}
