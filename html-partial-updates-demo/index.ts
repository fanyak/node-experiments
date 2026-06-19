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
const localhost = 'http://localhost:3000'
const pathname = '/dodbook';

const nodeTags: Array<string> = Array.from({ length: 12 }, (_, i) => `Node${i + 1}`);
console.log(nodeTags);

async function fetchNode(nodeTag: string): Promise<ApiResponse<Record<string, string>>> { 
  const res = await fetch(`${localhost}${pathname}?node=${nodeTag}`);
  if (!res.ok) {
    return {
      type: "error",
      message: `Failed to fetch node content: ${res.statusText}`
    };
  }
  let result = await res.json();
  console.log(result['5']);
  return {
    type: "success",
    data: result
  };
}

fetchNode("node5").then(response => {
  if (response.type === "success") {
    console.log("Node content:", response.data);
  } else {
    console.error("Error fetching node:", response.message);
  }
});