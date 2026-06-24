import { noderegx } from "./utils.js";
import {writeFileSync} from "node:fs";
import {loadEnvFile} from "node:process"

loadEnvFile(); // load vars to process.env

interface User {
  id: string;
  name: string;
  email: string;
}

interface FetchResponse {
  type: "success" | "error";
}

interface ErrorResponse extends FetchResponse {
  type: "error";
  message: string;
}

interface SuccessResponse<T> extends FetchResponse {
  type: "success";
  data: T
}

type ValidUserId = string & { __brand: "ValidUserId" };

/** narrow the type UserId to ValidUserId */
function assertValidUserId(userId: string): asserts userId is ValidUserId {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error("Invalid user ID format");
  }
}

export type ApiResponse<T> = ErrorResponse | SuccessResponse<T>;

async function fetchUser(userId: string): Promise<ApiResponse<User>> {

  assertValidUserId(userId);

  // at this point userId is narrowed to ValidUserId after the assertion check
  try {
  const res = await fetch(`/api/users/${userId}`);
    if (!res.ok) {
      return {
        type: "error",
        message: `Failed to fetch user: ${res.statusText}`
      };
    }
    const data: User = await res.json();
    return {
      type: "success",
      data
    };
  } catch (error) {
    return ({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error"
    })
  }  
}

// get vars from process.env
const {localhost, pathname, DoDhost, tagLimit} = process.env;

type TagLimit = number & { __brand: "TagLimit" };

function getTagLimit(tagLimit: string | undefined): TagLimit {
  if (tagLimit === undefined) {
    throw new Error("tagLimit is not defined in environment variables");
  }  
  return parseInt(tagLimit) as TagLimit;
}

async function fetchNode(nodeTag: string): Promise<ApiResponse<Document>> { 
  const res:Response = await fetch(`${localhost}${pathname}?node=${nodeTag}`, {
    method: "GET",
    headers: {
      "Connection": parseInt(nodeTag.substring(4)) <= getTagLimit(tagLimit) ? "keep-alive" : "close"
    }
  });
  if (!res.ok) {
    return {
      type: "error",
      message: `status code: ${res.status}. \n Failed to fetch node content: ${res.statusText}`
    };
  }
  const data: Document = await res.text() as unknown as Document;
  return {
    type: "success",
    data
  };
}
// CLI logic

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Please provide a node tag as an argument.");
  process.exit(1);
}
if (args.length > 1) {
  console.error("Please provide only one node tag as an argument or 'all' as argument.");
  process.exit(1);
}
if (args[0] === "all") { 

  const nodeTags: Array<string> = Array.from({ length: getTagLimit(tagLimit) }, (_, i) => `node${i + 1}`);

  const urls: Array<Promise<ApiResponse<Document>>> = nodeTags.map(nodeTag => fetchNode(nodeTag));
  
  Promise.allSettled(urls).then((responses: Array<PromiseSettledResult<ApiResponse<Document>>>) => {
   return responses.reduce((acc: Array<Document>, current: PromiseSettledResult<ApiResponse<Document>>) => {
      // fullfilled responses maybe of type SuccessResponse or ErrorResponse
      if (current.status === "fulfilled") {
          if (current.value.type === 'success') {
          acc.push(current.value.data);    
        }   
      }
       return acc;
    }, [] as Array<Document>);
  }).then((results: Array<Document>) => {
    results.forEach((result: Document, index) =>{
    const filePath = `./node${index + 1}.html`;
    writeFileSync(filePath, (result as unknown as string), "utf-8");
    console.log(`All node content has been written to ${filePath}`);});
    
  }).catch((error) => {
    console.error("Error fetching nodes:", error);
  });

}

if (noderegx.test(args[0])) {
  const nodeTag = args[0];
  fetchNode(nodeTag).then(response => {
    if (response.type === "success") {
      // return response to cli
      console.log("Node content:", response.data);
    } else {
      console.error("Error fetching node:", response.message);
    }
  }).catch(error => { // this will be called when server can't be reached
    console.log("server error", error);
});
}


