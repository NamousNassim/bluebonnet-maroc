/**
 * FR/AR foundation: content carries both languages (nameFr/nameAr…), UI strings live in this
 * dictionary, and the locale (a cookie) drives <html lang dir>. French is the default and canonical.
 */
export type Locale = "fr" | "ar";
export const LOCALE_COOKIE = "bb_locale";
export const isLocale = (value: string | undefined): value is Locale => value === "fr" || value === "ar";

const fr = {
  brandTagline: "La beauté au quotidien",
  navNew: "Nouveautés", navTableware: "Arts de la table", navDecor: "Décoration", navInspiration: "Inspirations",
  search: "Rechercher", searchPlaceholder: "Rechercher un produit…", cart: "Panier", menu: "Menu", closeMenu: "Fermer le menu",
  heroEyebrow: "Arts de la table & maison", heroTitle: "Des tables plus belles, des moments plus vrais.",
  heroCta: "Découvrir la collection", categoriesTitle: "Nos univers", featuredTitle: "Sélection du moment", seeAll: "Tout voir",
  storyEyebrow: "Notre histoire", storyTitle: "L’art de recevoir au quotidien",
  storyText: "Bluebonnet imagine des pièces pour la table et la maison, inspirées par la nature et pensées pour embellir chaque jour. Des matières sincères, des motifs botaniques, une élégance douce.",
  editorialTitle: "Good tables, brighter days", editorialText: "Composez une table qui vous ressemble : porcelaine peinte, verrerie ciselée et lin brodé.",
  newsletterTitle: "Restez inspirés", newsletterText: "Les nouveautés et idées de table arrivent bientôt par e-mail.",
  products: "Produits", allProducts: "Tous les produits", sortLabel: "Trier par", sortNew: "Nouveautés", sortPriceAsc: "Prix croissant",
  sortPriceDesc: "Prix décroissant", filterAll: "Tous", resultCount: (count: number) => `${count} produit${count > 1 ? "s" : ""}`,
  noResults: "Aucun produit ne correspond à votre recherche.", previous: "Précédent", next: "Suivant", pageOf: (page: number, total: number) => `Page ${page} sur ${total}`,
  inStock: "En stock", lowStock: (count: number) => `Plus que ${count} disponible${count > 1 ? "s" : ""}`, outOfStock: "Indisponible",
  unknownStock: "Disponibilité confirmée à la commande", newBadge: "Nouveau", quantity: "Quantité", addToCart: "Ajouter au panier",
  added: "Ajouté au panier", viewCart: "Voir le panier", sku: "Référence", description: "Description", home: "Accueil",
  cartTitle: "Votre panier", cartEmpty: "Votre panier est vide.", continueShopping: "Continuer vos achats", remove: "Retirer",
  subtotal: "Sous-total", shipping: "Livraison", shippingFree: "Offerte", total: "Total", checkout: "Passer commande",
  freeShippingHint: (amount: string) => `Livraison offerte dès ${amount} d’achat.`, unavailableLine: "Cet article n’est plus disponible. Retirez-le pour continuer.",
  checkoutTitle: "Finaliser la commande", contact: "Coordonnées", delivery: "Livraison", firstName: "Prénom", lastName: "Nom", email: "E-mail",
  phone: "Téléphone", address: "Adresse de livraison", city: "Ville", postalCode: "Code postal (facultatif)", notes: "Instructions (facultatif)",
  placeOrder: "Valider la commande", processing: "Validation en cours…", orderSummary: "Récapitulatif",
  paymentNote: "Le paiement en ligne sera proposé à l’étape suivante. Aucun montant n’est débité à ce stade.",
  orderConfirmed: "Commande enregistrée", orderNumber: "Numéro de commande", orderPendingNote: "Vos articles sont réservés. Le paiement en ligne arrive très prochainement ; nous vous contacterons pour finaliser.",
  orderExpired: "Cette commande a expiré", orderExpiredNote: "La réservation de vos articles a expiré. Vous pouvez recommencer votre commande.",
  checkoutClosed: "La commande en ligne ouvre très bientôt. Votre panier reste enregistré.",
  genericError: "Service temporairement indisponible. Veuillez réessayer.", footerRights: "Tous droits réservés",
  footerAbout: "Art de la table et de la maison, inspiré par la nature.", language: "Langue",
};

type Dictionary = typeof fr;

