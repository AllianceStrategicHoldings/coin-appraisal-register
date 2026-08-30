-- Payment detail (operator feedback 2026-08-30): check number, wire number,
-- or free-text description when payment method is "other". Required in the
-- app whenever those methods are selected; cash deals carry NULL.

alter table deal_log add column if not exists payment_detail text;
