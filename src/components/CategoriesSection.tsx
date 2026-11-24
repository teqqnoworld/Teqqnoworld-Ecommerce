import React from 'react';
import { ArrowRight } from 'lucide-react';
import { getCategoryPath } from '../config/seoRoutes';
import { getResponsivePictureSources } from '../utils/responsiveImage';

interface CategoriesSectionProps {
  onSelectCategory: (categoryId: string) => void;
}

export interface CircularCategory {
  id: string;
  name: string;
  subtitle: string;
  image: string;
}

export const CIRCULAR_CATEGORIES: CircularCategory[] = [
  {
    id: 'corporate-gifting',
    name: 'Corporate Gifting',
    subtitle: 'Mugs, Hampers & Kits',
    image: '/assets/aistudio/Corporate_Gifting_Badge_with_Branded_Essentials_11cc4d80.webp',
  },
  {
    id: 'promotional-items',
    name: 'Promotional Items',
    subtitle: 'Standees, Canopies & Umbrellas',
    image: '/assets/aistudio/Promotional_Products_Showcase_Badge_12258b82.webp',
  },
  {
    id: 'custom-tshirt-printing',
    name: 'Custom T-Shirt Printing',
    subtitle: 'Polos, T-Shirts & Apparel',
    image: '/assets/aistudio/Tipping_and_Classic_Polo_Shirt_Showcase_e4ad53f7.webp',
  },
  {
    id: 'printing-items',
    name: 'Printing Items',
    subtitle: 'Visiting Cards & Brochures',
    image: '/assets/aistudio/Professional_Printing_Items_Badge_03c76e87.webp',
  },
  {
    id: 'custom-caps',
    name: 'Custom Caps',
    subtitle: 'Cotton Flexi & Baseball Caps',
    image: '/assets/aistudio/Custom_Caps_Promotional_Badge_4c597194.webp',
  },
];

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({ onSelectCategory }) => {
  return (
    <section className="py-16 sm:py-20 bg-[#F4F2FA] border-b border-[#E5E5EA] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 sm:mb-12 gap-4">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#B85000] mb-1.5">
              COMPREHENSIVE PRODUCT MATRIX
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#0B0B0D] tracking-tight">
              Explore Popular Categories
            </h2>
            <p className="text-zinc-600 text-xs sm:text-sm mt-1">
              Select a category to explore custom printed promotional merchandise and corporate essentials.
            </p>
          </div>

          <a
            href="/catalog"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                e.preventDefault();
                onSelectCategory('all');
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B85000] hover:text-[#964000] transition-colors shrink-0 group cursor-pointer self-start sm:self-auto min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] rounded-lg px-1"
          >
            <span>View All Categories</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
          </a>
        </div>

        {/* 5 Circular Category Badges */}
        {/* Responsive Layout:
            - Desktop (lg+): 5 circles in 1 horizontal row
            - Tablet (md): 3 circles on row 1, 2 centered on row 2
            - Mobile (<md): 2 circles per row, 5th centered
        */}
        <div className="flex flex-wrap justify-center items-start gap-5 sm:gap-6 md:gap-7 lg:gap-6 xl:gap-8">
          {CIRCULAR_CATEGORIES.map((cat, idx) => {
            const pic = getResponsivePictureSources(
              cat.image,
              '(max-width: 640px) 162px, (max-width: 1024px) 202px, 222px'
            );
            return (
            <a
              key={cat.id}
              href={getCategoryPath(cat.id)}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onSelectCategory(cat.id);
                }
              }}
              className={`group flex flex-col items-center cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] rounded-2xl p-1
                w-[calc(50%-0.75rem)] max-w-[170px]
                sm:w-[calc(33.333%-1rem)] sm:max-w-[190px]
                md:w-[calc(33.333%-1.5rem)] md:max-w-[210px]
                lg:w-auto lg:flex-1 lg:max-w-[230px]
                ${idx === 4 ? 'max-sm:mx-auto max-sm:col-span-2' : ''}
              `}
              aria-label={cat.name}
            >
              {/* Circular Badge Container with Golden-Orange Border */}
              <div className="relative aspect-square w-full rounded-full transition-all duration-300 ease-out group-hover:scale-106 group-hover:-translate-y-2 drop-shadow-md group-hover:drop-shadow-2xl">
                <picture className="block w-full h-full">
                  {pic.avifSrcSet && (
                    <source type="image/avif" srcSet={pic.avifSrcSet} sizes={pic.sizes} />
                  )}
                  {pic.webpSrcSet && (
                    <source type="image/webp" srcSet={pic.webpSrcSet} sizes={pic.sizes} />
                  )}
                  <img
                    src={pic.src}
                    srcSet={pic.webpSrcSet}
                    sizes={pic.sizes}
                    alt={cat.name}
                    width={222}
                    height={222}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain select-none pointer-events-none transition-transform duration-300"
                  />
                </picture>
                
                {/* Subtle orange ambient glow on hover */}
                <div className="absolute inset-0 rounded-full bg-[#FF7A00]/0 group-hover:bg-[#FF7A00]/10 transition-colors duration-300 pointer-events-none" />
              </div>

              {/* Category Name & Subtitle */}
              <div className="mt-3 text-center space-y-0.5 w-full">
                <h3 className="font-display font-bold text-xs sm:text-sm md:text-base text-zinc-900 group-hover:text-[#B85000] transition-colors leading-tight line-clamp-1">
                  {cat.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-zinc-600 font-medium line-clamp-1">
                  {cat.subtitle}
                </p>
                <div className="pt-1 flex items-center justify-center gap-1 text-[11px] font-bold text-[#B85000] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span>Explore</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </a>
            );
          })}
        </div>

      </div>
    </section>
  );
};
