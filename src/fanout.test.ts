import assert from "node:assert/strict";
import { buildNotifications } from "./fanout.ts";

const post = { creatorId: "c1", title: "Behind the scenes", signedDownload: "https://cdn.example.test/post-1" };
const subscribers = [{ subscriberId: "s1", destination: "one@example.test" }, { subscriberId: "s2", destination: "two@example.test" }];
const result = buildNotifications(post, subscribers);
assert.equal(result.length, 2);
assert.deepEqual(result.map((item) => item.subscriberId), ["s1", "s2"]);
assert.equal(result[1].signedDownload, post.signedDownload);
console.log("fanout decision test passed");
