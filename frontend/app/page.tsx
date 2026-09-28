import Image from "next/image";
import Link from "next/link";
import { Sprig } from "@/components/brand";
import { getDictionary } from "@/lib/locale";
import styles from "./home.module.css";

const Arrow = () => <span className={`arrow ${styles.linkArrow}`} aria-hidden="true">→</span>;

function DeliveryIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 7h16v17H3zM19 12h5l5 6v6H19zM8 27a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM24 27a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></svg>;
}

function GiftIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 13h24v15H4zM2 8h28v5H2zM16 8v20M16 8H9.5C5 8 5 2 9 3c3 .7 5.3 3.3 7 5Zm0 0h6.5c4.5 0 4.5-6 .5-5-3 .7-5.3 3.3-7 5Z" /></svg>;
}

function LeafIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M27 4C15 5 7 10 7 20c0 5 3 8 7 8 10 0 13-12 13-24ZM4 28c5-7 10-12 18-17M5 9c5 1 8 4 9 9" /></svg>;
}

function HeartIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27S4 20 4 11c0-7 9-9 12-3 3-6 12-4 12 3 0 9-12 16-12 16Z" /></svg>;
}

export default async function HomePage() {
  const { t } = await getDictionary();
  const universes = [
    { label: t.navDishware, href: "/categorie/vaisselle", crop: styles.cropDishware },
    { label: t.navGlassware, href: "/categorie/verrerie", crop: styles.cropGlassware },
    { label: t.navLinens, href: "/categorie/linge-de-table", crop: styles.cropLinens },
    { label: t.navAccessories, href: "/categorie/accessoires", crop: styles.cropAccessories },
  ];
  const services = [
    { title: t.serviceDeliveryTitle, text: t.serviceDeliveryText, icon: <DeliveryIcon /> },
    { title: t.servicePackagingTitle, text: t.servicePackagingText, icon: <GiftIcon /> },
    { title: t.serviceSelectionTitle, text: t.serviceSelectionText, icon: <LeafIcon /> },
    { title: t.serviceCareTitle, text: t.serviceCareText, icon: <HeartIcon /> },
  ];

  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroBotanical} aria-hidden="true"><Sprig height={330} /></div>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <span className="eyebrow">{t.heroEyebrow}</span>
            <h1 id="hero-title">{t.heroTitle}</h1>
            <p>{t.heroText}</p>
            <Link className="button" href="/produits">{t.heroCta}<Arrow /></Link>
          </div>
          <div className={styles.heroMedia}>
            <Image src="/images/brand/hero.png" alt={t.heroImageAlt} fill priority sizes="(max-width: 820px) 100vw, 60vw" />
          </div>
        </div>
      </section>

      <section className={`section container ${styles.universes}`} aria-labelledby="universes-title">
        <div className={styles.sectionIntro}>
          <span className="eyebrow">{t.categoriesTitle}</span>
          <h2 id="universes-title" className="sr-only">{t.categoriesTitle}</h2>
        </div>
        <div className={styles.universeGrid}>
          {universes.map((universe) => (
            <Link key={universe.href} href={universe.href} className={styles.universeCard}>
              <div className={styles.universeImage}>
                <Image src="/images/brand/hero.png" alt="" fill sizes="(max-width: 620px) 100vw, (max-width: 980px) 50vw, 25vw" className={universe.crop} />
              </div>
              <div className={styles.universeBody}>
                <h3>{universe.label}</h3>
                <span>{t.discover}<Arrow /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={`section container ${styles.collection}`} aria-labelledby="collection-title">
        <div className={styles.collectionCopy}>
          <span className="eyebrow">{t.collectionEyebrow}</span>
          <h2 id="collection-title">{t.collectionTitle}</h2>
          <p>{t.collectionText}</p>
          <span className={styles.pill}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v3M19 3v3M4 9h16M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z" /></svg>
            {t.comingSoon}
          </span>
          <a className="button" href="#newsletter">{t.launchCta}<Arrow /></a>
        </div>
        <div className={`${styles.editorialImage} ${styles.collectionImage}`}>
          <Image src="/images/brand/hero.png" alt={t.collectionImageAlt} fill sizes="(max-width: 780px) 100vw, 38vw" />
        </div>
        <aside className={styles.quotePanel}>
          <p>{t.collectionQuote}</p>
          <div aria-hidden="true"><Sprig height={180} /></div>
        </aside>
      </section>

      <section className={styles.story} aria-labelledby="story-title">
        <div className={styles.storyImage}>
          <Image src="/images/brand/hero.png" alt={t.storyImageAlt} fill sizes="(max-width: 760px) 100vw, 32vw" />
        </div>
        <div className={styles.storyCopy}>
          <span className="eyebrow">{t.storyEyebrow}</span>
          <h2 id="story-title">{t.storyTitle}</h2>
          <p>{t.storyText}</p>
          <p>{t.storyTextSecond}</p>
          <Link className={styles.textLink} href="/#story-title">{t.storyCta}<Arrow /></Link>
        </div>
        <div className={`${styles.storyImage} ${styles.storyImageSecondary}`}>
          <Image src="/images/brand/hero.png" alt="" fill sizes="(max-width: 760px) 100vw, 32vw" />
        </div>
      </section>

      <section id="inspirations" className={styles.inspirations} aria-labelledby="inspirations-title">
        <div className={styles.inspirationImage}>
          <Image src="/images/brand/hero.png" alt={t.inspirationImageAlt} fill sizes="(max-width: 800px) 100vw, 62vw" />
        </div>
        <div className={styles.inspirationCopy}>
          <span className="eyebrow">{t.inspirationEyebrow}</span>
          <h2 id="inspirations-title">{t.inspirationTitle}</h2>
          <p>{t.inspirationText}</p>
          <Link className="button" href="/#inspirations">{t.inspirationCta}<Arrow /></Link>
          <div className={styles.inspirationSprig} aria-hidden="true"><Sprig height={230} /></div>
        </div>
      </section>

      <section className={styles.services} aria-label={t.servicesLabel}>
        <div className={`container ${styles.serviceGrid}`}>
          {services.map((service) => (
            <div className={styles.service} key={service.title}>
              {service.icon}
              <div><h3>{service.title}</h3><p>{service.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="newsletter" className={`container ${styles.newsletter}`} aria-labelledby="newsletter-title">
        <div className={styles.newsletterImage}>
          <Image src="/images/brand/hero.png" alt="" fill sizes="(max-width: 760px) 100vw, 25vw" />
        </div>
        <div className={styles.newsletterCopy}>
          <span className="eyebrow">{t.newsletterEyebrow}</span>
          <h2 id="newsletter-title">{t.newsletterTitle}</h2>
          <p>{t.newsletterText}</p>
        </div>
        <div className={styles.newsletterForm}>
          <label className="sr-only" htmlFor="newsletter-email">{t.email}</label>
          <input id="newsletter-email" type="email" placeholder={t.newsletterPlaceholder} autoComplete="email" />
          <button type="button" title={t.comingSoon}>{t.newsletterCta}<Arrow /></button>
        </div>
      </section>
    </>
  );
}
