begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

-- Stable UUIDs are isolated test fixtures and are rolled back at the end.
insert into public.companies (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Security Test A', 'security-test-a'),
  ('10000000-0000-0000-0000-000000000002', 'Security Test B', 'security-test-b');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'client-a@test.invalid', '',
    '{}'::jsonb,
    '{"full_name":"Client A","role":"admin","company_id":"10000000-0000-0000-0000-000000000002"}'::jsonb,
    now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'client-b@test.invalid', '',
    '{}'::jsonb, '{"full_name":"Client B"}'::jsonb, now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin@test.invalid', '',
    '{}'::jsonb, '{"full_name":"Admin"}'::jsonb, now(), now()
  );

select is(
  (select role::text from public.profiles where id = '20000000-0000-0000-0000-000000000001'),
  'client',
  'signup metadata cannot create an admin'
);
select is(
  (select company_id from public.profiles where id = '20000000-0000-0000-0000-000000000001'),
  null,
  'signup metadata cannot self-assign a company'
);

-- Trusted onboarding fixture setup.
update public.profiles set company_id = '10000000-0000-0000-0000-000000000001'
where id = '20000000-0000-0000-0000-000000000001';
update public.profiles set company_id = '10000000-0000-0000-0000-000000000002'
where id = '20000000-0000-0000-0000-000000000002';
update public.profiles set role = 'admin'
where id = '20000000-0000-0000-0000-000000000003';

insert into public.reports (
  id, company_id, uploaded_by, title, category, period, file_url
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    'Company A report', 'Custom Report', '2026-01', 'test/a.pdf'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'Company B report', 'Custom Report', '2026-01', 'test/b.pdf'
  );

insert into public.notifications (
  id, dedupe_key, audience, kind, company_id, report_id,
  title, description, href
) values (
  '40000000-0000-0000-0000-000000000002',
  'security-test-company-b', 'client', 'report_published',
  '10000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  'Company B notification', 'test', '/dashboard/reports'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$update public.profiles set full_name = 'Allowed Name' where id = '20000000-0000-0000-0000-000000000001'$$,
  'client may update full_name'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'client cannot change role'
);
select throws_ok(
  $$update public.profiles set company_id = '10000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'client cannot change company_id'
);
select is(
  (select count(*)::integer from public.reports where id = '30000000-0000-0000-0000-000000000002'),
  0,
  'client cannot read another company report'
);
select throws_ok(
  $$insert into public.report_views (user_id, report_id) values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  'client cannot create a view for another company report'
);
select throws_ok(
  $$insert into public.notification_reads (notification_id, user_id) values ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  'client cannot write another user notification read state'
);
select throws_ok(
  $$insert into public.notification_reads (notification_id, user_id) values ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'client cannot mark another company notification as read'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$insert into public.report_views (user_id, report_id) values ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002')$$,
  'admin report access and view tracking remain operational'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$insert into public.document_processing (report_id, company_id, status) values ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'pending')$$,
  '23514', null,
  'processing company must match authoritative report company'
);

insert into public.document_processing (
  id, report_id, company_id, status
) values (
  '50000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'pending'
);

select throws_ok(
  $$insert into public.document_profiles (document_processing_id, company_id, report_id) values ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')$$,
  '23514', null,
  'profile company must match its processing source'
);
select throws_ok(
  $$insert into public.document_chunks (document_processing_id, company_id, chunk_index, content) values ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 0, 'test')$$,
  '23514', null,
  'chunk company must match parent processing company'
);
select throws_ok(
  $$insert into public.notifications (dedupe_key, audience, kind, company_id, report_id, title, description, href) values ('security-test-mismatch', 'client', 'report_published', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Mismatch', 'test', '/')$$,
  '23514', null,
  'notification entity company relationships remain consistent'
);

select * from finish();
rollback;
