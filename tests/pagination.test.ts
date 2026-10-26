import assert from "node:assert/strict";
import { test } from "node:test";
import { pageList } from "../src/lib/pagination";

test("номера страниц с пропусками, как в макете", () => {
  assert.deepEqual(pageList(1, 3), [1, 2, 3]);
  assert.deepEqual(pageList(1, 24), [1, 2, 3, 4, 5, "gap", 24]);
  assert.deepEqual(pageList(12, 24), [1, "gap", 11, 12, 13, "gap", 24]);
  assert.deepEqual(pageList(24, 24), [1, "gap", 20, 21, 22, 23, 24]);
});
