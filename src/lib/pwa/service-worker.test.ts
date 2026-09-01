import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FetchEvent = {
  request: Request;
  respondWith: (promise: Promise<Response>) => void;
};

function dispatchFetch(
  listener: ((event: FetchEvent) => void) | undefined,
  request: Request,
) {
  if (!listener) {
    throw new Error("Fetch listener was not registered.");
  }

  let responsePromise!: Promise<Response>;
  listener({
    request,
    respondWith: (promise) => {
      responsePromise = promise;
    },
  });
  return responsePromise;
}

describe("service worker offline reader", () => {
  it("serves a previously loaded book request from cache when network fails", async () => {
    const source = await fs.readFile(path.join(process.cwd(), "public", "sw.js"), "utf8");
    const listeners = new Map<string, (event: FetchEvent) => void>();
    const cachedResponses = new Map<string, Response>();

    const cache = {
      addAll: vi.fn(async () => undefined),
      put: vi.fn(async (request: Request, response: Response) => {
        cachedResponses.set(request.url, response);
      }),
      match: vi.fn(async (request: Request | string) => {
        const key = typeof request === "string" ? `http://app.test${request}` : request.url;
        return cachedResponses.get(key);
      }),
    };

    const fetchMock = vi.fn(async () => new Response("book-online", { status: 200 }));
    const context = {
      URL,
      Promise,
      Response,
      fetch: fetchMock,
      caches: {
        open: vi.fn(async () => cache),
        keys: vi.fn(async () => []),
        delete: vi.fn(async () => true),
      },
      self: {
        location: { origin: "http://app.test" },
        addEventListener: (name: string, listener: (event: FetchEvent) => void) => {
          listeners.set(name, listener);
        },
        skipWaiting: vi.fn(async () => undefined),
        clients: { claim: vi.fn(async () => undefined) },
      },
    };

    vm.runInNewContext(source, context);
    const fetchListener = listeners.get("fetch");
    expect(fetchListener).toBeDefined();

    const request = new Request("http://app.test/books/miau-washes-paws");
    const onlineResponse = await dispatchFetch(fetchListener, request);
    expect(await onlineResponse.text()).toBe("book-online");
    expect(cache.put).toHaveBeenCalledOnce();

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const offlineResponse = await dispatchFetch(fetchListener, request);
    expect(await offlineResponse.text()).toBe("book-online");
  });

  it("does not intercept future non-reader API requests", async () => {
    const source = await fs.readFile(path.join(process.cwd(), "public", "sw.js"), "utf8");
    const listeners = new Map<string, (event: FetchEvent) => void>();

    vm.runInNewContext(source, {
      URL,
      Promise,
      Response,
      fetch: vi.fn(),
      caches: {},
      self: {
        location: { origin: "http://app.test" },
        addEventListener: (name: string, listener: (event: FetchEvent) => void) => {
          listeners.set(name, listener);
        },
      },
    });

    const respondWith = vi.fn();
    listeners.get("fetch")?.({
      request: new Request("http://app.test/api/ai/generate"),
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
  });
});
