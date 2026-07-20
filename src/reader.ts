import { doFetch } from './fetch.js';
doFetch({path: 'http://localhost:3000'}).then(async (response) => {
  const reader = response.body?.getReader();
	const decoder = new TextDecoder();
  while (true)  {
    const {done, value } = await reader?.read() || {};
    if (done) {
      break;
    }
    const chunk = decoder.decode(value);
    console.log(chunk);
  }
  reader?.releaseLock();
});