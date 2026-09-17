import * as Sentry from "@sentry/nextjs";

export type ServerExceptionContext = Readonly<{
  action: string;
  module: string;
  requestId?: string;
}>;

export function captureServerException(error: unknown, context: ServerExceptionContext): string {
  return Sentry.withScope((scope) => {
    scope.setTag("runtime", "server");
    scope.setTag("alert_route", "backend");
    scope.setTag("module", context.module);
    scope.setTag("action", context.action);
    if (context.requestId) scope.setTag("request_id", context.requestId);
    return Sentry.captureException(error);
  });
}
