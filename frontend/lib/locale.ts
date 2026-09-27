import "server-only";
import { cookies } from "next/headers";
import { dictionaries, isLocale, Locale, LOCALE_COOKIE } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "fr";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export const SITE_URL = (process.env.PUBLIC_SITE_URL ?? "https://bluebonnetmaroc.com").replace(/\/$/, "");
