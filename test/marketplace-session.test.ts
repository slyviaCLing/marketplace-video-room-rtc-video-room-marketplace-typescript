import assert from "node:assert/strict";
import { planSession } from "../src/marketplace-session.ts";

const planned = planSession({ orderId: "o-1", sellerId: "s-1", buyerId: "b-1", assetKey: "cut.mp4" });
assert.equal(planned.channel, "order-o-1");
assert.equal(planned.bucket, "marketplace-s-1");
assert.equal(planned.request.region, "auto");
assert.throws(() => planSession({ orderId: "", sellerId: "s-1", buyerId: "b-1", assetKey: "cut.mp4" }));
console.log("marketplace session boundary: passed");
