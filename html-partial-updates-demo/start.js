import http from "node:http";

const sleep = ms => new Promise((resolve) => setTimeout(resolve, ms));
const server = http.createServer(async (req, res) => {
   res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
   res.write(`
    <!doctype html>
    <html>
      <head>
        <title>Normal HTML Streaming</title>
      </head>
      <body>
        <h1>Normal HTML Streaming</h1>
        <p>This part arrives first.</p>
  `);
  await sleep(2000);
  res.write(`<p>This part arrives after 2 seconds.</p>`);
  await sleep(3000);
  res.end(`
        <p>This part arrives after 5 seconds.</p>
      </body>
    </html>
  `);

});
server.listen(3000, () => {
  console.log("Server is listening on port 3000");
});