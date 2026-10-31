const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "app", "(tabs)", "orders.js"),
  "utf8",
);

test("orders refresh failure does not clear previously loaded orders", () => {
  const catchBlock = source.match(/} catch \(err\) \{([\s\S]*?)\n      } finally/);
  assert.ok(catchBlock, "orders loader catch block should exist");
  assert.match(catchBlock[1], /setError\(/);
  assert.doesNotMatch(catchBlock[1], /setOrders\(\[\]\)/);
});
