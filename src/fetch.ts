import {loadEnvFile} from "node:process";
import { validateAndLoadEnv } from "./utils.js";

loadEnvFile();
const {localhost, ..._} = validateAndLoadEnv();

type HeadersLike = Headers | Record<string, string> | [string, string][];
type HTTPMethod = "get" | "post" | "put" | "delete" | "patch" | "head" | "options";

interface MergedRequestInit extends RequestInit {}

export type RequestOptions = {
	/**
	 * The HTTP method for the request (e.g., 'get', 'post', 'put', 'delete').
	 */
	method?: HTTPMethod;

	/**
	 * The URL path for the request.
	 *
	 * @example "/v1/foo"
	 */
	path?: string;

	/**
	 * Query parameters to include in the request URL.
	 */
	query?: object | undefined | null;

	/**
	 * The request body. Can be a string, JSON object, FormData, or other supported types.
	 */
	body?: unknown;

	/**
	 * HTTP headers to include with the request. Can be a Headers object, plain object, or array of tuples.
	 */
	headers?: HeadersLike;

	/**
	 * The maximum number of times that the client will retry a request in case of a
	 * temporary failure, like a network error or a 5XX error from the server.
	 *
	 * @default 2
	 */
	maxRetries?: number;

	stream?: boolean | undefined;

	/**
	 * The maximum amount of time (in milliseconds) that the client should wait for a response
	 * from the server before timing out a single request.
	 *
	 * @unit milliseconds
	 */
	timeout?: number;

	/**
	 * Additional `RequestInit` options to be passed to the underlying `fetch` call.
	 * These options will be merged with the client's default fetch options.
	 */
	fetchOptions?: MergedRequestInit;

	/**
	 * An AbortSignal that can be used to cancel the request.
	 */
	signal?: AbortSignal | undefined | null;

	/**
	 * A unique key for this request to enable idempotency.
	 */
	idempotencyKey?: string;

	/**
	 * Override the default base URL for this specific request.
	 */
	defaultBaseURL?: string | undefined;

	__binaryResponse?: boolean | undefined;
	//__streamClass?: typeof Stream;
};


export async function doFetch(options?: RequestOptions): Promise<Response> {
  
  const {method = 'get', path, query, body, headers, maxRetries = 1, timeout, signal} = options || {};
  let url = new URL(path || "", localhost);
	console.log(url, path)
  if (!url) {
    throw new Error("Path is required for the request.");
  }
  if (query && typeof query === "object") {
    const queryString = new URLSearchParams(query as Record<string, string>).toString();
    url.search = queryString;
  }  

  const signals: AbortSignal[] = signal ? [signal] : [];
  if (timeout) signals.push(AbortSignal.timeout(timeout));

  // if the JsonStringify fails we can catch in on the async function level
  let requestBody = JSON.stringify(body); 

  let error: Error | null = null;

  for (let i=0; i<maxRetries; i++) {
    try {
      return await fetch(url, {
      method,
      headers,
      body: requestBody,
      signal: AbortSignal.any(signals),
    });
  } catch(error) {
    error = error;
   }
}
  throw new Error(`Failed to fetch ${path} after ${maxRetries} retries. Last error: ${(error as any as Error)?.message}`);
}

// // test
// doFetch().
// then(console.log)
// .catch((error) => {
//   console.error("Error in doFetch:", error);
// });