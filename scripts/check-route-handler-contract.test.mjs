import assert from "node:assert/strict";
import test from "node:test";

import { validateRouteHandlerSource } from "./check-route-handler-contract.mjs";

test("accepts handlers using the shared API boundary", () => {
  const findings = validateRouteHandlerSource(`
    import {apiSuccess, handleApiRoute} from "@/server/http";
    export function GET(request: Request) {
      return handleApiRoute(request, () => apiSuccess({status: "ok"}));
    }
  `);
  assert.deepEqual(findings, []);
});

test("rejects handlers bypassing the shared envelope", () => {
  const findings = validateRouteHandlerSource(
    `
    export function GET() {
      return Response.json({ok: true});
    }
  `,
    "src/app/api/example/route.ts",
  );
  assert.equal(findings.length, 4);
  assert.match(findings.join("\n"), /public API/u);
  assert.match(findings.join("\n"), /handleApiRoute/u);
  assert.match(findings.join("\n"), /ad hoc Response\.json/u);
  assert.match(findings.join("\n"), /\(0\/1\)/u);
});

test("rejects a second HTTP method that bypasses the wrapper", () => {
  const findings = validateRouteHandlerSource(`
    import {apiSuccess, handleApiRoute} from "@/server/http";
    export function GET(request) {
      return handleApiRoute(request, () => apiSuccess({status: "ok"}));
    }
    export const POST = async () => ({unsafe: true});
  `);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /\(1\/2\)/u);
});

test("accepts explicitly marked XML sitemap handlers through their response boundary", () => {
  const findings = validateRouteHandlerSource(`
    // route-response: xml
    import {sitemapXmlResponse} from "../sitemap-response";
    export function GET() {
      return sitemapXmlResponse("<urlset />");
    }
  `);
  assert.deepEqual(findings, []);
});

test("rejects marked XML handlers that bypass their response boundary", () => {
  const findings = validateRouteHandlerSource(`
    // route-response: xml
    export function GET() {
      return Response.json({unsafe: true});
    }
  `);
  assert.equal(findings.length, 2);
  assert.match(findings.join("\n"), /sitemapXmlResponse/u);
  assert.match(findings.join("\n"), /cannot return JSON/u);
});
