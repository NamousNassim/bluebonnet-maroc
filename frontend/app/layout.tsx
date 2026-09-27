import type { Metadata, Viewport } from "next";
import { Inter, Noto_Naskh_Arabic, Playfair_Display } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getDictionary, SITE_URL } from "@/lib/locale";
import { getCategories } from "@/lib/server-api";
import type { Category } from "@/lib/types";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const naskh = Noto_Naskh_Arabic({ subsets: ["arabic"], variable: "--font-naskh", display: "swap", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Bluebonnet — Arts de la table & maison au Maroc", template: "%s | Bluebonnet" },
  description: "Vaisselle, verrerie, linge de table et décoration inspirés par la nature. La beauté au quotidien.",
  openGraph: { siteName: "Bluebonnet", locale: "fr_MA", type: "website" },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#1c1cff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getDictionary();
  // The footer is decorative navigation; an API outage must not take the whole page down.
  const categories: Category[] = await getCategories().catch(() => []);
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${playfair.variable} ${inter.variable} ${naskh.variable}`}>
      <body>
        <a className="sr-only" href="#main">{t.home}</a>
        <Header locale={locale} />
        <main id="main">{children}</main>
        <Footer t={t} locale={locale} categories={categories} />
      </body>
    </html>
  );
}
