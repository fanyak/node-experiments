import http from "node:http";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = http.createServer(async (req, res) => {
	res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
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

// async function fetchMultiple(urls = ['http://localhost:3000/dodbook?node=node1','http://localhost:3000/dodbook?node=nodes']) {
//   const results = await Promise.allSettled(
//     urls.map((url) => fetch(url).then((r) => r.text()))
//   );

//   const map = new Map();
//   urls.forEach((url, i) => {
//     const result = results[i];
//     map.set(
//       url,
//       result.status === 'fulfilled' ? result.value : result.reason
//     );
//   });

//   return map;
// }
// console.log(await fetchMultiple());
