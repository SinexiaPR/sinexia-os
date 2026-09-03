-- TRESBE budget: correct the Friday/Saturday/Sunday sales pattern.
--
-- The Modelo Maestro's "Forecast Diario 13W" sheet derives every day's Card
-- Net Deposit from a single card_share (~92.11%) applied uniformly across
-- all 7 weekdays -- solving gross_sales/card_share backwards from that
-- sheet's Cash and Card Net Deposit columns (which repeat identically every
-- week, like the rest of the 13W sheets) reproduces Monday-Thursday almost
-- to the cent using the values already stored here, confirming the
-- Friday/Saturday/Sunday rows were the ones left stale with an older,
-- per-weekday-varying card_share.
update tresbe_budget_sales_pattern
set gross_sales = 1958.58, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 5;

update tresbe_budget_sales_pattern
set gross_sales = 2203.53, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 6;

update tresbe_budget_sales_pattern
set gross_sales = 248.78, card_share = 0.9211
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and weekday = 7;
