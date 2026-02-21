/**
 * handler.ts - HTTP request handler for the nen daemon (DI-injected).
 */

import { rankCandidates } from "../matcher/fuzzy.ts";
import type { HandlerDeps, SuggestionRequest, SuggestionResponse } from "../types.ts";

const DEFAULT_LIMIT = 10;
const MAX_BUFFER_LENGTH = 10_000;
const MAX_LIMIT = 100;

/**
 * Creates a Deno-compatible `fetch` handler that processes suggestion requests.
 *
 * The handler accepts:
 *   POST /suggest   body: SuggestionRequest  → SuggestionResponse
 *   GET  /health    → 200 OK
 *
 * @param deps - Injected dependencies (getCandidates, checkDanger).
 */
export function createHandler(
  deps: HandlerDeps,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    if (req.method === "POST" && url.pathname === "/suggest") {
      return await handleSuggest(req, deps);
    }

    return new Response("Not Found", { status: 404 });
  };
}

async function handleSuggest(req: Request, deps: HandlerDeps): Promise<Response> {
  let body: SuggestionRequest;
  try {
    body = (await req.json()) as SuggestionRequest;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  if (typeof body.buffer !== "string") {
    return new Response("Bad Request: buffer must be a string", { status: 400 });
  }

  if (body.buffer.length > MAX_BUFFER_LENGTH) {
    return new Response("Bad Request: buffer too long", { status: 400 });
  }

  if (body.limit !== undefined && typeof body.limit !== "number") {
    return new Response("Bad Request: limit must be a number", { status: 400 });
  }

  const limit = Math.min(Math.max(1, body.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const buffer = body.buffer;

  if (buffer.trim().length === 0) {
    const response: SuggestionResponse = { suggestions: [], hasDanger: false };
    return jsonResponse(response);
  }

  let rawCandidates;
  try {
    rawCandidates = await deps.getCandidates(buffer, limit);
  } catch {
    return new Response("Internal Server Error", { status: 500 });
  }

  const ranked = rankCandidates(buffer, rawCandidates, limit);
  const suggestions = ranked.map((s) => {
    const danger = deps.checkDanger(s.text);
    return {
      text: s.text,
      description: s.description,
      source: s.source,
      score: s.score,
      danger: danger.isDangerous ? danger : undefined,
    };
  });

  const hasDanger = suggestions.some((s) => s.danger?.isDangerous);

  const response: SuggestionResponse = { suggestions, hasDanger };
  return jsonResponse(response);
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
