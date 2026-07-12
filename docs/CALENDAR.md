# Admin Calendar Architecture

The internal calendar is an admin-only operational module. Server pages require `requireAdmin()` and all three calendar tables enforce the same boundary through `public.is_admin()` RLS policies. Client profiles cannot select, insert, update, or delete calendar items, comments, or occurrence exceptions.

## Recurrence

Recurring work is stored as one `calendar_items` row with a compact JSON rule. The application expands occurrences only for the requested date range. `calendar_item_occurrence_status` stores exceptions such as completing, cancelling, renaming, or rescheduling one occurrence. Editing “this and future” closes the original series and creates a linked continuation through `recurrence_parent_id`; it never generates future rows.

All-day work uses `event_date` (`DATE`) and has no timestamps, so timezone conversion cannot move it to another day. Timed work is stored in UTC and retains its IANA timezone for display. The operational default is `America/Puerto_Rico`.

## Notifications

Database triggers create deduplicated admin notifications for assignments, urgent items, comments, and completion. `emit_calendar_due_notifications()` is designed for one daily Supabase Cron call; its date-based dedupe key prevents more than one due-today notification per task per day. Notifications can target one admin through `target_user_id`. Clients cannot read admin notifications.

## Future Google Calendar synchronization

`external_provider`, `external_event_id`, and `last_synced_at` are reserved on each item. A future server-side synchronization worker can map internal items to provider events, persist the external identifier, and use `updated_at`/`last_synced_at` for conflict handling. The internal calendar remains authoritative, recurrence exceptions remain intact, and no provider credentials need to reach client components.
