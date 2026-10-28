import assert from "node:assert/strict";

import {
  countClientDocuments,
  filterClientDocuments,
  parseClientDocumentFilter,
} from "../src/lib/documents/client-list";
import type { DocumentStatus } from "../src/types";

const docs = (
  [
    "received",
    "reviewing",
    "processed",
    "processed",
    "rejected",
  ] as DocumentStatus[]
).map((status, id) => ({ id, status }));

assert.deepEqual(
  filterClientDocuments(docs, "pending").map((d) => d.id),
  [0, 1],
);
assert.deepEqual(
  filterClientDocuments(docs, "processed").map((d) => d.id),
  [2, 3],
);
assert.deepEqual(
  filterClientDocuments(docs, "rejected").map((d) => d.id),
  [4],
);
assert.equal(filterClientDocuments(docs, "all").length, 5);
assert.deepEqual(countClientDocuments(docs), {
  all: 5,
  pending: 2,
  processed: 2,
  rejected: 1,
});
assert.equal(parseClientDocumentFilter("rejected"), "rejected");
assert.equal(
  parseClientDocumentFilter("received"),
  "all",
  "valores internos no son filtros del cliente",
);
assert.equal(parseClientDocumentFilter(undefined), "all");

console.log("Client document filters: PASS");
