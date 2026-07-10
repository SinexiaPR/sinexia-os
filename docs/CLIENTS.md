# Clients

Sinexia OS serves multiple client companies under Sinexia's administrative services. Each company has an isolated portal workspace, dedicated storage paths, and company-scoped SinexIA profiles.

This document describes the primary client types, their typical documents, current platform integrations, and planned extractor development.

---

## Overview

| Client | Slug | Sector | Portal status |
|--------|------|--------|---------------|
| CUT | `cut` | Food / operations | Active |
| CUT Meat (Cut Meat Distributors) | `cut-meat-distributors` | Meat distribution | Active |
| Tresbe | `tresbe` | Business services | Active |
| Sibarita | `sibarita` | Restaurant / food service | Active |
| Wagyu | `wagyu` | Premium meat / food | Planned onboarding |

> **Note:** Magol is also seeded in the database but is outside the scope of this document.

---

## CUT

**Company slug:** `cut`

### Typical documents

- Vendor invoices and receipts
- Operational expense documentation
- Internal administrative correspondence
- Periodic financial summaries from external systems

### Current integrations

- Client portal (inbox upload, reports, SinexIA)
- Generic document extraction (PDF, Excel, CSV)
- Standard classification pipeline

### Future extractor ideas

- Vendor invoice parser (supplier, amount, date, invoice number)
- Expense category tagging from recurring suppliers
- Monthly spend summary by vendor

---

## CUT Meat (Cut Meat Distributors)

**Company slug:** `cut-meat-distributors`

### Typical documents

- QuickBooks Customer Balance Detail / AR aging reports
- Distribution invoices
- Customer payment records
- Inventory and shipment-related administrative files

### Current integrations

- Client portal with full SinexIA access
- **QuickBooks AR specialized extractor (v1)** — parses Customer Balance Detail reports into structured AR profiles
- SinexIA suggested questions for AR (total receivables, top debtors, invoice counts)

### Future extractor ideas

- Accounts Payable aging extractor
- Customer payment history trends
- Distribution margin reports (Excel)
- Shipment log reconciliation

---

## Tresbe

**Company slug:** `tresbe`

### Typical documents

- Administrative filings and compliance documents
- Service provider invoices
- Payroll exports (Homebase or similar)
- Bank statements and reconciliation files

### Current integrations

- Client portal (inbox, reports, SinexIA)
- Generic extraction and classification
- Payroll and Homebase document type detection in pipeline

### Future extractor ideas

- Homebase payroll export parser (hours, pay periods, employee totals)
- Bank reconciliation matcher
- Monthly compliance checklist tracker

---

## Sibarita

**Company slug:** `sibarita`

### Typical documents

- Restaurant supplier invoices
- POS or sales summary exports
- Payroll and labor reports
- Food cost and vendor statements

### Current integrations

- Client portal with executive dashboard
- Document inbox and report publishing
- SinexIA Q&A on uploaded documents and published reports
- In-app notifications for document and report events

### Future extractor ideas

- Food supplier invoice parser (category, vendor, amount)
- Weekly sales summary extractor
- Labor cost vs sales ratio reports
- Tip and payroll reconciliation

---

## Wagyu

**Company slug:** `wagyu` *(planned)*

Wagyu represents premium meat and specialty food clients in Sinexia's portfolio. Portal onboarding is planned; the company is documented here for extractor roadmap alignment.

### Typical documents

- Premium product invoices and purchase orders
- Import/customs documentation
- Customer AR aging (QuickBooks or similar)
- Inventory valuation reports

### Current integrations

- Not yet onboarded to production portal
- Will inherit standard portal features on onboarding
- QuickBooks AR extractor applicable once reports are published

### Future extractor ideas

- Import document parser (duties, quantities, origin)
- Product SKU and margin analysis from sales exports
- QuickBooks AR (reuse CUT Meat extractor pattern)
- Inventory aging by product category

---

## Extractor Strategy

Sinexia OS follows a **generic-first, specialize-per-client** approach:

1. **Generic pipeline** handles all uploads (extract, classify, summarize)
2. **Specialized extractors** run when document type matches (e.g. QuickBooks AR)
3. **Client-specific rules** added only when ROI justifies maintenance cost

Priority order for new extractors:

1. QuickBooks AR/AP (high reuse across meat and food clients)
2. Payroll exports (Homebase, ADP-style)
3. Bank reconciliation
4. Industry-specific invoice formats

See [ROADMAP.md](./ROADMAP.md) for delivery timeline.
