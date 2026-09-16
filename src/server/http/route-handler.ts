import { randomUUID } from "node:crypto";

import { API_ERROR_DEFINITIONS } from "./api-contract";
import type {
  ApiErrorBody,
  ApiErrorPayload,
  ApiSuccessBody,
  ApiSuccessResult,
} from "./api-contract";
import { ApiError } from "./api-error";

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export type ApiRouteContext = {
  requestId: string;
};

export type ApiErrorReporterContext = ApiRouteContext & {
  method: string;
  pathname: string;
};

export type HandleApiRouteOptions = {
  onInternalError?: (error: unknown, context: ApiErrorReporterContext) => Promise<void> | void;
};

function resolveRequestId(request: Request): string {
  const supplied = request.headers.get(REQUEST_ID_HEADER)?.trim();
  return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID();
}

function responseHeaders(requestId: string, custom?: HeadersInit): Headers {
  const headers = new Headers(custom);
  headers.set("cache-control", "no-store");
  headers.set(REQUEST_ID_HEADER, requestId);
  return headers;
}

function successResponse<Data, Meta>(
  requestId: string,
  result: ApiSuccessResult<Data, Meta>,
): Response {
  const body = {
    data: result.data,
    ok: true,
    requestId,
    ...(result.meta !== undefined ? { meta: result.meta } : {}),
  } as ApiSuccessBody<Data, Meta>;

  return Response.json(body, {
    headers: responseHeaders(requestId, result.headers),
    status: result.status,
  });
}

function errorResponse(requestId: string, error: ApiError): Response {
  const definition = API_ERROR_DEFINITIONS[error.type];
  const payload: ApiErrorPayload = {
    code: definition.code,
    message: error.publicMessage,
    type: error.type,
    ...(error.details ? { details: error.details } : {}),
  };
  const body: ApiErrorBody = { error: payload, ok: false, requestId };
  const headers = responseHeaders(requestId);
  if (error.type === "rateLimit" && error.details?.retryAfterSeconds) {
    headers.set("retry-after", String(error.details.retryAfterSeconds));
  }

  return Response.json(body, { headers, status: error.status });
}

function defaultInternalErrorReporter(error: unknown, context: ApiErrorReporterContext): void {
  console.error("Unhandled API route error", { ...context, error });
}

async function reportInternalError(
  error: unknown,
  context: ApiErrorReporterContext,
  reporter: NonNullable<HandleApiRouteOptions["onInternalError"]>,
): Promise<void> {
  try {
    await reporter(error, context);
  } catch (reportingError) {
    defaultInternalErrorReporter(reportingError, context);
  }
}

/** Execute a JSON Route Handler with one request-ID, success, and safe error boundary. */
export async function handleApiRoute<Data, Meta = never>(
  request: Request,
  handler: (
    context: ApiRouteContext,
  ) => ApiSuccessResult<Data, Meta> | Promise<ApiSuccessResult<Data, Meta>>,
  options: HandleApiRouteOptions = {},
): Promise<Response> {
  const requestId = resolveRequestId(request);

  try {
    return successResponse(requestId, await handler({ requestId }));
  } catch (caughtError) {
    const apiError = caughtError instanceof ApiError ? caughtError : ApiError.internal(caughtError);
    if (apiError.type === "internal") {
      const reportedError = apiError.cause ?? caughtError;
      await reportInternalError(
        reportedError,
        { method: request.method, pathname: new URL(request.url).pathname, requestId },
        options.onInternalError ?? defaultInternalErrorReporter,
      );
    }
    return errorResponse(requestId, apiError);
  }
}
