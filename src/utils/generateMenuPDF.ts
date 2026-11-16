import jsPDF from 'jspdf';
import { categories as staticCategories } from '../data/menu';
import { dishService } from '../services/dishService';
import { siteConfig, getBusinessName } from '../config/site';
import { ta } from '../locales/ta';
import logoImg from '../assets/LOGO.png';
import {
  renderDocumentFooter,
  renderDecorativePageFrame,
  ensureFontsReady,
  loadImage,
  drawFittedText,
  PAGE_GEOMETRY,
} from './documentHeaderFooter';

interface MenuPageDish {
  id: string;
  name: string;
  nameTa: string;
  category: string;
  categoryId: string;
  image?: string;
  defaultUnit: string;
}

interface MenuPageCategory {
  id: string;
  name: string;
  nameTa: string;
  dishes: MenuPageDish[];
}

/**
 * Builds all category and dish data merging built-in and admin-added items
 */
function compileMenuData(): MenuPageCategory[] {
  const result: MenuPageCategory[] = [];
  const activeDishes = dishService.getActiveDishes();

  for (const cat of staticCategories) {
    const catNameTa = ta.categories?.[cat.id] || cat.name;
    const catDishes = activeDishes.filter((d) => d.categoryId === cat.id);
    if (catDishes.length > 0) {
      result.push({
        id: cat.id,
        name: cat.name,
        nameTa: catNameTa,
        dishes: catDishes.map((d) => ({
          id: d.id,
          name: d.name,
          nameTa: d.nameTa,
          category: cat.name,
          categoryId: d.categoryId,
          image: d.image,
          defaultUnit: d.defaultUnit,
        })),
      });
    }
  }

  // Check any custom categories
  const knownCatIds = new Set(staticCategories.map((c) => c.id));
  const otherDishes = activeDishes.filter((d) => !knownCatIds.has(d.categoryId));
  for (const od of otherDishes) {
    let target = result.find((c) => c.id === od.categoryId);
    if (!target) {
      target = {
        id: od.categoryId,
        name: od.categoryName || od.categoryId,
        nameTa: od.categoryName || od.categoryId,
        dishes: [],
      };
      result.push(target);
    }
    target.dishes.push({
      id: od.id,
      name: od.name,
      nameTa: od.nameTa,
      category: target.name,
      categoryId: od.categoryId,
      image: od.image,
      defaultUnit: od.defaultUnit,
    });
  }

  return result.filter((c) => c.dishes.length > 0);
}

/**
 * Generates and downloads a Food Menu PDF with Tamil Unicode support
 */
