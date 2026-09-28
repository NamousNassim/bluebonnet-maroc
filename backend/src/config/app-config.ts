import { z } from "zod";

const flag = z.enum(["true", "false"]).default("false").transform((value) => value === "true");
const cents = (fallback: number) => z.coerce.number().int().min(0).default(fallback);

/**
 * Every setting comes from the environment and is validated at startup. StartEntreprise credentials
 * are backend-only: nothing here is ever sent to the browser.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  CART_COOKIE_SECURE: flag,
  SHIPPING_FLAT_CENTS: cents(3000),
  FREE_SHIPPING_THRESHOLD_CENTS: cents(80000),
  CHECKOUT_ENABLED: flag,
  RESERVATION_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  LOW_STOCK_DISPLAY_THRESHOLD: z.coerce.number().int().min(1).default(5),
  AVAILABILITY_CACHE_SECONDS: z.coerce.number().int().min(0).default(30),
  STARTENTREPRISE_INTEGRATION_ENABLED: flag,
  STARTENTREPRISE_API_URL: z.string().url().optional(),
  STARTENTREPRISE_TOKEN_URL: z.string().url().optional(),
  STARTENTREPRISE_CLIENT_ID: z.string().optional(),
  STARTENTREPRISE_CLIENT_SECRET: z.string().optional(),
  STARTENTREPRISE_TIMEOUT_MS: z.coerce.number().int().min(500).default(5000),
  BLUEBONNET_MANAGEMENT_ENABLED: flag,
  /** Dedicated StartEntreprise → Bluebonnet identity; never the storefront's stock client. */
  BLUEBONNET_MANAGEMENT_CLIENT_ID: z.string().min(1).default("startentreprise-bluebonnet-management"),
  BLUEBONNET_MANAGEMENT_CLIENT_SECRET: z.string().optional(),
  BLUEBONNET_MANAGEMENT_ORGANIZATION_ID: z.string().uuid().optional(),
  BLUEBONNET_MANAGEMENT_STORE_ID: z.string().min(1).max(100).default("bluebonnet-main"),
}).superRefine((value, context) => {
  // Each direction is validated on its own: management is typically enabled while stock is not yet.
  if (value.STARTENTREPRISE_INTEGRATION_ENABLED) {
    for (const key of ["STARTENTREPRISE_API_URL", "STARTENTREPRISE_TOKEN_URL", "STARTENTREPRISE_CLIENT_ID", "STARTENTREPRISE_CLIENT_SECRET"] as const) {
      if (!value[key]) context.addIssue({ code: "custom", path: [key], message: "required when STARTENTREPRISE_INTEGRATION_ENABLED=true" });
    }
  }
  if (value.BLUEBONNET_MANAGEMENT_ENABLED) {
    for (const key of ["BLUEBONNET_MANAGEMENT_CLIENT_ID", "BLUEBONNET_MANAGEMENT_CLIENT_SECRET", "BLUEBONNET_MANAGEMENT_ORGANIZATION_ID"] as const) {
      if (!value[key]) context.addIssue({ code: "custom", path: [key], message: "required when BLUEBONNET_MANAGEMENT_ENABLED=true" });
    }
    if ((value.BLUEBONNET_MANAGEMENT_CLIENT_SECRET ?? "").length < 32) {
      context.addIssue({ code: "custom", path: ["BLUEBONNET_MANAGEMENT_CLIENT_SECRET"], message: "must be at least 32 characters (openssl rand -hex 32)" });
    }
  }
});

export type AppConfig = z.infer<typeof schema>;
export const APP_CONFIG = Symbol("APP_CONFIG");

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid configuration: ${problems}`);
  }
  return result.data;
}
