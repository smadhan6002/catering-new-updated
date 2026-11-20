/**
 * SEO Utility for Kanchi Ambal Catering
 * Manages dynamic document title, meta descriptions, canonical URLs,
 * OpenGraph, Twitter tags, and Search Engine Indexing (noindex for admin).
 */

export const SEO_CONFIG = {
  canonicalBase: 'https://kanchi-ambal-catering.vercel.app',
  businessNameEn: 'Kanchi Ambal Catering',
  businessNameTa: 'காஞ்சி அம்பாள் கேட்டரிங்',
  phone: '+91 7200015790',
  address: '25, Mandapam St, Pillaiyarpalayam, Kanchipuram, Tamil Nadu 631501',
  geo: {
    latitude: '12.8342',
    longitude: '79.7036',
  },
  defaultImage: 'https://kanchi-ambal-catering.vercel.app/favicon.ico',
  keywordsEn: [
    'Kanchi Ambal Catering',
    'Catering services in Kanchipuram',
    'Wedding catering Kanchipuram',
    'Vegetarian catering Kanchipuram',
    'Brahmin catering Kanchipuram',
    'Traditional South Indian catering Kanchipuram',
    'Banana Leaf meals catering Kanchipuram',
    'Catering service near me Kanchipuram',
    'Authentic Tamil catering',
    'Catering utensils rental Kanchipuram',
  ],
  keywordsTa: [
    'காஞ்சி அம்பாள் கேட்டரிங்',
    'காஞ்சிபுரம் கேட்டரிங் சர்வீஸ்',
    'திருமண கேட்டரிங் காஞ்சிபுரம்',
    'சைவ கேட்டரிங் காஞ்சிபுரம்',
    'பிராமணர் கேட்டரிங் காஞ்சிபுரம்',
    'வாழை இலை சாப்பாடு கேட்டரிங்',
    'பாரம்பரிய சமையல் காஞ்சிபுரம்',
  ],
};

function setMetaTag(nameOrProperty: 'name' | 'property', attrValue: string, content: string) {
  let element = document.querySelector(`meta[${nameOrProperty}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(nameOrProperty, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string) {
  let element = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

/**
 * Updates page SEO metadata dynamically based on current route & language
 */
export function updatePageSEO(path: string, isTa: boolean = false) {
  const isAdmin = path.startsWith('/admin');

  if (isAdmin) {
    // Admin routes must NOT be indexed by search engines
    document.title = isTa
      ? 'நிர்வாக போர்டல் | காஞ்சி அம்பாள் கேட்டரிங்'
      : 'Admin Portal | Kanchi Ambal Catering';
    setMetaTag('name', 'robots', 'noindex, nofollow');
    setCanonical(`${SEO_CONFIG.canonicalBase}/admin`);
    return;
  }

  // Public Home & Food Menu
  setMetaTag('name', 'robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  setCanonical(`${SEO_CONFIG.canonicalBase}/`);

  const title = isTa
    ? 'காஞ்சி அம்பாள் கேட்டரிங் | காஞ்சிபுரத்தில் சிறந்த சைவ & திருமண கேட்டரிங் சர்வீஸ்'
    : 'Kanchi Ambal Catering | Authentic Vegetarian & Wedding Catering in Kanchipuram';

  const description = isTa
    ? 'காஞ்சி அம்பாள் கேட்டரிங் - காஞ்சிபுரத்தில் பாரம்பரிய சைவ கேட்டரிங், வாழை இலை திருமண விருந்து, பிராமண சமையல் & கேட்டரிங் வாடகை பாத்திரங்கள். தொடர்பு: +91 7200015790.'
    : 'Kanchi Ambal Catering (காஞ்சி அம்பாள் கேட்டரிங்) provides premier authentic pure vegetarian catering, traditional South Indian banana leaf wedding feasts, Brahmin catering & utensil rentals in Kanchipuram. Call: +91 7200015790.';

  document.title = title;

  setMetaTag('name', 'description', description);
  setMetaTag('name', 'keywords', [...SEO_CONFIG.keywordsEn, ...SEO_CONFIG.keywordsTa].join(', '));
  setMetaTag('name', 'author', 'Kanchi Ambal Catering');

  // OpenGraph Tags
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:url', `${SEO_CONFIG.canonicalBase}/`);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:site_name', isTa ? 'காஞ்சி அம்பாள் கேட்டரிங்' : 'Kanchi Ambal Catering');
  setMetaTag('property', 'og:locale', isTa ? 'ta_IN' : 'en_IN');
  setMetaTag('property', 'og:locale:alternate', isTa ? 'en_IN' : 'ta_IN');

  // Twitter Card Tags
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);

  // Geo Tags for Local SEO
  setMetaTag('name', 'geo.region', 'IN-TN');
  setMetaTag('name', 'geo.placename', 'Kanchipuram');
  setMetaTag('name', 'geo.position', `${SEO_CONFIG.geo.latitude};${SEO_CONFIG.geo.longitude}`);
  setMetaTag('name', 'ICBM', `${SEO_CONFIG.geo.latitude}, ${SEO_CONFIG.geo.longitude}`);
}
