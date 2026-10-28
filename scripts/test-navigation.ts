import assert from "node:assert/strict";

import {
  CLIENT_NAV_MAX_ITEMS,
  adminNavItems,
  getClientNavItems,
  isNavItemActive,
} from "../src/config/navigation";

const titles = (items: { title: string }[]) => items.map((i) => i.title);

// Admin: máximo 6, todo en español, sin duplicados
assert.ok(adminNavItems.length <= 6);
assert.deepEqual(titles(adminNavItems), [
  "Inicio",
  "Clientes",
  "Facturación",
  "Documentos",
  "Reportes",
  "Calendario",
]);
assert.equal(
  new Set(adminNavItems.map((i) => i.href)).size,
  adminNavItems.length,
);

// Cliente: solo módulos activos y nunca más de 5, incluso con todo habilitado
assert.deepEqual(titles(getClientNavItems({})), [
  "Inicio",
  "Documentos",
  "Reportes",
]);
assert.deepEqual(
  titles(getClientNavItems({ companySlug: "tresbe", invoicesEnabled: true })),
  ["Inicio", "Documentos", "Reportes", "Nóminas", "Facturas"],
);
for (const companySlug of ["tresbe", "sibarita", "magol", null]) {
  for (const invoicesEnabled of [true, false]) {
    assert.ok(
      getClientNavItems({ companySlug, invoicesEnabled }).length <=
        CLIENT_NAV_MAX_ITEMS,
    );
  }
}

// Ítem activo por ruta
const clientes = adminNavItems.find((i) => i.title === "Clientes")!;
assert.ok(isNavItemActive(clientes, "/dashboard/admin/companies/abc/invoices"));
assert.ok(isNavItemActive(clientes, "/dashboard/payroll"));
const inicio = adminNavItems.find((i) => i.title === "Inicio")!;
assert.ok(isNavItemActive(inicio, "/dashboard"));
assert.ok(!isNavItemActive(inicio, "/dashboard/inbox"));

console.log("Navigation menus: PASS");
