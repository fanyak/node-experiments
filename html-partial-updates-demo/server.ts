import http, { type Server } from 'node:http';
import { loadEnvFile } from "node:process"
import closeWithGrace from 'close-with-grace';

// load .env file to process.env object
loadEnvFile();

const {localhost, pathname, DoDhost, tagLimit} = process.env;

type NodeNumber<T> = T extends `node${infer N}` ? N : never;
type ValidNodeTag = string & {__brand: "ValidNodeTag" };
type validUrl = `${typeof DoDhost}/${ValidNodeTag}.html`;

const sleep = (ms:number) => new Promise((resolve, reject) => setTimeout(resolve, ms));

function assertTagIsWithinLimit(tag: number): asserts tag is NodeNumber<ValidNodeTag> {
  if (tag < 1 || tag > Number(tagLimit)) {
    throw new Error(`Node tag must be between 1 and ${tagLimit}`);
  }
}

function assertValidNodeTag(tag: unknown): asserts tag is ValidNodeTag {
  if (typeof tag !== "string") {
    throw new Error(`Invalid node tag format: ${tag}`);
  }
  if (!/^node\d{1,2}$/.test(tag)) {
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
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (isShuttingDown) {
      // Close previous HTTP: Connection : keep-alive sent by the client Request object.
      res.setHeader('Connection', 'close');
    }
    const reqUrl = new URL(`${localhost}${req.url || ""}`);
    console.log(`Request url: ${req.url}`);
    const pathname = reqUrl.pathname;
    if (pathname === '/dodbook') {
      if (isShuttingDown) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({status: "shutting down"}));
        return;
      }
      console.log(`Received request: ${req.url}`);
      const node = reqUrl.searchParams.get("node");
      try {
        //Note: if assertion passes node will have type ValidNodeTag, otherwise an error will be thrown
        assertValidNodeTag(node);
      } catch {
        // Bad request, send 400 response with error message
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Invalid node tag format" }));
        return;
      }
      try {        
        const nodeTagNumber  = parseInt(node.substring(4) || "0");
        assertTagIsWithinLimit(nodeTagNumber);
      } catch {
        // Resource not found, send 404 response with error message
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Node tag must be between 1 and ${tagLimit}` }));
        return;
      }
      const url: validUrl = `${DoDhost!}/${node}.html`;
      console.log(`fetching ${url}`);
      try {
        const f = await fetch(url)
        if (!f.ok) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Failed to fetch content for ${node}: ${f.statusText}` }));
          return;
        }      
        const content = await f.text();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `${(error as Error)?.message} || "Unknown error"` }));
      } 
      return;
    }
    // Handle other routes or methods
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello from the DoD server!');
  }
}

function closeServer(server: Server): Promise<void> {
  // this is asynchronouse
  return new Promise((resolve, reject) => {

    server.closeIdleConnections();

    // Stops the server from accepting new connections but **keeps existing connections**
    server.close((error: Error | undefined) => {
      // the callback will be called when all existing connections are closed.
      // the callack will be called with an error if the server was not running.
      if (error && error.message !== "Server is not running") {
        reject(error);
        return;
      }
      resolve();
    })

    // Wait to force close all connections after timeout
    setTimeout(() => {     
      // forcefully close all connections including keep-alive connections
      // if there were keep-alive connections they will be closed and the 'close' event will trigger the callback above.
      server.closeAllConnections(); 
    }, 5000)
  })
}



//  close-with-grace to handle graceful shutdown

// (async () => {
//   await sleep(10000);
//   await closeServer(dodServer);
// })()

export async function main(): Promise<void> {
  const server: Server = http.createServer(createHandler());
  server.listen(3000, () => {
    console.log(`DoD server is running on ${localhost}`);
  });

  // will close on signals SIGINT, SIGTERM, SIGHUP, SIGQUIT, and uncaught exceptions
  closeWithGrace({delay: 10000}, async ({signal, err}) => {
    if(err) {
      console.error(`Error during shutdown: ${err.message}`);
    }
    console.log(`Received signal ${signal}. Shutting down gracefully...`);
    isShuttingDown = true;
    
    // if the closeServer promise is rejected, the error will bubbule to the async main function.
    // we will catch the error at the main function's call site and log it to the console.
    await closeServer(server);
    console.log('Server closed successfully');
  });

}


const isMain = process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js');
if (isMain) {
  main().catch((err) => {
    console.error(`Error in main function: ${err.message}`);
  });
}