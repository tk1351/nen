import { assertEquals } from "@std/assert";
import { createHandler } from "./handler.ts";
import type { HandlerDeps, MatchCandidate, SuggestionResponse } from "../types.ts";

function makeDeps(candidates: MatchCandidate[] = []): HandlerDeps {
  return {
    getCandidates: async (_buffer, _limit) => candidates,
    checkDanger: (_command) => ({
      isDangerous: false,
      severity: "low" as const,
      reason: "",
      pattern: "",
    }),
  };
}

function makeRequest(path: string, method: string, body?: unknown): Request {
  const url = `http://localhost${path}`;
  if (method === "GET") {
    return new Request(url, { method });
  }
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("handler - GET /health returns 200 OK", async () => {
  const handler = createHandler(makeDeps());
  const req = makeRequest("/health", "GET");
  const res = await handler(req);
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "OK");
});

Deno.test("handler - unknown route returns 404", async () => {
  const handler = createHandler(makeDeps());
  const req = makeRequest("/unknown", "GET");
  const res = await handler(req);
  assertEquals(res.status, 404);
});

Deno.test("handler - POST /suggest with valid request returns 200", async () => {
  const candidates: MatchCandidate[] = [
    { text: "git commit", source: "history", frequency: 5 },
  ];
  const handler = createHandler(makeDeps(candidates));
  const req = makeRequest("/suggest", "POST", { buffer: "git" });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const body = (await res.json()) as SuggestionResponse;
  assertEquals(body.suggestions.length, 1);
  assertEquals(body.suggestions[0].text, "git commit");
});

Deno.test("handler - POST /suggest with empty buffer returns empty suggestions", async () => {
  const handler = createHandler(makeDeps());
  const req = makeRequest("/suggest", "POST", { buffer: "   " });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const body = (await res.json()) as SuggestionResponse;
  assertEquals(body.suggestions, []);
  assertEquals(body.hasDanger, false);
});

Deno.test("handler - POST /suggest with invalid JSON returns 400", async () => {
  const handler = createHandler(makeDeps());
  const req = new Request("http://localhost/suggest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not json",
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});

Deno.test("handler - POST /suggest with missing buffer returns 400", async () => {
  const handler = createHandler(makeDeps());
  const req = makeRequest("/suggest", "POST", { limit: 5 });
  const res = await handler(req);
  assertEquals(res.status, 400);
});

Deno.test("handler - hasDanger is true when suggestion has danger", async () => {
  const candidates: MatchCandidate[] = [
    { text: "rm -rf /", source: "history", frequency: 1 },
  ];
  const deps: HandlerDeps = {
    getCandidates: async () => candidates,
    checkDanger: (_command) => ({
      isDangerous: true,
      severity: "critical",
      reason: "Deletes root",
      pattern: "rm -rf /",
    }),
  };
  const handler = createHandler(deps);
  const req = makeRequest("/suggest", "POST", { buffer: "rm" });
  const res = await handler(req);
  const body = (await res.json()) as SuggestionResponse;
  assertEquals(body.hasDanger, true);
  assertEquals(body.suggestions[0].danger?.isDangerous, true);
});

Deno.test("handler - response Content-Type is application/json", async () => {
  const handler = createHandler(makeDeps());
  const req = makeRequest("/suggest", "POST", { buffer: "ls" });
  const res = await handler(req);
  assertEquals(res.headers.get("content-type"), "application/json");
});
