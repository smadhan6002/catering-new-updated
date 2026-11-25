/**
 * Banana Leaf Meals Customization Types
 * Defines the configuration schema for the interactive meal customizer.
 */

export interface MealDishOption {
  dishId: string;
  dishName: string;
  dishNameTa: string;
  image?: string;
  categoryId?: string;
  isDefault?: boolean;
  isRequired?: boolean;
  extraPrice?: number;
}

export interface MealGroup {
  id: string;
  name: string;
  nameTa: string;
  description?: string;
  descriptionTa?: string;
  minSelections: number;
  maxSelections?: number;
  isRequired: boolean;
  dishes: MealDishOption[];
}

export interface MealCustomizationConfig {
  id: string;
  dishId: string; // 'ms1'
  isEnabled: boolean;
  titleEn: string;
  titleTa: string;
  subtitleEn: string;
  subtitleTa: string;
  groups: MealGroup[];
  updatedAt: string;
}

export interface CustomizedMealItemSelection {
  dishId: string;
  dishName: string;
  dishNameTa: string;
  groupId: string;
  groupName: string;
  groupNameTa: string;
  extraPrice?: number;
}

export interface CustomizedMealSelection {
  customizationId: string;
  parentDishId: string; // 'ms1'
  parentDishName: string;
  parentDishNameTa: string;
  selectedItems: CustomizedMealItemSelection[];
  specialInstructions?: string;
  createdAt: string;
}
