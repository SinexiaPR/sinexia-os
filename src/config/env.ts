import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PAYROLL_EMAIL_PROVIDER_URL: z.string().url().optional(),
  PAYROLL_EMAIL_API_KEY: z.string().min(1).optional(),
  PAYROLL_EMAIL_FROM: z.string().email().optional(),
});

function getEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PAYROLL_EMAIL_PROVIDER_URL: process.env.PAYROLL_EMAIL_PROVIDER_URL,
    PAYROLL_EMAIL_API_KEY: process.env.PAYROLL_EMAIL_API_KEY,
    PAYROLL_EMAIL_FROM: process.env.PAYROLL_EMAIL_FROM,
  });

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(formatted)}`,
    );
  }

  return parsed.data;
}

export const env = getEnv();

export type Env = z.infer<typeof envSchema>;
