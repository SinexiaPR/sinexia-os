-- TRESBE budget: restore the sales pattern to the values verified against
-- "Forecast Diario 13W" (which repeats the exact same figures every week
-- and hasn't changed since they were first derived). The stored pattern
-- had drifted to slightly different gross_sales/card_share values
-- (e.g. weekday 1: 2701.97/0.9212 instead of 2694.71/0.9211), which no
-- longer reproduce that sheet's Cash/Card Net Deposit columns exactly.
update tresbe_budget_sales_pattern set gross_sales = 2694.71, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 1;
update tresbe_budget_sales_pattern set gross_sales = 2128.79, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 2;
update tresbe_budget_sales_pattern set gross_sales = 2407.92, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 3;
update tresbe_budget_sales_pattern set gross_sales = 1258.55, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 4;
update tresbe_budget_sales_pattern set gross_sales = 1958.58, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 5;
update tresbe_budget_sales_pattern set gross_sales = 2203.53, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 6;
update tresbe_budget_sales_pattern set gross_sales = 248.78, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 7;
