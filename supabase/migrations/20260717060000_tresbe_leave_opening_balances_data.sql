-- Loads hiring dates and historical (pre-import) vacation/sick balances for
-- Tresbe employees from "Calculo_Vacaciones_Enfermedad_Tresbe.xlsx", a
-- richer workbook than the one used by the earlier hiring_date backfill
-- (20260716120000): it also includes a "Resumen empleados" sheet with a
-- pre-calculated balance per employee as of their last recorded pay date,
-- computed with the same PR-law rules this module implements (130h/month
-- threshold, tenure-tiered vacation accrual, 8h/month sick capped at 120h).
--
-- Same constraint as the earlier backfill: only updates/seeds employees that
-- already exist and are active in tresbe_employees, matched unambiguously by
-- normalized name (or alias); never creates new employees. hiring_date is
-- overwritten unconditionally for matches since this newer sheet is now the
-- source of truth (values already agree with the prior backfill for the 281
-- previously-matched employees, per manual verification).
--
-- The balance from the sheet is stored as a durable "opening balance" (see
-- employee_leave_opening_balances, added in the prior migration) rather than
-- written a second time somewhere that a future payroll-triggered replay
-- would silently overwrite. It is also copied directly into
-- employee_leave_balances so the admin report shows correct current
-- balances immediately, without waiting for the next payroll cycle to run
-- replayAndPersistBalance() for every one of these employees.

