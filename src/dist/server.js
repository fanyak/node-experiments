import http from "node:http";
import { extname, join } from "node:path";
import { loadEnvFile } from "node:process";
import closeWithGrace from "close-with-grace";
import { validateAndLoadEnv, noderegx, MIME_TYPES, EXTENSION_TYPES } from "./utils.js";
import { existsSync, createReadStream } from "node:fs";
// load .env file to process.env object
loadEnvFile();
const { localhost, DoDhost, tagLimit, staticPath, port } = validateAndLoadEnv();
const sleep = (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms));
function assertTagIsWithinLimit(tag) {
    if (tag < 1 || tag > Number(tagLimit)) {
        throw new Error(`Node tag must be between 1 and ${tagLimit}`);
    }
}
function assertValidNodeTag(tag) {
    if (typeof tag !== "string") {
        throw new Error(`Invalid node tag format: ${tag}`);
    }
    if (!noderegx.test(tag)) {
        throw new Error(`Invalid node tag format: ${tag}`);
    }
}
/**
 * Example of a graceful HTTP server using close-with-grace.
 * Demonstrates proper shutdown handling without connection tracking.
 * REF: https://github.com/fanyak/skills/blob/main/skills/node/rules/assets/graceful-server.ts
 */
let isShuttingDown = false;
function createHandler() {
    return async (req, res) => {
        if (isShuttingDown) {
            // Close previous HTTP: Connection : keep-alive sent by the client Request object.
            res.setHeader("Connection", "close");
        }
        const reqUrl = new URL(`${localhost}:${port}${req.url || ""}`);
        console.log(`Request url: ${req.url}`);
        const pathname = reqUrl.pathname;
        if (pathname === "/dodbook") {
            if (isShuttingDown) {
                res.statusCode = 503;
                res.setHeader("Content-Type", MIME_TYPES.json);
                res.end(JSON.stringify({ status: "shutting down" }));
                return;
            }
            console.log(`Received request: ${req.url}`);
            const node = reqUrl.searchParams.get("node");
            try {
                //Note: if assertion passes node will have type ValidNodeTag, otherwise an error will be thrown
                assertValidNodeTag(node);
            }
            catch {
                // Bad request, send 400 response with error message
                const mesage = `Invalid node tag format: ${node}`;
                res.writeHead(400, { "Content-Type": MIME_TYPES.json });
                res.statusMessage = mesage;
                res.end(JSON.stringify({ error: mesage }));
                return;
            }
            try {
                const nodeTagNumber = parseInt(node.substring(4) || "0");
                assertTagIsWithinLimit(nodeTagNumber);
            }
            catch {
                // Resource not found, send 404 response with error message
                res.writeHead(404, { "Content-Type": MIME_TYPES.json });
                const message = `Node tag must be between 1 and ${tagLimit}`;
                res.statusMessage = message;
                res.end(JSON.stringify({ error: message }));
                return;
            }
            const url = `${DoDhost}/${node}.html`;
            try {
                await sleep(2000); // simulate network delay
                console.log(`fetching ${url}`);
                const f = await fetch(url);
                if (!f.ok) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", MIME_TYPES.json);
                    res.end(JSON.stringify({
                        error: `Failed to fetch content for ${node}: ${f.statusText}`,
                    }));
                    return;
                }
                const content = await f.text();
                res.writeHead(200, { "Content-Type": MIME_TYPES.html });
                res.end(content);
            }
            catch (error) {
                // TODO: add retry logic with exponential backoff for transient network errors
                res.statusCode = 500;
                res.setHeader("Content-Type", MIME_TYPES.json);
                res.end(JSON.stringify({
                    error: `${error?.message} || "Unknown error"`,
                }));
            }
            return;
        }
        // REF: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Node_server_without_framework
        if (extname(pathname).substring(1).toLowerCase() === EXTENSION_TYPES.html) {
            const filePath = join(process.cwd(), staticPath || "static", pathname);
            const fileExists = existsSync(filePath);
            const streamPath = fileExists ? filePath : join(process.cwd(), staticPath || "static", "404.html");
            const statusCode = fileExists ? 200 : 404;
            res.writeHead(statusCode, { "Content-Type": MIME_TYPES.html });
            const stream = createReadStream(streamPath);
            stream.pipe(res);
            console.log(`${req.method} ${req.url} ${statusCode}`);
            return;
        }
        // Handle other routes or methods
        res.writeHead(200, { "Content-Type": MIME_TYPES.txt });
        res.end("Hello from the DoD server!");
    };
}
function closeServer(server) {
    // this is asynchronouse
    return new Promise((resolve, reject) => {
        server.closeIdleConnections();
        // Stops the server from accepting new connections but **keeps existing connections**
        server.close((error) => {
            // the callback will be called when all existing connections are closed.
            // the callack will be called with an error if the server was not running.
            if (error && error.message !== "Server is not running") {
                reject(error);
                return;
            }
            resolve();
        });
        // Wait to force close all connections after timeout
        setTimeout(() => {
            // forcefully close all connections including keep-alive connections
            // if there were keep-alive connections they will be closed and the 'close' event will trigger the callback above.
            server.closeAllConnections();
        }, 5000);
    });
}
//  close-with-grace to handle graceful shutdown
// (async () => {
//   await sleep(10000);
//   await closeServer(dodServer);
// })()
export async function main() {
    const server = http.createServer(createHandler());
    server.listen(port, () => {
        console.log(`DoD server is running on ${localhost}:${port}`);
    });
    // will close on signals SIGINT, SIGTERM, SIGHUP, SIGQUIT, and uncaught exceptions
    closeWithGrace({ delay: 10000 }, async ({ signal, err }) => {
        if (err) {
            console.error(`Error during shutdown: ${err.message}`);
        }
        console.log(`Received signal ${signal}. Shutting down gracefully...`);
        isShuttingDown = true;
        server.getConnections((err, count) => {
            if (err) {
                console.error(`Error getting connections: ${err.message}`);
                return;
            }
            console.log(`Number of active connections: ${count}`);
        });
        // if the closeServer promise is rejected, the error will bubbule to the async main function.
        // we will catch the error at the main function's call site and log it to the console.
        await closeServer(server);
        console.log("Server closed successfully");
    });
}
const isMain = process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.js");
if (isMain) {
    main().catch((err) => {
        console.error(`Error in main function: ${err.message}`);
    });
}
