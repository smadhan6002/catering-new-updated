export const siteConfig = {
  name: "Kanchi Ambal Catering",
  tamilName: "காஞ்சி அம்பாள் கேட்டரிங்",
  description: "Pick your dishes, set the guest count, and send your catering inquiry on WhatsApp.",
  whatsappNumber: import.meta.env?.VITE_WHATSAPP_NUMBER || "7200015790",
};

/**
 * Centralized business name getter based on language:
 * - English ('en'): "Kanchi Ambal Catering"
 * - Tamil ('ta'): "காஞ்சி அம்பாள் கேட்டரிங்"
 */
export function getBusinessName(lang: 'en' | 'ta' | string = 'en'): string {
  return lang === 'ta' ? siteConfig.tamilName : siteConfig.name;
}