DROP TABLE IF EXISTS pg_temp.tresbe_leave_opening_20260717;
CREATE TEMP TABLE tresbe_leave_opening_20260717 (
  normalized_name TEXT PRIMARY KEY,
  hiring_date DATE NOT NULL,
  opening_vacation_hours NUMERIC(8,2) NOT NULL,
  opening_sick_hours NUMERIC(8,2) NOT NULL,
  as_of_year INTEGER NOT NULL,
  as_of_month INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tresbe_leave_opening_20260717 VALUES
  ('isabel cristina abreu gonzalez', DATE '2022-07-06', 4, 8, 2022, 8),
  ('juan c acevedo', DATE '2023-02-22', 20, 40, 2023, 9),
  ('ramon acevedo', DATE '2022-01-26', 0, 0, 2022, 1),
  ('vidal j acevedo', DATE '2023-06-14', 0, 0, 2023, 8),
  ('doel a acosta', DATE '2023-08-02', 166, 120, 2026, 7),
  ('jesus alejandro aguiar', DATE '2021-08-25', 36, 72, 2022, 12),
  ('alvarez rivas alejandra gabriela', DATE '2022-06-29', 8, 16, 2024, 1),
  ('bryan algarin', DATE '2025-03-12', 12, 16, 2026, 7),
  ('jimmy allende guzman', DATE '2021-02-24', 0, 0, 2021, 3),
  ('fernando almonte', DATE '2021-01-20', 342, 120, 2026, 7),
  ('jose alvarez', DATE '2022-02-16', 0, 0, 2022, 4),
  ('roman alvarez', DATE '2022-10-12', 0, 0, 2023, 9),
  ('sarai m alvarez', DATE '2022-08-24', 8, 16, 2022, 12),
  ('gabriel alvarez velez', DATE '2022-01-27', 66, 120, 2023, 5),
  ('jesus amadeo', DATE '2024-03-13', 0, 0, 2026, 3),
  ('cirilo aponte camacho', DATE '2021-05-19', 0, 0, 2021, 5),
  ('emmanuel aponte', DATE '2025-08-27', 0, 0, 2026, 2),
  ('jafet aponte santiago', DATE '2021-09-15', 0, 0, 2021, 9),
  ('alejandra arguello', DATE '2021-01-20', 0, 0, 2021, 2),
  ('rafael arias', DATE '2023-09-06', 0, 0, 2025, 7),
  ('irvin a arroyo', DATE '2022-11-30', 0, 0, 2023, 1),
  ('ines ati', DATE '2023-01-25', 0, 0, 2023, 3),
  ('nelvin j ayala bernier', DATE '2022-06-22', 0, 0, 2022, 9),
  ('jason ayala', DATE '2025-07-16', 0, 0, 2025, 9),
  ('noel enrique ayala', DATE '2021-08-04', 0, 0, 2021, 9),
  ('sylmarie benitez de leon', DATE '2021-08-11', 32, 64, 2022, 12),
  ('samantha berg', DATE '2023-08-16', 0, 0, 2023, 10),
  ('wilfredo bernazar', DATE '2021-01-20', 20, 40, 2022, 2),
  ('abdiel bonilla gomez', DATE '2023-11-01', 0, 0, 2023, 11),
  ('andrea del mar boria denis', DATE '2021-12-08', 16, 12, 2023, 6),
  ('carlos borrego santos', DATE '2021-03-31', 0, 0, 2021, 4),
  ('adrian bracero', DATE '2023-03-08', 8, 16, 2026, 3),
  ('joel brauer cardin', DATE '2022-05-11', 270, 120, 2026, 7),
  ('carlos burgos', DATE '2021-09-08', 16, 32, 2022, 1),
  ('carolina calimano', DATE '2025-06-11', 0, 0, 2025, 11),
  ('nashaly kamile calo guadalupe', DATE '2022-03-22', 8, 16, 2022, 7),
  ('daymary caraballo gonzalez', DATE '2022-05-11', 12, 24, 2023, 11),
  ('angelo carrasquillo', DATE '2022-08-03', 16, 32, 2023, 1),
  ('gabriel carreira', DATE '2023-01-11', 0, 0, 2023, 1),
  ('deborah a carreras capetillo', DATE '2021-02-10', 4, 8, 2021, 11),
  ('chandra carrion', DATE '2022-08-24', 0, 0, 2022, 11),
  ('henry casiano', DATE '2023-09-20', 118, 40, 2026, 7),
  ('louis castillo', DATE '2021-01-20', 174, 0, 2024, 7),
  ('fabian e castro vazquez', DATE '2021-01-20', 44, 80, 2022, 12),
  ('diego joel centeno monge', DATE '2023-12-13', 4, 8, 2024, 8),
  ('alberto l chaves', DATE '2026-03-11', 12, 24, 2026, 7),
  ('jan a chico', DATE '2023-03-15', 0, 0, 2023, 5),
  ('charles c. chiques prieto', DATE '2024-03-06', 0, 0, 2024, 5),
  ('veronica sofia colon cabrera', DATE '2022-02-16', 0, 0, 2022, 3),
  ('abraham colon lozada', DATE '2022-03-09', 0, 0, 2022, 3),
  ('jose yamil colon ortiz', DATE '2021-07-07', 8, 16, 2021, 10),
  ('george contreras', DATE '2023-02-15', 8, 16, 2023, 9),
  ('hernan f corales santos', DATE '2022-01-26', 0, 0, 2022, 2),
  ('wilfredo cosme', DATE '2023-10-18', 4, 8, 2024, 5),
  ('jose j cotto', DATE '2022-01-19', 0, 0, 2022, 2),
  ('niurka cruz fernandez', DATE '2022-02-02', 0, 0, 2022, 2),
  ('adalberto j cuadrado', DATE '2023-01-25', 92, 120, 2026, 7),
  ('daniel custodio', DATE '2022-11-30', 34, 16, 2025, 2),
  ('aleksandra cybulska', DATE '2022-02-10', 0, 0, 2022, 2),
  ('carlos a davila', DATE '2022-03-02', 0, 0, 2022, 8),
  ('esteban emmanuel de jesus hernandez', DATE '2022-02-02', 0, 0, 2022, 4),
  ('lee j de jesus sanchez', DATE '2022-02-03', 4, 8, 2026, 7),
  ('amanda c de leon', DATE '2023-05-03', 0, 0, 2023, 7),
  ('ian e de leon', DATE '2023-07-19', 8, 16, 2023, 10),
  ('chiara de virgilio', DATE '2021-05-19', 0, 0, 2022, 8),
  ('miguel angel delgado falcon', DATE '2021-12-01', 0, 0, 2022, 1),
  ('jorge andres diaz alonso', DATE '2021-08-16', 0, 0, 2022, 3),
  ('jeffrey diaz burns', DATE '2022-01-19', 0, 0, 2022, 2),
  ('giovan diaz', DATE '2021-08-04', 8, 16, 2021, 11),
  ('lara maria diaz kelly', DATE '2023-11-01', 0, 0, 2023, 11),
  ('fabiola diaz marquez', DATE '2022-06-22', 4, 8, 2022, 8),
  ('miguel diaz ramos', DATE '2022-01-12', 4, 8, 2022, 6),
  ('pedro andres diaz rivera', DATE '2022-01-19', 0, 0, 2022, 1),
  ('sabrina el-masry', DATE '2021-07-21', 0, 0, 2021, 8),
  ('ruben escalera', DATE '2024-05-22', 4, 8, 2024, 7),
  ('manuel espinal', DATE '2021-01-20', 20, 40, 2021, 7),
  ('angel r esteves umpierre', DATE '2021-07-28', 0, 0, 2021, 7),
  ('michael a ewell iii', DATE '2022-12-14', 0, 0, 2022, 12),
  ('gil m fernandez', DATE '2022-10-12', 16, 24, 2026, 3),
  ('aalyah figueroa', DATE '2022-10-26', 12, 24, 2023, 4),
  ('juan daniel figueroa', DATE '2021-04-21', 4, 8, 2021, 6),
  ('estefania firpi caceres', DATE '2021-07-14', 4, 8, 2021, 8),
  ('ian andrew flagle', DATE '2022-02-02', 0, 0, 2022, 2),
  ('javier flores', DATE '2023-10-18', 0, 0, 2023, 10),
  ('shirley florian', DATE '2021-01-20', 8, 16, 2021, 3),
  ('kiara fonseca', DATE '2021-08-11', 0, 0, 2021, 8),
  ('joshua fontanez', DATE '2025-09-24', 24, 24, 2026, 5),
  ('ana e fortuno', DATE '2025-07-16', 0, 0, 2025, 7),
  ('oscar fortuno', DATE '2024-07-03', 4, 8, 2026, 3),
  ('soraya franceschi martinez', DATE '2021-07-01', 0, 0, 2021, 9),
  ('yailianys franco fuentes', DATE '2021-12-22', 0, 0, 2022, 6),
  ('paola c franco negron', DATE '2026-03-11', 0, 0, 2026, 7),
  ('janelis m garcia', DATE '2025-11-19', 0, 0, 2025, 12),
  ('giovanni a garcia malaret', DATE '2021-06-23', 0, 0, 2021, 9),
  ('patria garcia', DATE '2021-01-20', 38, 34, 2022, 12),
  ('gia garraton taveras', DATE '2022-01-19', 126, 67, 2025, 12),
  ('gino gelpi', DATE '2022-02-16', 16, 32, 2022, 6),
  ('maribel gil', DATE '2021-07-21', 8, 16, 2021, 10),
  ('antonio gomez', DATE '2021-02-17', 0, 0, 2021, 6),
  ('guillermo gonzalez', DATE '2021-09-08', 40, 80, 2022, 12),
  ('jan carlos gonzalez', DATE '2021-07-28', 0, 0, 2021, 9),
  ('jazieel m gonzalez', DATE '2023-01-04', 0, 0, 2023, 1),
  ('jonathan gonzalez', DATE '2022-08-31', 12, 24, 2022, 11),
  ('kevin gonzalez', DATE '2023-10-18', 0, 0, 2023, 12),
  ('raymond gonzalez negron', DATE '2022-03-30', 0, 0, 2022, 4),
  ('allayah gonzalez rodriguez', DATE '2021-07-21', 0, 0, 2021, 7),
  ('anais gonzalez rodriguez', DATE '2021-09-22', 16, 32, 2022, 12),
  ('sergio a gonzalez', DATE '2022-03-30', 0, 0, 2022, 5),
  ('piper hamlett', DATE '2021-11-10', 0, 0, 2021, 12),
  ('charlyn hernandez', DATE '2022-02-09', 0, 0, 2022, 3),
  ('janelis herrera madera', DATE '2021-06-23', 0, 0, 2021, 6),
  ('lee zephyrinus p irene', DATE '2026-03-18', 12, 24, 2026, 7),
  ('yadiel irizarry', DATE '2023-08-16', 0, 0, 2023, 8),
  ('xavier jemison', DATE '2022-02-09', 4, 8, 2022, 5),
  ('natalia p jimenez', DATE '2023-05-10', 0, 0, 2023, 6),
  ('cristina jiminian ocasio', DATE '2022-02-23', 248, 120, 2026, 2),
  ('ilya ledesma solis', DATE '2022-02-02', 16, 32, 2022, 6),
  ('haidie lee cabral lopez', DATE '2021-12-15', 4, 8, 2022, 2),
  ('josue a llorens gonzalez', DATE '2022-02-23', 0, 0, 2022, 4),
  ('lindsey a loftus', DATE '2022-10-26', 30, 56, 2024, 1),
  ('arturo lopez', DATE '2021-01-20', 50, 18, 2024, 12),
  ('marc a lopez', DATE '2024-09-11', 28, 56, 2026, 7),
  ('caroline lopez vizcarrondo', DATE '2021-12-29', 16, 32, 2023, 5),
  ('ema loran royk', DATE '2022-01-19', 0, 0, 2022, 2),
  ('sabrina lowe', DATE '2021-01-20', 14, 24, 2022, 5),
  ('vincent luke', DATE '2023-05-03', 4, 8, 2023, 6),
  ('joshua francis lynch', DATE '2021-11-24', 8, 16, 2022, 11),
  ('gregory k maldonado', DATE '2021-11-24', 8, 16, 2022, 7),
  ('julian esteban manolo mousterou', DATE '2023-11-22', 0, 0, 2024, 1),
  ('liu marengo tort', DATE '2022-08-03', 4, 8, 2022, 10),
  ('juan marcelo marquez', DATE '2021-08-25', 0, 0, 2021, 9),
  ('claudio antonio marrero reynoso', DATE '2021-08-04', 8, 16, 2021, 9),
  ('angel martes de jesus', DATE '2022-03-16', 4, 8, 2022, 5),
  ('alberto javier martin', DATE '2021-08-11', 0, 0, 2021, 8),
  ('alondra martinez', DATE '2023-01-11', 88, 120, 2026, 7),
  ('john martinez bristol', DATE '2023-11-22', 4, 8, 2024, 3),
  ('enrique martinez', DATE '2021-01-20', 20, 40, 2021, 6),
  ('roberto martinez', DATE '2022-10-19', 0, 0, 2022, 10),
  ('cristaleysha matos rodriguez', DATE '2022-04-13', 16, 32, 2022, 8),
  ('cristian medina', DATE '2021-01-20', 4, 8, 2021, 12),
  ('antonio mendez cruz', DATE '2021-11-03', 0, 0, 2021, 11),
  ('zion mendez laygre', DATE '2022-01-19', 4, 8, 2022, 2),
  ('william mendez rivera', DATE '2021-12-01', 4, 8, 2022, 2),
  ('yonnhy b mendez', DATE '2021-06-23', 0, 0, 2021, 6),
  ('jorge luis mercado colon', DATE '2021-09-01', 4, 8, 2021, 9),
  ('veronica molina marrero', DATE '2021-12-01', 0, 0, 2021, 12),
  ('isabel a molinari', DATE '2023-09-06', 0, 0, 2023, 10),
  ('jorge montero', DATE '2023-07-12', 0, 0, 2023, 11),
  ('ryan isaac montes nunez', DATE '2021-11-03', 12, 24, 2022, 2),
  ('shannan merced moore', DATE '2021-08-11', 0, 0, 2021, 8),
  ('alana morales', DATE '2022-11-23', 0, 0, 2023, 2),
  ('thomas moran', DATE '2021-04-21', 24, 48, 2022, 3),
  ('michael emil moreno aponte', DATE '2022-02-09', 0, 0, 2022, 2),
  ('claritza mota jaime', DATE '2021-07-21', 46, 64, 2025, 12),
  ('krystalee nazario rodriguez', DATE '2022-01-19', 0, 0, 2022, 2),
  ('erik j neary', DATE '2021-07-07', 0, 0, 2021, 7),
  ('abdiel n negron', DATE '2023-03-15', 0, 0, 2023, 3),
  ('siul negron martinez', DATE '2022-02-16', 0, 0, 2022, 2),
  ('alexis neri', DATE '2021-07-28', 4, 8, 2021, 10),
  ('fernando m nieves', DATE '2022-08-31', 0, 0, 2022, 10),
  ('krystal m nieves', DATE '2022-09-07', 8, 16, 2026, 4),
  ('melvin algarin nieves', DATE '2022-03-16', 0, 0, 2022, 3),
  ('samuel nieves', DATE '2021-09-08', 20, 40, 2022, 1),
  ('elvira nunez espinal', DATE '2021-01-20', 0, 0, 2021, 4),
  ('emanuel olivieri', DATE '2024-04-17', 24, 48, 2025, 6),
  ('mario ormaza mercado', DATE '2022-02-09', 288, 120, 2026, 7),
  ('brandon orona rivera', DATE '2022-01-12', 0, 0, 2022, 1),
  ('anissa m ortega', DATE '2022-09-14', 0, 0, 2022, 9),
  ('carla m ortega', DATE '2023-05-10', 4, 8, 2024, 3),
  ('carlos ortiz', DATE '2023-10-18', 6, 8, 2026, 3),
  ('christian ortiz', DATE '2021-01-20', 0, 0, 2021, 7),
  ('desire j ortiz', DATE '2023-01-04', 4, 8, 2023, 10),
  ('ralphy n ortiz rios', DATE '2021-11-17', 0, 0, 2022, 1),
  ('otoniel ortiz rosado', DATE '2021-12-01', 12, 24, 2022, 3),
  ('sheila ortiz', DATE '2023-05-31', 180, 120, 2026, 5),
  ('erwin pabon', DATE '2023-07-19', 42, 56, 2026, 7),
  ('benny pacheco garcia', DATE '2021-08-04', 8, 16, 2021, 10),
  ('christopher padilla', DATE '2023-02-01', 0, 0, 2026, 1),
  ('luis padilla roger', DATE '2022-05-04', 0, 0, 2022, 6),
  ('monica padro gonzalez', DATE '2022-02-02', 0, 0, 2022, 2),
  ('francisco pantojas', DATE '2022-10-26', 0, 0, 2022, 11),
  ('nathan patterson', DATE '2021-11-17', 4, 8, 2022, 1),
  ('luis omar pena lopez', DATE '2022-02-09', 0, 0, 2022, 7),
  ('jeyniliz pereira', DATE '2021-11-15', 0, 0, 2021, 11),
  ('katarina liz perez', DATE '2021-08-04', 0, 0, 2021, 9),
  ('luis e perez mendez', DATE '2021-02-17', 0, 0, 2021, 4),
  ('leorneri marie perez rivera', DATE '2022-04-20', 0, 0, 2022, 5),
  ('jezaiah l perez silvestre', DATE '2026-03-11', 0, 0, 2026, 7),
  ('tamara perez', DATE '2025-07-30', 0, 0, 2026, 7),
  ('alfonso pineiro', DATE '2021-06-30', 8, 16, 2021, 11),
  ('erica piovanetti', DATE '2022-11-23', 0, 0, 2022, 12),
  ('gabriel e pita', DATE '2023-06-14', 4, 8, 2025, 1),
  ('regino pizarro', DATE '2026-06-03', 0, 0, 2026, 7),
  ('justo j poventud ortiz', DATE '2022-07-20', 0, 0, 2022, 9),
  ('gabriel puig', DATE '2025-01-15', 0, 0, 2025, 10),
  ('gheraldine quijada', DATE '2021-01-20', 0, 0, 2021, 2),
  ('cesar quinones', DATE '2021-04-07', 4, 8, 2021, 8),
  ('charlotte quinones', DATE '2023-05-31', 0, 0, 2023, 6),
  ('hector g quinones cruz', DATE '2021-08-18', 28, 56, 2022, 12),
  ('kivan quinones', DATE '2021-01-20', 0, 0, 2021, 3),
  ('jesmarie cristal quinones martinez', DATE '2021-11-03', 8, 16, 2022, 2),
  ('carla m ramirez gonzalez', DATE '2021-09-22', 12, 24, 2022, 2),
  ('christian ramos', DATE '2023-04-12', 0, 0, 2023, 5),
  ('crystal ramos', DATE '2021-03-31', 16, 32, 2021, 7),
  ('alana ramos del valle', DATE '2021-08-04', 4, 8, 2021, 10),
  ('jali ransom-rodriguez', DATE '2026-07-15', 0, 0, 2026, 7),
  ('fulbia altagracia recio gonzales', DATE '2021-11-03', 0, 0, 2021, 11),
  ('steven reyes morales', DATE '2021-02-17', 16, 32, 2021, 9),
  ('nancy reynoso', DATE '2021-01-20', 0, 0, 2021, 2),
  ('alanies rivera alomar', DATE '2026-03-11', 4, 8, 2026, 7),
  ('aslyn rivera', DATE '2022-11-16', 0, 0, 2023, 2),
  ('carlos j rivera', DATE '2023-10-25', 0, 0, 2025, 9),
  ('xavier rivera cruz', DATE '2021-08-18', 4, 8, 2021, 10),
  ('universal souljah rivera fernandez', DATE '2022-03-16', 36, 72, 2023, 2),
  ('gabriela rivera', DATE '2023-07-12', 0, 0, 2023, 8),
  ('sara beatriz rivera grundler', DATE '2022-07-20', 4, 8, 2023, 11),
  ('anieliz demar rivera moret', DATE '2021-08-25', 8, 16, 2021, 12),
  ('natalie rivera', DATE '2025-04-02', 0, 0, 2025, 9),
  ('jan luis rivera ortiz', DATE '2021-08-20', 0, 0, 2022, 1),
  ('jared rivera rodriguez', DATE '2021-03-10', 72, 112, 2026, 7),
  ('yediel rivera', DATE '2025-05-14', 0, 0, 2025, 9),
  ('jonathan leniel robles bermudez', DATE '2022-03-16', 28, 56, 2022, 12),
  ('thaliz robles torres', DATE '2022-06-01', 4, 8, 2022, 6),
  ('erick alberto rodriguesz', DATE '2021-09-22', 0, 0, 2021, 9),
  ('paulo alejandro rodriguez aponte', DATE '2021-02-10', 0, 0, 2021, 9),
  ('ian rodriguez', DATE '2021-01-20', 0, 0, 2021, 8),
  ('ivan rodriguez', DATE '2021-01-20', 146, 120, 2023, 8),
  ('alondra s rodriguez lebron', DATE '2022-08-17', 6, 8, 2024, 9),
  ('maria c rodriguez lleonart', DATE '2021-08-18', 0, 0, 2021, 9),
  ('nayomie rodriguez', DATE '2023-10-18', 0, 0, 2025, 8),
  ('yadiel y rodriguez', DATE '2022-09-07', 4, 8, 2022, 11),
  ('yagiselys rodriguez', DATE '2021-07-07', 4, 8, 2021, 8),
  ('yohamid rodriguez', DATE '2022-12-14', 24, 40, 2026, 7),
  ('isabella roig', DATE '2023-08-02', 0, 0, 2023, 9),
  ('camila a roman machado', DATE '2021-08-12', 0, 0, 2022, 4),
  ('alondra rosado', DATE '2022-10-19', 4, 8, 2022, 11),
  ('alexander rosado diaz', DATE '2021-09-01', 24, 48, 2022, 6),
  ('jose l rosado', DATE '2021-05-12', 4, 8, 2021, 7),
  ('kevin rosario sostre', DATE '2023-03-01', 0, 0, 2024, 8),
  ('natalia n ruiz', DATE '2023-03-29', 8, 16, 2023, 6),
  ('leslie a ruiz santiago', DATE '2024-01-31', 16, 24, 2026, 6),
  ('jatniel e salgado', DATE '2025-03-05', 0, 0, 2025, 6),
  ('gustavo g samot', DATE '2024-11-13', 0, 0, 2026, 7),
  ('carlos sanchez', DATE '2022-03-30', 0, 0, 2022, 4),
  ('shaddai sanchez', DATE '2025-05-07', 12, 24, 2026, 7),
  ('stefanie santana varela', DATE '2021-04-07', 0, 0, 2021, 4),
  ('amaurys santiago', DATE '2022-11-04', 8, 16, 2023, 2),
  ('nataly santiago velez', DATE '2021-02-01', 32, 64, 2021, 11),
  ('alanis santos', DATE '2021-01-20', 16, 32, 2021, 12),
  ('kevin santos', DATE '2021-08-18', 20, 40, 2022, 12),
  ('jeremy saylor', DATE '2021-12-15', 0, 0, 2022, 1),
  ('diego andres sepulveda howard', DATE '2022-02-03', 0, 0, 2022, 2),
  ('rocio del mar sevilla ortiz', DATE '2023-11-22', 16, 24, 2026, 6),
  ('john silva', DATE '2021-01-20', 0, 0, 2024, 3),
  ('ashley skerrett', DATE '2022-11-04', 0, 0, 2022, 12),
  ('ashley skerrett ocasio', DATE '2022-04-06', 0, 0, 2022, 4),
  ('zuleyka solis', DATE '2022-01-26', 0, 0, 2022, 8),
  ('maria v soto', DATE '2022-11-23', 0, 0, 2022, 11),
  ('ramon soto ramirez', DATE '2021-02-01', 4, 8, 2021, 3),
  ('nichole z springstead lebron', DATE '2021-09-16', 40, 80, 2022, 12),
  ('daniel anthony suarez diaz', DATE '2021-11-17', 16, 32, 2022, 12),
  ('jose terrero', DATE '2021-09-22', 4, 8, 2021, 11),
  ('karina s tomassini', DATE '2023-07-19', 0, 0, 2023, 7),
  ('veronica toro', DATE '2021-02-17', 0, 0, 2021, 7),
  ('adrian torres', DATE '2024-04-03', 4, 8, 2025, 1),
  ('fernando torres bruno', DATE '2021-02-01', 12, 24, 2021, 7),
  ('victor j torres delgado', DATE '2022-03-16', 0, 0, 2022, 3),
  ('stephanie torres romero', DATE '2021-12-01', 0, 0, 2021, 12),
  ('hector torres torres', DATE '2024-01-31', 0, 0, 2024, 8),
  ('jorge vaello', DATE '2023-01-11', 0, 0, 2024, 2),
  ('pablo valentin', DATE '2021-02-01', 12, 24, 2021, 7),
  ('patricia valerio', DATE '2021-05-19', 4, 8, 2021, 7),
  ('daniel varela', DATE '2021-02-01', 32, 64, 2022, 2),
  ('miguel a vazquez figueroa', DATE '2021-11-17', 0, 0, 2022, 1),
  ('frederick vazquez', DATE '2021-02-01', 0, 0, 2021, 2),
  ('korey velasquez', DATE '2021-12-01', 4, 8, 2022, 1),
  ('alejandro velez', DATE '2026-01-28', 4, 8, 2026, 5),
  ('dalvi velez ballester', DATE '2024-01-03', 4, 8, 2024, 6),
  ('luis a velez nieves', DATE '2021-02-24', 4, 8, 2021, 4),
  ('victor viallard', DATE '2022-11-04', 58, 112, 2024, 2),
  ('jason villanueva', DATE '2022-10-19', 0, 0, 2022, 12),
  ('yariannys n vives', DATE '2023-03-29', 0, 0, 2023, 4),
  ('ayre williams', DATE '2023-01-04', 0, 0, 2023, 1),
  ('gabriel wilson', DATE '2024-01-03', 0, 0, 2024, 3);
DO $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM tresbe_leave_opening_20260717;
  IF v_total <> 284 THEN
    RAISE EXCEPTION 'Tresbe leave opening balance sheet validation failed: expected 284 rows, found %', v_total;
  END IF;
END;
$$;

WITH candidates AS (
  SELECT DISTINCT
    sheet.normalized_name AS sheet_key,
    employee.id AS employee_id
  FROM tresbe_leave_opening_20260717 sheet
  JOIN public.tresbe_employees employee
    ON employee.is_active
   AND public.is_tresbe_company(employee.company_id)
   AND (
     employee.normalized_name = sheet.normalized_name
     OR EXISTS (
       SELECT 1
       FROM public.tresbe_employee_aliases alias
       WHERE alias.employee_id = employee.id
         AND alias.normalized_alias = sheet.normalized_name
     )
   )
), counted AS (
  SELECT
    sheet_key,
    employee_id,
    count(*) OVER (PARTITION BY sheet_key) AS sheet_match_count,
    count(*) OVER (PARTITION BY employee_id) AS employee_match_count
  FROM candidates
), matches AS (
  SELECT match.employee_id, sheet.*
  FROM counted match
  JOIN tresbe_leave_opening_20260717 sheet ON sheet.normalized_name = match.sheet_key
  WHERE match.sheet_match_count = 1
    AND match.employee_match_count = 1
)
UPDATE public.tresbe_employees employee
SET hiring_date = matches.hiring_date
FROM matches
WHERE employee.id = matches.employee_id;

WITH candidates AS (
  SELECT DISTINCT
    sheet.normalized_name AS sheet_key,
    employee.id AS employee_id,
    employee.company_id AS company_id
  FROM tresbe_leave_opening_20260717 sheet
  JOIN public.tresbe_employees employee
    ON employee.is_active
   AND public.is_tresbe_company(employee.company_id)
   AND (
     employee.normalized_name = sheet.normalized_name
     OR EXISTS (
       SELECT 1
       FROM public.tresbe_employee_aliases alias
       WHERE alias.employee_id = employee.id
         AND alias.normalized_alias = sheet.normalized_name
     )
   )
), counted AS (
  SELECT
    sheet_key,
    employee_id,
    company_id,
    count(*) OVER (PARTITION BY sheet_key) AS sheet_match_count,
    count(*) OVER (PARTITION BY employee_id) AS employee_match_count
  FROM candidates
), matches AS (
  SELECT match.employee_id, match.company_id, sheet.*
  FROM counted match
  JOIN tresbe_leave_opening_20260717 sheet ON sheet.normalized_name = match.sheet_key
  WHERE match.sheet_match_count = 1
    AND match.employee_match_count = 1
)
INSERT INTO public.employee_leave_opening_balances (
  company_id, source_system, tresbe_employee_id,
  opening_vacation_hours, opening_sick_hours, as_of_year, as_of_month, note
)
SELECT
  company_id, 'tresbe', employee_id,
  opening_vacation_hours, opening_sick_hours, as_of_year, as_of_month,
  'Imported from Calculo_Vacaciones_Enfermedad_Tresbe.xlsx (Resumen empleados)'
FROM matches
ON CONFLICT (tresbe_employee_id) DO UPDATE SET
  opening_vacation_hours = EXCLUDED.opening_vacation_hours,
  opening_sick_hours = EXCLUDED.opening_sick_hours,
  as_of_year = EXCLUDED.as_of_year,
  as_of_month = EXCLUDED.as_of_month,
  note = EXCLUDED.note;

-- Seed employee_leave_balances directly with the same numbers so the admin
-- report reflects correct current balances immediately. Safe to do here
-- (rather than only via replayAndPersistBalance) because these employees
-- have no ledger entries yet — the opening balance IS the current balance
-- until the first payroll processed by this module changes it.
WITH candidates AS (
  SELECT DISTINCT
    sheet.normalized_name AS sheet_key,
    employee.id AS employee_id,
    employee.company_id AS company_id
  FROM tresbe_leave_opening_20260717 sheet
  JOIN public.tresbe_employees employee
    ON employee.is_active
   AND public.is_tresbe_company(employee.company_id)
   AND (
     employee.normalized_name = sheet.normalized_name
     OR EXISTS (
       SELECT 1
       FROM public.tresbe_employee_aliases alias
       WHERE alias.employee_id = employee.id
         AND alias.normalized_alias = sheet.normalized_name
     )
   )
), counted AS (
  SELECT
    sheet_key,
    employee_id,
    company_id,
    count(*) OVER (PARTITION BY sheet_key) AS sheet_match_count,
    count(*) OVER (PARTITION BY employee_id) AS employee_match_count
  FROM candidates
), matches AS (
  SELECT match.employee_id, match.company_id, sheet.*
  FROM counted match
  JOIN tresbe_leave_opening_20260717 sheet ON sheet.normalized_name = match.sheet_key
  WHERE match.sheet_match_count = 1
    AND match.employee_match_count = 1
)
INSERT INTO public.employee_leave_balances (
  company_id, source_system, tresbe_employee_id,
  vacation_balance_hours, sick_balance_hours,
  vacation_accrued_lifetime_hours, sick_accrued_lifetime_hours,
  vacation_used_lifetime_hours, sick_used_lifetime_hours,
  last_replayed_year, last_replayed_month
)
SELECT
  company_id, 'tresbe', employee_id,
  opening_vacation_hours, opening_sick_hours,
  opening_vacation_hours, opening_sick_hours,
  0, 0,
  as_of_year, as_of_month
FROM matches
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_leave_ledger_entries ledger
  WHERE ledger.tresbe_employee_id = matches.employee_id
)
ON CONFLICT (tresbe_employee_id) DO UPDATE SET
  vacation_balance_hours = EXCLUDED.vacation_balance_hours,
  sick_balance_hours = EXCLUDED.sick_balance_hours,
  vacation_accrued_lifetime_hours = EXCLUDED.vacation_accrued_lifetime_hours,
  sick_accrued_lifetime_hours = EXCLUDED.sick_accrued_lifetime_hours,
  vacation_used_lifetime_hours = EXCLUDED.vacation_used_lifetime_hours,
  sick_used_lifetime_hours = EXCLUDED.sick_used_lifetime_hours,
  last_replayed_year = EXCLUDED.last_replayed_year,
  last_replayed_month = EXCLUDED.last_replayed_month;
