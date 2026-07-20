import { noderegx } from "./utils.js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import pLimit from 'p-limit';
const limit = pLimit(5); // Max 5 concurrent operations
loadEnvFile(); // load vars to process.env
/** narrow the type UserId to ValidUserId */
function assertValidUserId(userId) {
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
        throw new Error("Invalid user ID format");
    }
}
async function fetchUser(userId) {
    assertValidUserId(userId);
    // at this point userId is narrowed to ValidUserId after the assertion check
    try {
        const res = await fetch(`${localhost}:${port}/api/users/${userId}`);
        if (!res.ok) {
            return {
                type: "error",
                message: `Failed to fetch user: ${res.statusText}`,
            };
        }
        const data = await res.json();
        return {
            type: "success",
            data,
        };
    }
    catch (error) {
        return {
            type: "error",
            message: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
// get vars from process.env
const { localhost, pathname, DoDhost, tagLimit, staticPath, port } = process.env;
function getTagLimit(tagLimit) {
    if (tagLimit === undefined) {
        throw new Error("tagLimit is not defined in environment variables");
    }
    return parseInt(tagLimit);
}
// No try/catch needed here because errors will be handled in Promise.allSettled() below.
// Additionally, aborted promises will also be handled in Promise.allSettled() below, so no need to handle them here.
async function getNodeDoc(nodeTag) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout
    console.log(parseInt(nodeTag.substring(4)));
    const res = await fetch(`${localhost}:${port}${pathname}?node=${nodeTag}`, {
        method: "GET",
        headers: {
            Connection: parseInt(nodeTag.substring(4)) <= getTagLimit(tagLimit)
                ? "keep-alive"
                : "close",
        },
        signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
        return {
            type: "error",
            message: `status code: ${res.status}. \n Failed to fetch node content: ${res.statusText}`,
        };
    }
    const data = (await res.text());
    return {
        type: "success",
        data,
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
    const nodeTags = Array.from({ length: getTagLimit(tagLimit) }, (_, i) => `node${i + 1}`);
    const urls = nodeTags.map((nodeTag) => limit(() => getNodeDoc(nodeTag)));
    Promise.allSettled(urls)
        .then((responses) => {
        return responses.reduce((acc, current) => {
            // fullfilled responses maybe of type SuccessResponse or ErrorResponse
            if (current.status === "fulfilled") {
                if (current.value.type === "success") {
                    acc.push(current.value.data);
                }
            }
            else {
                console.log(`Error fetching node: ${current.reason}`);
            }
            return acc;
        }, []);
    })
        .then((results) => {
        results.forEach((result, index) => {
            const filePath = join(process.cwd(), staticPath || "static", `node${index + 1}.html`);
            writeFileSync(filePath, result, "utf-8");
            console.log(`All node content has been written to ${filePath}`);
        });
    })
        .catch((error) => {
        console.error("Error fetching nodes:", error);
    });
}
else if (noderegx.test(args[0])) {
    const nodeTag = args[0];
    getNodeDoc(nodeTag)
        .then((response) => {
        if (response.type === "success") {
            // return response to cli
            console.log("Node content:", response.data);
        }
        else {
            console.error("Error fetching node:", response.message);
        }
    })
        .catch((error) => {
        // this will be called when server can't be reached
        console.log("server error", error);
    });
}
else {
    console.error("Unknown argument. Please provide a valid node tag or 'all' as an argument.");
    process.exit(1);
}