export async function generateMenuPDF(
  onProgress?: (percent: number, status: string) => void,
  language: 'en' | 'ta' = 'en'
): Promise<void> {
  onProgress?.(10, 'Compiling menu items…');

  await ensureFontsReady();

  const isTa = language === 'ta';
  const bizName = getBusinessName(language);

  const menuCategories = compileMenuData();
  const logo = await loadImage(logoImg);

  // Pre-load dish images (in parallel batches)
  onProgress?.(25, 'Loading dish images…');
  const loadedImagesMap = new Map<string, HTMLImageElement | null>();
  const allDishes = menuCategories.flatMap((c) => c.dishes);

  // Load first 60 images or thumbnails to ensure rapid rendering
  await Promise.all(
    allDishes.slice(0, 70).map(async (d) => {
      if (d.image) {
        const img = await loadImage(d.image);
        loadedImagesMap.set(d.id, img);
      }
    })
  );

  onProgress?.(50, 'Designing PDF pages…');

  // Canvas A4 dimensions at 2x resolution (1240 x 1754 px)
  const PAGE_WIDTH = PAGE_GEOMETRY.PAGE_WIDTH;
  const PAGE_HEIGHT = PAGE_GEOMETRY.PAGE_HEIGHT;

  // Distribute categories dynamically based on actual rendered pixel height
  const pagesData: MenuPageCategory[][] = [];
  let currentPage: MenuPageCategory[] = [];
  let currentHeight = 0;

  for (const cat of menuCategories) {
    const isFirstPage = pagesData.length === 0;
    const maxH = isFirstPage ? 1320 : 1480;
    // Category height: 48px header + dish rows in 2 columns (40px per row) + 24px bottom gap
    const catH = 48 + Math.ceil(cat.dishes.length / 2) * 40 + 24;

    if (currentPage.length > 0 && currentHeight + catH > maxH) {
      pagesData.push(currentPage);
      currentPage = [cat];
      currentHeight = catH;
    } else {
      currentPage.push(cat);
      currentHeight += catH;
    }
  }
  if (currentPage.length > 0) {
    pagesData.push(currentPage);
  }

  const totalPages = pagesData.length;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    onProgress?.(
      50 + Math.round(((pageIdx + 1) / totalPages) * 45),
      `Rendering page ${pageIdx + 1} of ${totalPages}…`
    );

    // Clear background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Decorative Borders
    renderDecorativePageFrame(ctx, PAGE_WIDTH, PAGE_HEIGHT);

    let y = 48;

    // Header Band
    if (pageIdx === 0) {
      // Luxurious Top Header for Page 1
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(45, y, PAGE_WIDTH - 90, 160);

      // Gold accent line
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(45, y + 156, PAGE_WIDTH - 90, 4);

      // Logo
      if (logo) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(125, y + 80, 52, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.clip();
        ctx.drawImage(logo, 73, y + 28, 104, 104);
        ctx.restore();
      }

      // Title & Contact Info (Guaranteed fitting without clipping)
      drawFittedText(
        ctx,
        bizName,
        200,
        y + 56,
        PAGE_WIDTH - 260,
        34,
        22,
        '"Noto Sans Tamil", "Inter", sans-serif',
        'bold',
        '#FFFFFF',
        'left'
      );

      const menuTitle = isTa
        ? `${siteConfig.name} • பாரம்பரிய கேட்டரிங் மெனு பட்டியல்`
        : 'காஞ்சி அம்பாள் பாரம்பரிய கேட்டரிங் மெனு பட்டியல் (FOOD MENU)';
      drawFittedText(
        ctx,
        menuTitle,
        200,
        y + 90,
        PAGE_WIDTH - 260,
        18,
        13,
        '"Noto Sans Tamil", "Inter", sans-serif',
        'bold',
        '#FEF3C7',
        'left'
      );

      drawFittedText(
        ctx,
        `Ph: +91 ${siteConfig.whatsappNumber}  •  Kanchipuram, Tamil Nadu  •  Traditional Pure Vegetarian`,
        200,
        y + 122,
        PAGE_WIDTH - 260,
        14,
        11,
        '"Inter", "Noto Sans Tamil", sans-serif',
        'normal',
        '#FFFFFF',
        'left'
      );

      y += 180;

      // Menu Title Banner
      ctx.fillStyle = '#FFF7ED';
      ctx.fillRect(45, y, PAGE_WIDTH - 90, 48);
      ctx.strokeStyle = '#FED7AA';
      ctx.lineWidth = 1;
      ctx.strokeRect(45, y, PAGE_WIDTH - 90, 48);

      ctx.fillStyle = '#9A3412';
      ctx.font = 'bold 16px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isTa
          ? '★ சுபகாரியங்களுக்கான சிறப்பு சைவ உணவு மெனு தேர்வுகள் ★'
          : '★ PURE VEGETARIAN CATERING SERVICES  |  FOOD MENU SELECTIONS ★',
        PAGE_WIDTH / 2,
        y + 30
      );
      ctx.textAlign = 'left';

      y += 66;
    } else {
      // Compact Header for Subsequent Pages
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(45, y, PAGE_WIDTH - 90, 54);

      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(45, y + 51, PAGE_WIDTH - 90, 3);

      drawFittedText(
        ctx,
        `${bizName}  •  ${isTa ? 'மெனு பட்டியல்' : 'Food Menu Catalog'}`,
        65,
        y + 34,
        PAGE_WIDTH - 360,
        20,
        14,
        '"Noto Sans Tamil", "Inter", sans-serif',
        'bold',
        '#FFFFFF',
        'left'
      );

      ctx.font = '14px "Inter", sans-serif';
      ctx.fillStyle = '#FEF3C7';
      ctx.textAlign = 'right';
      ctx.fillText(`Ph: +91 ${siteConfig.whatsappNumber}`, PAGE_WIDTH - 65, y + 34);
      ctx.textAlign = 'left';

      y += 72;
    }

    // Categories on this page
    const pageCategories = pagesData[pageIdx];

    for (const cat of pageCategories) {
      // Category Header Bar
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(45, y, PAGE_WIDTH - 90, 36);

      ctx.fillStyle = '#EA580C';
      ctx.fillRect(45, y, 6, 36);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 18px "Inter", "Segoe UI", sans-serif';
      ctx.fillText(cat.name, 62, y + 24);

      ctx.font = 'bold 16px "Noto Sans Tamil", "Latha", sans-serif';
      ctx.fillStyle = '#EA580C';
      ctx.fillText(`(${cat.nameTa})`, 62 + ctx.measureText(cat.name).width + 12, y + 24);

      y += 48;

      // Dishes in 2 Columns
      const colWidth = (PAGE_WIDTH - 110) / 2;
      const leftX = 45;
      const rightX = leftX + colWidth + 20;

      const dishes = cat.dishes;
      const midPoint = Math.ceil(dishes.length / 2);

      let maxColY = y;

      for (let i = 0; i < dishes.length; i++) {
        const dish = dishes[i];
        const isLeft = i < midPoint;
        const colX = isLeft ? leftX : rightX;
        const rowInCol = isLeft ? i : i - midPoint;
        const itemY = y + rowInCol * 40;

        if (itemY + 36 > maxColY) {
          maxColY = itemY + 36;
        }

        // Dish card background
        ctx.fillStyle = rowInCol % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        ctx.fillRect(colX, itemY, colWidth, 34);

        // Thumbnail image or placeholder dot
        const dishImg = loadedImagesMap.get(dish.id);
        if (dishImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(colX + 18, itemY + 17, 12, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(dishImg, colX + 6, itemY + 5, 24, 24);
          ctx.restore();
        } else {
          ctx.fillStyle = '#EA580C';
          ctx.beginPath();
          ctx.arc(colX + 18, itemY + 17, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Dish Name (English)
        ctx.fillStyle = '#1E293B';
        ctx.font = 'bold 13px "Inter", "Segoe UI", sans-serif';
        const truncatedEn = dish.name.length > 24 ? dish.name.substring(0, 22) + '…' : dish.name;
        ctx.fillText(truncatedEn, colX + 38, itemY + 16);

        // Dish Name (Tamil)
        ctx.fillStyle = '#64748B';
        ctx.font = '12px "Noto Sans Tamil", "Latha", sans-serif';
        const truncatedTa = dish.nameTa.length > 22 ? dish.nameTa.substring(0, 20) + '…' : dish.nameTa;
        ctx.fillText(truncatedTa, colX + 38, itemY + 30);

        // Unit badge
        if (dish.defaultUnit) {
          ctx.fillStyle = '#FED7AA';
          ctx.fillRect(colX + colWidth - 80, itemY + 8, 70, 18);
          ctx.fillStyle = '#9A3412';
          ctx.font = 'bold 10px "Inter", "Segoe UI", sans-serif';
          ctx.fillText(dish.defaultUnit, colX + colWidth - 72, itemY + 21);
        }
      }

      y = maxColY + 24;
    }

    // Page Footer
    renderDocumentFooter({
      ctx,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      language,
      currentPage: pageIdx + 1,
      totalPages,
      docNumber: 'MENU-CATALOG',
      bizName,
    });

    // Convert canvas to image data and add to jsPDF
    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    if (pageIdx > 0) {
      doc.addPage();
    }
    doc.addImage(pageDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  onProgress?.(98, 'Finalizing download…');
  doc.save('Kanchi_Ambal_Catering_Food_Menu.pdf');
  onProgress?.(100, 'Complete!');
}
