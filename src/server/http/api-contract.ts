export const API_ERROR_DEFINITIONS = Object.freeze({
  validation: {
    code: "VALIDATION_ERROR",
    message: "Request validation failed.",
    status: 400,
  },
  authentication: {
    code: "AUTHENTICATION_REQUIRED",
    message: "Authentication is required.",
    status: 401,
  },
  authorization: {
    code: "ACCESS_DENIED",
    message: "You do not have permission to perform this action.",
    status: 403,
  },
  notFound: {
    code: "NOT_FOUND",
    message: "The requested resource was not found.",
    status: 404,
  },
  conflict: {
    code: "CONFLICT",
    message: "The request conflicts with the current resource state.",
    status: 409,
  },
  rateLimit: {
    code: "RATE_LIMITED",
    message: "Too many requests. Try again later.",
    status: 429,
  },
  internal: {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
    status: 500,
  },
} as const);

export type ApiErrorType = keyof typeof API_ERROR_DEFINITIONS;
export type ApiErrorCode = (typeof API_ERROR_DEFINITIONS)[ApiErrorType]["code"];
export type ApiErrorStatus = (typeof API_ERROR_DEFINITIONS)[ApiErrorType]["status"];

export type ApiValidationIssue = {
  code: string;
  message: string;
  path: readonly (number | string)[];
};

export type ApiErrorDetails = {
  field?: string;
  issues?: readonly ApiValidationIssue[];
  resource?: string;
  retryAfterSeconds?: number;
};

export type ApiErrorPayload = {
  code: ApiErrorCode;
  details?: ApiErrorDetails;
  message: string;
  type: ApiErrorType;
};

export type ApiSuccessBody<Data, Meta = never> = {
  data: Data;
  meta?: Meta;
  ok: true;
  requestId: string;
};

export type ApiErrorBody = {
  error: ApiErrorPayload;
  ok: false;
  requestId: string;
};

export type ApiResponseBody<Data, Meta = never> = ApiSuccessBody<Data, Meta> | ApiErrorBody;

export type ApiSuccessResult<Data, Meta = never> = {
  data: Data;
  headers?: HeadersInit;
  meta?: Meta;
  status: number;
};

export type ApiSuccessOptions<Meta = never> = {
  headers?: HeadersInit;
  meta?: Meta;
  status?: number;
};

export function apiSuccess<Data, Meta = never>(
  data: Data,
  options: ApiSuccessOptions<Meta> = {},
): ApiSuccessResult<Data, Meta> {
  const status = options.status ?? 200;
  if (!Number.isSafeInteger(status) || status < 200 || status > 299 || status === 204) {
    throw new RangeError("JSON API success status must be an integer from 200–299 excluding 204.");
  }

  return {
    data,
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.meta !== undefined ? { meta: options.meta } : {}),
    status,
  };
}
