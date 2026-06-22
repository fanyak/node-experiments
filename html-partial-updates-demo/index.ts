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

const {localhost, pathname, DoDhost, tagLimit} = process.env;

const nodeTags: Array<string> = Array.from({ length: 12 }, (_, i) => `Node${i + 1}`);
console.log(nodeTags);

async function fetchNode(nodeTag: string): Promise<ApiResponse<string>> { 
  const res = await fetch(`${localhost}${pathname}?node=${nodeTag}`);
  if (!res.ok) {
    return {
      type: "error",
      message: `status code: ${res.status}. \n Failed to fetch node content: ${res.statusText}`
    };
  }
  let result = await res.text();
  return {
    type: "success",
    data: result
  };
}
const nodeTag = process.argv.slice(2)[0] || "node1";
fetchNode(nodeTag).then(response => {
  if (response.type === "success") {
    console.log("Node content:", response.data);
  } else {
    console.error("Error fetching node:", response.message);
  }
}).catch(error => { // this will be called when server can't be reached
  console.log("server error", error);
});