const ar: Dictionary = {
  brandTagline: "جمال في تفاصيل كل يوم",
  navNew: "الجديد", navTableware: "فن المائدة", navDecor: "الديكور", navInspiration: "الإلهام",
  search: "بحث", searchPlaceholder: "ابحث عن منتج…", cart: "السلة", menu: "القائمة", closeMenu: "إغلاق القائمة",
  heroEyebrow: "فن المائدة والمنزل", heroTitle: "موائد أجمل، لحظات أكثر صدقاً.",
  heroCta: "اكتشف التشكيلة", categoriesTitle: "عوالمنا", featuredTitle: "مختارات اللحظة", seeAll: "عرض الكل",
  storyEyebrow: "قصتنا", storyTitle: "فن الضيافة في كل يوم",
  storyText: "تبتكر بلوبونيت قطعاً للمائدة والمنزل مستوحاة من الطبيعة، لتجميل كل يوم. مواد صادقة وزخارف نباتية وأناقة هادئة.",
  editorialTitle: "Good tables, brighter days", editorialText: "نسّقوا مائدة تشبهكم: خزف مرسوم وزجاج منقوش وكتان مطرز.",
  newsletterTitle: "ابقوا ملهمين", newsletterText: "الجديد وأفكار المائدة قريباً عبر البريد الإلكتروني.",
  products: "المنتجات", allProducts: "كل المنتجات", sortLabel: "ترتيب حسب", sortNew: "الأحدث", sortPriceAsc: "السعر تصاعدياً",
  sortPriceDesc: "السعر تنازلياً", filterAll: "الكل", resultCount: (count: number) => `${count} منتج`,
  noResults: "لا توجد منتجات مطابقة لبحثك.", previous: "السابق", next: "التالي", pageOf: (page: number, total: number) => `الصفحة ${page} من ${total}`,
  inStock: "متوفر", lowStock: (count: number) => `بقي ${count} فقط`, outOfStock: "غير متوفر",
  unknownStock: "يتم تأكيد التوفر عند الطلب", newBadge: "جديد", quantity: "الكمية", addToCart: "أضف إلى السلة",
  added: "تمت الإضافة إلى السلة", viewCart: "عرض السلة", sku: "المرجع", description: "الوصف", home: "الرئيسية",
  cartTitle: "سلتكم", cartEmpty: "سلتكم فارغة.", continueShopping: "متابعة التسوق", remove: "حذف",
  subtotal: "المجموع الفرعي", shipping: "التوصيل", shippingFree: "مجاني", total: "المجموع", checkout: "إتمام الطلب",
  freeShippingHint: (amount: string) => `توصيل مجاني ابتداءً من ${amount}.`, unavailableLine: "هذا المنتج لم يعد متوفراً. احذفوه للمتابعة.",
  checkoutTitle: "إتمام الطلب", contact: "معلومات الاتصال", delivery: "التوصيل", firstName: "الاسم", lastName: "النسب", email: "البريد الإلكتروني",
  phone: "الهاتف", address: "عنوان التوصيل", city: "المدينة", postalCode: "الرمز البريدي (اختياري)", notes: "ملاحظات (اختياري)",
  placeOrder: "تأكيد الطلب", processing: "جارٍ التأكيد…", orderSummary: "ملخص الطلب",
  paymentNote: "سيتم اقتراح الدفع الإلكتروني في الخطوة التالية. لن يتم خصم أي مبلغ الآن.",
  orderConfirmed: "تم تسجيل الطلب", orderNumber: "رقم الطلب", orderPendingNote: "تم حجز منتجاتكم. الدفع الإلكتروني قريباً؛ سنتواصل معكم لإتمام الطلب.",
  orderExpired: "انتهت صلاحية هذا الطلب", orderExpiredNote: "انتهت صلاحية حجز منتجاتكم. يمكنكم إعادة الطلب.",
  checkoutClosed: "الطلب عبر الإنترنت متاح قريباً. سلتكم محفوظة.",
  genericError: "الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.", footerRights: "جميع الحقوق محفوظة",
  footerAbout: "فن المائدة والمنزل المستوحى من الطبيعة.", language: "اللغة",
};

export const dictionaries: Record<Locale, Dictionary> = { fr, ar };
export type { Dictionary };

/** Picks the Arabic field when available in Arabic, falling back to French. */
export function localized(locale: Locale, french: string, arabic: string | null | undefined): string {
  return locale === "ar" && arabic ? arabic : french;
}
