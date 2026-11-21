/**
 * Normal Meals Configuration & Default Items
 * Traditional South Indian Normal Meals (சாதாரண சாப்பாடு) with 9 fixed default items.
 */

export interface IncludedNormalMealDish {
  dishId: string;
  dishName: string;
  dishNameTa: string;
}

export const NORMAL_MEALS_DISH_ID = 'ms_normal';
export const NORMAL_MEALS_NAME = 'Normal Meals';
export const NORMAL_MEALS_NAME_TA = 'சாதாரண சாப்பாடு';

/**
 * 9 fixed default items automatically included in Normal Meals:
 * 1. Rice (சாதம்)
 * 2. Sambar (சாம்பார்)
 * 3. Kootu (கூட்டு)
 * 4. Rasam (ரசம்)
 * 5. Vatha Kuzhambu (வத்தக்குழம்பு)
 * 6. Buttermilk (மோர்)
 * 7. Poriyal (பொரியல்)
 * 8. Pickle (ஊறுகாய்)
 * 9. Appalam (அப்பளம்)
 */
export const NORMAL_MEALS_DEFAULT_ITEMS: IncludedNormalMealDish[] = [
  { dishId: 'ms2', dishName: 'Rice', dishNameTa: 'சாதம்' },
  { dishId: 'ms3', dishName: 'Sambar', dishNameTa: 'சாம்பார்' },
  { dishId: 'ms11', dishName: 'Kootu', dishNameTa: 'கூட்டு' },
  { dishId: 'ms5', dishName: 'Tomato Rasam', dishNameTa: 'ரசம்' },
  { dishId: 'ms4', dishName: 'Vatha Kuzhambu', dishNameTa: 'வத்தக்குழம்பு' },
  { dishId: 'ms9', dishName: 'Buttermilk', dishNameTa: 'மோர்' },
  { dishId: 'ms10', dishName: 'Poriyal', dishNameTa: 'பொரியல்' },
  { dishId: 'ms13', dishName: 'Pickle', dishNameTa: 'ஊறுகாய்' },
  { dishId: 'ms12', dishName: 'Appalam', dishNameTa: 'அப்பளம்' },
];

/**
 * Checks whether an item ID or name corresponds to Normal Meals.
 */
export function isNormalMeals(dishIdOrName?: string): boolean {
  if (!dishIdOrName) return false;
  const lower = dishIdOrName.trim().toLowerCase();
  return (
    lower === 'ms_normal' ||
    lower === 'normal meals' ||
    lower === 'சாதாரண சாப்பாடு' ||
    lower.includes('normal meal') ||
    lower.includes('சாதாரண சாப்பாடு')
  );
}
