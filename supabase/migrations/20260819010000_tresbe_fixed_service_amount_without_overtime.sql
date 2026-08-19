-- Fix: a fixed/manual services check (fixed_service_amount) on an hourly
-- employee (standard_hourly_40_plus_services / preset_40_hourly) was only
-- ever applied when they also had overtime hours (service_hours > 0). An
-- employee paid a flat services amount with no overtime this week had that
-- amount silently dropped from service_check_amount and employee_total, and
-- the "Motivo" defaulted to the literal string 'Otro' instead of a proper
-- services category. Already applied directly to production on
-- 2026-08-19 to fix Fernando Almonte's payroll for the week of 2026-08-10;
-- this file tracks that change in the repo.
CREATE OR REPLACE FUNCTION public.calculate_tresbe_payroll_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_service_rate NUMERIC(12,2);
BEGIN
  v_service_rate := COALESCE(NEW.service_rate_snapshot, NEW.regular_rate_snapshot, 0);
  NEW.system_hours := 0;
  NEW.service_hours := 0;
  NEW.system_pay := 0;
  NEW.service_check_amount := 0;
  NEW.service_reason := NULLIF(trim(COALESCE(NEW.service_reason, '')), '');

  CASE NEW.payroll_rule_snapshot
    WHEN 'unconfigured' THEN NULL;
    WHEN 'standard_hourly_40_plus_services' THEN
      NEW.system_hours := LEAST(NEW.total_weekly_hours, 40);
      NEW.service_hours := GREATEST(NEW.total_weekly_hours - 40, 0);
      NEW.system_pay := round(NEW.system_hours * COALESCE(NEW.regular_rate_snapshot, 0), 2);
      NEW.service_check_amount := CASE
        WHEN NEW.fixed_service_amount > 0
          THEN round(NEW.fixed_service_amount, 2)
        ELSE round(NEW.service_hours * v_service_rate, 2)
      END;
      IF NEW.service_hours > 0 THEN
        NEW.service_reason := 'Horas sobre 40';
      ELSIF NEW.fixed_service_amount > 0 THEN
        NEW.service_reason := CASE
          WHEN NEW.service_reason IS NULL OR NEW.service_reason = 'Otro'
            THEN 'Empleado por servicios'
          ELSE NEW.service_reason
        END;
      END IF;
    WHEN 'preset_40_hourly' THEN
      NEW.system_hours := LEAST(NEW.total_weekly_hours, 40);
      NEW.service_hours := GREATEST(NEW.total_weekly_hours - 40, 0);
      NEW.system_pay := round(NEW.system_hours * COALESCE(NEW.regular_rate_snapshot, 0), 2);
      NEW.service_check_amount := CASE
        WHEN NEW.fixed_service_amount > 0
          THEN round(NEW.fixed_service_amount, 2)
        ELSE round(NEW.service_hours * v_service_rate, 2)
      END;
      IF NEW.service_hours > 0 THEN
        NEW.service_reason := 'Horas sobre 40';
      ELSIF NEW.fixed_service_amount > 0 THEN
        NEW.service_reason := CASE
          WHEN NEW.service_reason IS NULL OR NEW.service_reason = 'Otro'
            THEN 'Empleado por servicios'
          ELSE NEW.service_reason
        END;
      END IF;
    WHEN 'full_services' THEN
      NEW.service_hours := NEW.total_weekly_hours;
      NEW.service_check_amount := CASE
        WHEN NEW.fixed_service_amount > 0 THEN round(NEW.fixed_service_amount, 2)
        WHEN COALESCE(NEW.weekly_salary_snapshot, 0) > 0
          THEN round(NEW.weekly_salary_snapshot, 2)
        ELSE round(NEW.service_hours * v_service_rate, 2)
      END;
      NEW.service_reason := COALESCE(NEW.service_reason, 'Empleado por servicios');
    WHEN 'preset_40_weekly_salary' THEN
      NEW.system_hours := NEW.total_weekly_hours;
      NEW.system_pay := round(COALESCE(NEW.weekly_salary_snapshot, 0), 2);
    WHEN 'fixed_weekly_salary' THEN
      NEW.system_hours := NEW.total_weekly_hours;
      NEW.system_pay := round(COALESCE(NEW.weekly_salary_snapshot, 0), 2);
    WHEN 'custom_manual' THEN
      NEW.system_hours := NEW.total_weekly_hours;
      NEW.system_pay := round(NEW.manual_system_amount, 2);
      NEW.service_check_amount := round(NEW.fixed_service_amount, 2);
      IF NEW.service_check_amount > 0 THEN
        NEW.service_reason := COALESCE(NEW.service_reason, 'Ajuste manual');
      END IF;
  END CASE;

  NEW.employee_total := round(
    NEW.system_pay + NEW.tips + NEW.service_check_amount + NEW.other_adjustments,
    2
  );
  RETURN NEW;
END;
$function$;
