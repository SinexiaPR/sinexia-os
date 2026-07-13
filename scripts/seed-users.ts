/**
 * Seed initial users for Sprint 1.
 *
 * Prerequisites:
 *   - Run migrations first
 *   - Set SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:
 *   npm run seed:users
 *
 * Requires a non-default SEED_USER_PASSWORD value.
 */

import { resolve } from "node:path";

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const PASSWORD = process.env.SEED_USER_PASSWORD;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !PASSWORD) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SEED_USER_PASSWORD",
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SeedUser = {
  email: string;
  fullName: string;
  role: "admin" | "client";
  companySlug?: string;
};

const USERS: SeedUser[] = [
  {
    email: "admin@sinexia.com",
    fullName: "Sinexia Admin",
    role: "admin",
  },
  {
    email: "client@sibarita.com",
    fullName: "Sibarita Client",
    role: "client",
    companySlug: "sibarita",
  },
  {
    email: "client@tresbe.com",
    fullName: "Tresbe Client",
    role: "client",
    companySlug: "tresbe",
  },
  {
    email: "client@cut.com",
    fullName: "Cut Client",
    role: "client",
    companySlug: "cut",
  },
  {
    email: "client@cutmeat.com",
    fullName: "Cut Meat Client",
    role: "client",
    companySlug: "cut-meat-distributors",
  },
  {
    email: "client@magol.com",
    fullName: "Magol Client",
    role: "client",
    companySlug: "magol",
  },
];

async function main() {
  const { data: companies, error: companiesError } = await admin
    .from("companies")
    .select("id, slug");

  if (companiesError) {
    throw companiesError;
  }

  const companyBySlug = new Map((companies ?? []).map((c) => [c.slug, c.id]));

  for (const user of USERS) {
    const companyId = user.companySlug
      ? companyBySlug.get(user.companySlug)
      : undefined;

    if (user.role === "client" && !companyId) {
      console.error(`Company not found for slug: ${user.companySlug}`);
      continue;
    }

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();

    if (existing) {
      console.log(`Skipping existing user: ${user.email}`);
      continue;
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
        role: user.role,
        company_id: companyId ?? null,
      },
    });

    if (error) {
      console.error(`Failed to create ${user.email}:`, error.message);
      continue;
    }

    if (data.user) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          full_name: user.fullName,
          role: user.role,
          company_id: user.role === "admin" ? null : companyId,
        })
        .eq("id", data.user.id);
      if (profileError) {
        console.error(
          `Failed to provision profile for ${user.email}:`,
          profileError.message,
        );
        continue;
      }
    }

    console.log(`Created ${user.role}: ${user.email} (${data.user?.id})`);
  }

  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
