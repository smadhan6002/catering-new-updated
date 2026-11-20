import { siteConfig } from '../config/site';
import type { Order } from '../types/admin';
import type { Translations } from '../locales/en';

function getDishDisplayName(name: string | undefined, id: string | undefined, t: Translations): string {
  const trimmed = name?.trim() || '';
  if (trimmed && t.dishTranslationsByEnglishName?.[trimmed]) {
    return t.dishTranslationsByEnglishName[trimmed];
  }
  if (trimmed && t.dishTranslationsByEnglishName) {
    const lower = trimmed.toLowerCase();
    const match = Object.keys(t.dishTranslationsByEnglishName).find(
      (k) => k.toLowerCase() === lower
    );
    if (match && t.dishTranslationsByEnglishName[match]) {
      return t.dishTranslationsByEnglishName[match];
    }
  }
  if (id && t.dishes?.[id]) {
    return t.dishes[id];
  }
  return trimmed || (id && t.dishes?.[id]) || '';
}

export const generateWhatsAppLink = (order: Order, t: Translations): string => {
  let number = siteConfig.whatsappNumber;
  
  // Ensure international format without '+' sign, assuming India (91) if it's 10 digits
  if (number.startsWith('+')) {
    number = number.substring(1);
  } else if (number.length === 10) {
    number = `91${number}`;
  }
  
  let message = t.waHeader;
  message += `${t.waOrderId}: ${order.id}\n\n`;
  
  message += `${t.waCustomerDetails}\n`;
  message += `${t.waCustomerName}: ${order.customerName}\n`;
  message += `${t.waMobile}: ${order.mobile}\n`;
  message += `${t.waDeliveryDate}: ${order.orderDate}\n\n`;
  
  message += `${t.waCateringDetails}\n`;
  message += `${t.waNumberOfPeople}: ${order.guestCount !== null && order.guestCount !== undefined && order.guestCount > 0 ? `${order.guestCount}` : t.waNotProvided}\n\n`;
  
  message += `${t.waSelectedDishes}\n`;
  order.items.forEach((item, index) => {
    const displayName = getDishDisplayName(item.dishName, item.dishId, t);
    message += `${index + 1}. ${displayName}\n`;
    if (item.notes) {
      message += `   🌿 ${item.notes}\n`;
    }
  });
  message += `\n`;

  // Additional food quantities (kg)
  message += `${t.waAdditionalQuantities}\n`;
  const quantities = order.foodQuantities ?? [];
  if (quantities.length > 0) {
    quantities.forEach((fq, index) => {
      const displayName = getDishDisplayName(fq.dishName, fq.dishId, t);
      message += `${index + 1}. ${displayName} – ${fq.quantity} ${t.waKgUnit}\n`;
    });
  } else {
    message += `${t.waNoneKg}\n`;
  }
  message += `\n`;

  message += `${t.waAdditionalReq}\n`;
  message += `${order.notes || t.waNone}\n\n`;

  message += t.waFooter;
  
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encodedMessage}`;
};

