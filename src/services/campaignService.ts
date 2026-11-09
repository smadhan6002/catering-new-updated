import type { Campaign, CampaignType, CampaignStatus } from '../types/admin';
import { siteConfig, getBusinessName } from '../config/site';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CAMPAIGNS_KEY = 'annapoorna_campaigns';
const CAMPAIGN_COUNTER_KEY = 'annapoorna_campaign_counter';

export interface MessageTemplate {
  id: string;
  type: CampaignType;
  titleEn: string;
  titleTa: string;
  templateEn: string;
  templateTa: string;
  defaultOfferEn?: string;
  defaultOfferTa?: string;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'bday-1',
    type: 'Birthday Greetings',
    titleEn: 'Warm Birthday Wishes',
    titleTa: 'பிறந்தநாள் நல்வாழ்த்துகள்',
    templateEn: `Dear {{customer_name}},\n\nWishing you a very Happy Birthday from all of us at {{business_name}}! 🎂🎉\n\nMay your year ahead be blessed with joy, health, and sweet celebrations. To make your special occasions memorable, we would be delighted to cater delicious feasts for your family and friends.\n\nWarm regards,\n{{business_name}}\nPh: {{business_phone}}`,
    templateTa: `அன்புள்ள {{customer_name}},\n\n{{business_name}} சார்பாக இனிய பிறந்தநாள் நல்வாழ்த்துகள்! 🎂🎉\n\nஇந்த ஆண்டு உங்களுக்கு அளவற்ற மகிழ்ச்சியும் நல்ல ஆரோக்கியமும் நிறைந்திருக்க வாழ்த்துகிறோம். உங்கள் வீட்டு அனைத்து சுபநிகழ்ச்சிகளுக்கும் சிறந்த கேட்டரிங் சேவையை வழங்க எப்போதும் தயாராக உள்ளோம்.\n\nவாழ்த்துகளுடன்,\n{{business_name}}\nதொலைபேசி: {{business_phone}}`,
  },
  {
    id: 'anniv-1',
    type: 'Anniversary Greetings',
    titleEn: 'Happy Wedding Anniversary',
    titleTa: 'திருமண நாள் வாழ்த்துகள்',
    templateEn: `Dear {{customer_name}},\n\nHappy Wedding Anniversary from {{business_name}}! 💐✨\n\nMay your love and togetherness continue to flourish for many more happy years. We look forward to serving your family gatherings and celebratory feasts with authentic taste and care.\n\nBest wishes,\n{{business_name}}\nPh: {{business_phone}}`,
    templateTa: `அன்புள்ள {{customer_name}},\n\n{{business_name}} சார்பாக மனமார்ந்த திருமண நாள் நல்வாழ்த்துகள்! 💐✨\n\nஉங்கள் குடும்பம் என்றென்றும் மகிழ்ச்சியோடும் சுபிட்சத்தோடும் வாழ வாழ்த்துகிறோம். உங்கள் வீட்டு விழாக்களை சுவையான விருந்துகளுடன் சிறப்பிக்க நாங்கள் எப்போதும் தயாராக இருக்கிறோம்.\n\nஅன்புடன்,\n{{business_name}}\nதொலைபேசி: {{business_phone}}`,
  },
  {
    id: 'fest-pongal',
    type: 'Festival Wishes',
    titleEn: 'Happy Pongal & Sankranti Wishes',
    titleTa: 'இனிய பொங்கல் நல்வாழ்த்துகள்',
    templateEn: `Dear {{customer_name}},\n\n{{business_name}} wishes you and your family a very Happy Pongal and Makar Sankranti! 🌾🍯\n\nMay this harvest festival bring abundant sweetness, happiness, and prosperity to your home. We are accepting advance bookings for festive feasts and family gatherings.\n\nBook early: {{business_phone}}\n{{business_name}}`,
    templateTa: `அன்புள்ள {{customer_name}},\n\n{{business_name}} சார்பாக உங்களுக்கும் உங்கள் குடும்பத்தினருக்கும் இனிய பொங்கல் நல்வாழ்த்துகள்! 🌾🍯\n\nபொங்கும் பொங்கல் போல உங்கள் வாழ்வில் மகிழ்ச்சியும் வளமும் என்றும் பெருகட்டும். பண்டிகை கால விசேஷங்கள் மற்றும் விருந்துகளுக்கான முன்பதிவுகள் நடைபெறுகின்றன.\n\nமுன்பதிவுக்கு: {{business_phone}}\n{{business_name}}`,
  },
  {
    id: 'fest-diwali',
    type: 'Festival Wishes',
    titleEn: 'Happy Diwali Wishes',
    titleTa: 'இனிய தீபாவளி நல்வாழ்த்துகள்',
    templateEn: `Dear {{customer_name}},\n\nWishing you and your loved ones a joyous and prosperous Diwali from {{business_name}}! 🪔✨\n\nMay your life be illuminated with peace and joy. Pre-order our traditional festival sweets, savouries, and special catering menus for your festive celebrations.\n\nContact: {{business_phone}}\n{{business_name}}`,
    templateTa: `அன்புள்ள {{customer_name}},\n\n{{business_name}} சார்பாக உங்களுக்கும் உங்கள் குடும்பத்தினருக்கும் இனிய தீபாவளி நல்வாழ்த்துகள்! 🪔✨\n\nஉங்கள் இல்லத்தில் ஆனந்தமும் மகிழ்ச்சியும் நிறையட்டும். தீபாவளி சிறப்பு இனிப்புகள், கார வகைகள் மற்றும் விருந்து உணவுகளுக்கு முன்பதிவு செய்யுங்கள்.\n\nதொடர்புக்கு: {{business_phone}}\n{{business_name}}`,
  },
  {
    id: 'offer-bulk',
    type: 'Catering Offers',
    titleEn: 'Special Catering Booking Offer',
    titleTa: 'சிறப்பு கேட்டரிங் சலுகை',
    defaultOfferEn: 'Complimentary Welcome Drinks & Special Dessert Counter for bookings above 100 guests!',
    defaultOfferTa: '100 நபர்களுக்கு மேல் முன்பதிவு செய்தால் இலவச வரவேற்பு பானங்கள் மற்றும் சிறப்பு இனிப்பு கவுண்டர்!',
    templateEn: `Dear {{customer_name}},\n\nExciting catering offer from {{business_name}}! 🌟\n\n{{offer_details}}\n\nWhether it's a family function, birthday party, or wedding event, experience our hygienic preparation and authentic South Indian taste.\n\nCall now to claim this offer: {{business_phone}}\n{{business_name}}`,
    templateTa: `அன்புள்ள {{customer_name}},\n\n{{business_name}} வழங்கும் பிரத்யேக கேட்டரிங் சலுகை! 🌟\n\n{{offer_details}}\n\nகுடும்ப விழாக்கள், பிறந்தநாள் மற்றும் சுபநிகழ்ச்சிகளுக்கு தூய்மையான மற்றும் தரமான பாரம்பரிய சுவைக்கு எங்களை அழையுங்கள்.\n\nஇப்போதே தொடர்பு கொள்ளவும்: {{business_phone}}\n{{business_name}}`,
  },
  {
    id: 'promo-wedding',
    type: 'Seasonal Promotions',
    titleEn: 'Wedding & Muhurtham Season Packages',
    titleTa: 'திருமண முகூர்த்த சிறப்பு தொகுப்புகள்',
    defaultOfferEn: 'Early booking discount of 10% on traditional Banana Leaf Wedding Feasts.',
    defaultOfferTa: 'பாரம்பரிய இலை சாப்பாடு திருமண விருந்துகளுக்கு 10% முன்கூட்டிய முன்பதிவு தள்ளுபடி.',
    templateEn: `Dear {{customer_name}},\n\nMuhurtham & Wedding Season is here! 🎊👰🤵\n\n{{business_name}} presents premium wedding catering packages including traditional Breakfast, Lunch Banana Leaf Meals, Evening Tiffin, and Reception Dinner.\n\n{{offer_details}}\n\nReserve your dates today: {{business_phone}}\n{{business_name}}`,
    templateTa: `அன்புள்ள {{customer_name}},\n\nமுகூர்த்த மற்றும் திருமண சீசன் ஆரம்பமாகியுள்ளது! 🎊👰🤵\n\n{{business_name}} வழங்கும் பிரம்மாண்ட திருமண விருந்து தொகுப்புகள்: பாரம்பரிய காலை உணவு, தலைவாழை இலை மதிய விருந்து, மாலை டிபன் & வரவேற்பு இரவு உணவு.\n\n{{offer_details}}\n\nதேதிகளை முன்பதிவு செய்ய: {{business_phone}}\n{{business_name}}`,
  },
  {
    id: 'custom-msg',
    type: 'Custom Messages',
    titleEn: 'Custom Message',
    titleTa: 'தனிப்பயன் செய்தி',
    templateEn: `Dear {{customer_name}},\n\nGreetings from {{business_name}}!\n\n{{offer_details}}\n\nThank you for choosing us for your catering needs.\n\nWarm regards,\n{{business_name}}\nPh: {{business_phone}}`,
    templateTa: `அன்புள்ள {{customer_name}},\n\n{{business_name}} சார்பாக வாழ்த்துகள்!\n\n{{offer_details}}\n\nஎங்களின் கேட்டரிங் சேவையை தொடர்ந்து ஆதரிப்பதற்கு நன்றி.\n\nஅன்புடன்,\n{{business_name}}\nதொலைபேசி: {{business_phone}}`,
  },
];

