# Admin Invoicing

Sinexia OS includes a generic, administrator-managed invoicing module. It prepares and publishes Sinexia service invoices; it does not turn the portal into accounting software.

## Lifecycle and numbering

Drafts have only an internal UUID. `issue_invoice()` locks the draft and the `sinexia_global_invoice` sequence row, recalculates totals, increments the global number and records the issuance audit events in one database transaction. The confirmed legacy references 212–215 seed continuity, making 216 the first new official number.

Issued financial content, items, invoice number and stored PDF are immutable. Cancelling an issued invoice retains its number. Deleting is limited to drafts and therefore never consumes a number.

## Authorization and storage

All creation, configuration, issuance, email, payment and cancellation routes require an authenticated administrator. Clients can select only published invoices whose `company_id` matches their authenticated profile and only when their company billing profile enables the module.

Internal notes are stored separately in an admin-only table. They never share the client-readable invoice row, so row access to an authorized invoice cannot expose private administrator notes.

Final PDFs live in the private `invoices` bucket. The authenticated download route validates invoice access and returns a short-lived signed URL. Provider and service-role credentials remain server-side.

## Recurring preparation

Recurring profiles only identify invoices that are due and pre-fill a new draft. Administrators must review, issue and explicitly confirm email delivery. No automatic issuance or sending exists in this version.

## Corrections and future credit notes

An issued invoice must never be edited silently. Current corrections use cancellation plus a replacement draft that receives a new number when issued. A future credit-note workflow should use a separate immutable credit-note table and atomic sequence, reference the original invoice, store signed negative line items, publish its own PDF and audit events, and apply the credit to reporting without changing the original invoice.
