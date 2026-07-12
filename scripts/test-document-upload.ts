import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CLIENT_DOCUMENT_TYPES,
  validateDocumentUploadMetadata,
} from "@/lib/documents/upload-metadata";

assert.deepEqual(CLIENT_DOCUMENT_TYPES, [
  "Invoice",
  "Receipt",
  "Bank Statement",
  "Payment Receipt",
  "Payroll / Timesheets",
  "Tax Document",
  "Contract",
  "Identification",
  "Other",
]);

assert.deepEqual(
  validateDocumentUploadMetadata({
    documentType: "Invoice",
    priority: "routine",
    comment: "",
    typeDescription: "",
  }),
  {},
);
assert.deepEqual(
  validateDocumentUploadMetadata({
    documentType: "Receipt",
    priority: "urgent",
    comment: "Please process today.",
    typeDescription: "",
  }),
  {},
);
assert.match(
  validateDocumentUploadMetadata({
    documentType: "Invoice",
    priority: "routine",
    comment: "x".repeat(501),
    typeDescription: "",
  }).error ?? "",
  /500/,
);

const form = readFileSync(
  join(process.cwd(), "src/components/dashboard/document-upload-form.tsx"),
  "utf8",
);
for (const removedName of [
  'name="amount"',
  'name="due_date"',
  'name="invoice_date"',
  'name="invoice_number"',
  'name="supplier"',
  'name="created_at"',
]) {
  assert.equal(
    form.includes(removedName),
    false,
    `${removedName} must not appear`,
  );
}
for (const requiredName of [
  'name="document_type"',
  'name="priority"',
  'name="comment"',
  'name="file"',
]) {
  assert.equal(
    form.includes(requiredName),
    true,
    `${requiredName} is required`,
  );
}

const action = readFileSync(
  join(process.cwd(), "src/actions/documents.ts"),
  "utf8",
);
assert.equal(action.includes('formData.get("created_at")'), false);
assert.equal(action.includes("created_at:"), false);

console.log("DOCUMENT UPLOAD TESTS PASS");