function getCounter(): number {
  return parseInt(localStorage.getItem(CAMPAIGN_COUNTER_KEY) || '0', 10);
}

function incrementCounter(): number {
  const next = getCounter() + 1;
  localStorage.setItem(CAMPAIGN_COUNTER_KEY, String(next));
  return next;
}

function generateCampaignId(): string {
  const next = incrementCounter();
  return `CMP-${String(next).padStart(4, '0')}`;
}

export function replacePlaceholders(
  template: string,
  customer: { name: string; mobile?: string },
  offerDetails = '',
  lang = 'en'
): string {
  const bizName = getBusinessName(lang);
  const bizPhone = siteConfig.whatsappNumber;

  return template
    .replace(/\{\{customer_name\}\}/g, customer.name || (lang === 'ta' ? 'அன்புள்ள வாடிக்கையாளர்' : 'Valued Customer'))
    .replace(/\{\{business_name\}\}/g, bizName)
    .replace(/\{\{business_phone\}\}/g, bizPhone)
    .replace(/\{\{offer_details\}\}/g, offerDetails || '');
}

export const campaignService = {
  /**
   * Synchronize campaigns from Supabase
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase.from('campaigns').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: Campaign[] = data.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
          language: c.language,
          messageTemplate: c.message_template,
          recipientFilter: c.recipient_filter,
          recipientIds: c.recipient_ids || [],
          recipientCount: c.recipient_count || 0,
          status: c.status,
          channel: c.channel,
          notes: c.notes || undefined,
          sentAt: c.sent_at || undefined,
          createdAt: c.created_at,
        }));
        localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(mapped));
      }
    } catch (err) {
      console.warn('Campaign sync error:', err);
    }
  },

  getAll(): Campaign[] {
    try {
      return JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || '[]') as Campaign[];
    } catch {
      return [];
    }
  },

  getById(id: string): Campaign | undefined {
    return this.getAll().find((c) => c.id === id);
  },

  create(data: Omit<Campaign, 'id' | 'createdAt'>): Campaign {
    const list = this.getAll();
    const campaign: Campaign = {
      ...data,
      id: generateCampaignId(),
      createdAt: new Date().toISOString(),
    };
    list.unshift(campaign);
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));

    if (isSupabaseConfigured) {
      supabase.from('campaigns').insert({
        id: campaign.id,
        title: campaign.title,
        type: campaign.type,
        language: campaign.language,
        message_template: campaign.messageTemplate,
        recipient_filter: campaign.recipientFilter,
        recipient_ids: campaign.recipientIds,
        recipient_count: campaign.recipientCount,
        status: campaign.status,
        channel: campaign.channel,
        notes: campaign.notes || null,
        sent_at: campaign.sentAt || null,
        created_at: campaign.createdAt,
      }).then(() => {}, () => {});
    }

    return campaign;
  },

  updateStatus(id: string, status: CampaignStatus, sentAt?: string): Campaign | undefined {
    const list = this.getAll();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    list[idx] = {
      ...list[idx],
      status,
      sentAt: sentAt || (status === 'Sent' ? new Date().toISOString() : list[idx].sentAt),
    };
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));

    if (isSupabaseConfigured) {
      supabase.from('campaigns').update({
        status,
        sent_at: list[idx].sentAt || null,
      }).eq('id', id).then(() => {}, () => {});
    }

    return list[idx];
  },

  delete(id: string): void {
    const list = this.getAll().filter((c) => c.id !== id);
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));

    if (isSupabaseConfigured) {
      supabase.from('campaigns').delete().eq('id', id).then(() => {}, () => {});
    }
  },

  generateDirectWhatsAppLink(
    mobile: string,
    message: string
  ): string {
    let clean = mobile.replace(/\D/g, '');
    if (clean.length === 10) clean = `91${clean}`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  },

  isApiConfigured(): boolean {
    const token = import.meta.env.VITE_WHATSAPP_API_TOKEN;
    const phoneId = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
    return Boolean(token && phoneId);
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    campaignService.syncFromSupabase().catch(() => {});
  }, 2800);
}
