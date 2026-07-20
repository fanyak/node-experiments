import { loadEnvFile } from "node:process";
import { validateAndLoadEnv } from "./utils.js";
// import{default as pino}  from "pino";
loadEnvFile();
const { localhost, ..._ } = validateAndLoadEnv();
export async function doFetch(options) {
    const { method = 'get', path, query, body, headers, maxRetries = 1, timeout, signal } = options || {};
    let url = new URL(path || "", localhost);
    console.info(`Fetching URL: ${url.toString()} with method: ${method}`);
    if (!url) {
        throw new Error("Path is required for the request.");
    }
    if (query && typeof query === "object") {
        const queryString = new URLSearchParams(query).toString();
        url.search = queryString;
    }
    const signals = signal ? [signal] : [];
    if (timeout)
        signals.push(AbortSignal.timeout(timeout));
    // if the JsonStringify fails we can catch in on the async function level
    let requestBody = JSON.stringify(body);
    let error = null;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fetch(url, {
                method,
                headers,
                body: requestBody,
                signal: AbortSignal.any(signals),
            });
        }
        catch (error) {
            error = error;
        }
    }
    throw new Error(`Failed to fetch ${path} after ${maxRetries} retries. Last error: ${error?.message}`);
}
// // test
// doFetch().
// then(console.log)
// .catch((error) => {
//   console.error("Error in doFetch:", error);
// });
