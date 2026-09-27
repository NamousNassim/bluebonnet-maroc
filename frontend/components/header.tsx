"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CART_EVENT, fetchCart } from "@/lib/client-api";
import { dictionaries, Locale, LOCALE_COOKIE } from "@/lib/i18n";
import { Monogram } from "./brand";
import styles from "./header.module.css";

/** Only features that exist are shown: no wishlist or account until they are built. */
export function Header({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [count, setCount] = useState<number>();

  useEffect(() => {
    let active = true;
    fetchCart().then((cart) => { if (active) setCount(cart.itemCount); }).catch(() => undefined);
    const update = (event: Event) => setCount((event as CustomEvent<number>).detail);
    window.addEventListener(CART_EVENT, update);
    return () => { active = false; window.removeEventListener(CART_EVENT, update); };
  }, []);
  useEffect(() => { setOpen(false); setSearching(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const links = [
    { href: "/produits?sort=new", match: "/produits", label: t.navNew },
    { href: "/categorie/vaisselle", match: "/categorie/vaisselle", label: t.navTableware },
    { href: "/categorie/decoration", match: "/categorie/decoration", label: t.navDecor },
    { href: "/#inspirations", match: "/#inspirations", label: t.navInspiration },
  ];
  const setLocale = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  const localeSwitch = (className?: string) => (
    <div className={`${styles.locale} ${className ?? ""}`} role="group" aria-label={t.language}>
      <button type="button" aria-pressed={locale === "fr"} onClick={() => setLocale("fr")}>FR</button>
      <button type="button" aria-pressed={locale === "ar"} onClick={() => setLocale("ar")} lang="ar">AR</button>
    </div>
  );

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <button type="button" className={`${styles.iconButton} ${styles.menuButton}`} aria-label={open ? t.closeMenu : t.menu}
          aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((value) => !value)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <Link href="/" className={styles.brand} aria-label="Bluebonnet, accueil">
          <Monogram size={46} />
          <span className={styles.brandText}>
            <span className={styles.brandName}>Bluebonnet</span>
            <span className={styles.brandTag}>{t.brandTagline}</span>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Navigation principale">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.match ? "page" : undefined}>{link.label}</Link>
          ))}
        </nav>
        <div className={styles.actions}>
          {localeSwitch(styles.localeDesktop)}
          <button type="button" className={styles.iconButton} aria-label={t.search} aria-expanded={searching} onClick={() => setSearching((value) => !value)}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </button>
          <Link href="/panier" className={styles.iconButton} aria-label={count ? `${t.cart} (${count})` : t.cart}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8a3 3 0 016 0" /></svg>
            {count ? <span className={styles.count} aria-hidden="true">{count}</span> : null}
          </Link>
        </div>
      </div>
      {searching && (
        <div className={styles.search}>
          <form className="container" action="/produits" role="search">
            <label className="sr-only" htmlFor="site-search">{t.search}</label>
            <input id="site-search" name="q" type="search" placeholder={t.searchPlaceholder} autoFocus />
            <button className="button" type="submit">{t.search}</button>
          </form>
        </div>
      )}
      {open && (
        <div id="mobile-menu" className={styles.drawer}>
          <nav aria-label="Navigation mobile">
            {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            <Link href="/panier">{t.cart}</Link>
          </nav>
          {localeSwitch()}
        </div>
      )}
    </header>
  );
}
