"use client";

import Image from "next/image";
import { useState } from "react";
import { Locale, localized } from "@/lib/i18n";
import type { Image as ProductImage } from "@/lib/types";
import styles from "./commerce.module.css";

export function ProductGallery({ images, altFr, locale }: { images: ProductImage[]; altFr: string; locale: Locale }) {
  const [index, setIndex] = useState(0);
  const alt = (image: ProductImage) => localized(locale, image.altFr || altFr, image.altAr);
  const current = images[index];
  if (!current) return <div className={styles.mainImage} />;
  return (
    <div className={styles.gallery}>
      <div className={styles.mainImage}>
        <Image src={current.url} alt={alt(current)} fill priority sizes="(max-width: 860px) 100vw, 55vw" unoptimized={current.url.endsWith(".svg")} />
      </div>
      {images.length > 1 && (
        <div className={styles.thumbs}>
          {images.map((image, position) => (
            <button key={image.url + position} type="button" aria-pressed={position === index} aria-label={alt(image)} onClick={() => setIndex(position)}>
              <Image src={image.url} alt="" fill sizes="76px" unoptimized={image.url.endsWith(".svg")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
