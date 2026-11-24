import React, { useState, useEffect, useRef } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import { getResponsiveImageProps } from '../utils/responsiveImage';

interface ClientLogo {
  id: string;
  name: string;
  tagline: string;
  image: string;
}

const CLIENT_LOGOS: ClientLogo[] = [
  {
    id: 'herbalife',
    name: 'Herbalife',
    tagline: 'Global Nutrition & Wellness Leader',
    image: '/assets/aistudio/Herbalife_Green_Circle_Logo-removebg-preview_2f94e509.webp',
  },
  {
    id: 'castrol',
    name: 'Castrol',
    tagline: 'Global Lubricants & Automotive',
    image: '/assets/aistudio/Castrol_Green_Circle_Emblem-removebg-preview_4fa7a82f.webp',
  },
  {
    id: 'vasavi-group',
    name: 'Vasavi Group',
    tagline: 'A Legacy of Trust • Real Estate & Infrastructure',
    image: '/assets/aistudio/Vasavi_Group_Circular_Badge_Logo-removebg-preview_823cc81a.webp',
  },
  {
    id: 'delhivery',
    name: 'Delhivery',
    tagline: 'Delhivery Limited • Pan-India Supply Chain',
    image: '/assets/aistudio/Delhivery_Circular_Logo_Badge-removebg-preview_0291f44c.webp',
  },
  {
    id: 'priya-cement',
    name: 'Priya Cement',
    tagline: 'Strength That Roars • Premium Infrastructure Cement',
    image: '/assets/aistudio/Priya_Cement_Lion_Emblem-removebg-preview_082e32cf.webp',
  },
  {
    id: 'caarvin-motors',
    name: 'Caarvin Motors',
    tagline: 'Your name a car, We Service • Multi-Brand Auto Hub',
    image: '/assets/aistudio/Caarvin_Motors_Circular_Badge_Logo-removebg-preview_748db22f.webp',
  },
];

export const ClientLogosSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [, setActiveLogo] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Duplicate the 6 logos 4 times so marquee flows seamlessly across ultra-wide displays without seams or jumps
  const marqueeItems = [...CLIENT_LOGOS, ...CLIENT_LOGOS, ...CLIENT_LOGOS, ...CLIENT_LOGOS];

  return (
    <section
      ref={sectionRef}
      aria-label="Trusted Brands & Businesses We Serve"
      className="relative bg-gradient-to-b from-[#111216] via-[#14151A] to-[#111216] text-white py-14 sm:py-18 lg:py-20 border-b border-[#25262F] overflow-hidden select-none"
    >
      {/* Background radial ambient orange glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#FF7A00]/8 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div
          className={`text-center max-w-3xl mx-auto transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Badge chip */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1F2028] border border-[#2F313D] text-xs text-zinc-300 shadow-inner mb-4">
            <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse" />
            <span className="font-semibold text-white tracking-wider uppercase text-[11px] sm:text-xs">
              Brands Across Our Industry Network
            </span>
            <Building2 className="w-3.5 h-3.5 text-[#FF7A00]" />
          </div>

          {/* Main Heading */}
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            Trusted Brands & Businesses We Serve
          </h2>

          {/* Subtitle */}
          <p className="mt-3 text-xs sm:text-sm md:text-base text-zinc-300 font-normal leading-relaxed max-w-2xl mx-auto">
            Supporting businesses with custom-branded merchandise, corporate apparel and promotional printing solutions.
          </p>

          {/* Reassurance points */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] sm:text-xs text-zinc-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A00]" />
              Pantone-Accurate Printing
            </span>
            <span className="text-zinc-500" aria-hidden="true">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A00]" />
              Zero MOQ Setup Fees
            </span>
            <span className="text-zinc-500" aria-hidden="true">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A00]" />
              GST Input Credit Ready
            </span>
          </div>
        </div>
      </div>

      {/* Marquee Track Container */}
      <div
        className={`mt-10 sm:mt-12 client-logos-track relative w-full overflow-hidden transition-all duration-700 delay-150 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Left Edge Fade Vignette */}
        <div
          className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 md:w-40 bg-gradient-to-r from-[#111216] via-[#111216]/80 to-transparent pointer-events-none z-20"
          aria-hidden="true"
        />

        {/* Right Edge Fade Vignette */}
        <div
          className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 md:w-40 bg-gradient-to-l from-[#111216] via-[#111216]/80 to-transparent pointer-events-none z-20"
          aria-hidden="true"
        />

        {/* Continuous Marquee Track */}
        <div className="animate-client-logos-marquee flex items-center py-4">
          {marqueeItems.map((logo, index) => {
            return (
              <div
                key={`${logo.id}-${index}`}
                onMouseEnter={() => setActiveLogo(`${logo.id}-${index}`)}
                onMouseLeave={() => setActiveLogo(null)}
                className="group relative flex-shrink-0 mx-4 sm:mx-6 md:mx-8 px-2 py-2 bg-transparent cursor-pointer flex flex-col items-center justify-center select-none"
                style={{ background: 'transparent', backgroundColor: 'transparent' }}
              >
                {/* Logo Image Wrapper - 100% transparent container */}
                <div
                  className="relative flex items-center justify-center bg-transparent transition-transform duration-300 ease-out group-hover:scale-108 h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24"
                  style={{ background: 'transparent', backgroundColor: 'transparent' }}
                >
                  <img
                    {...getResponsiveImageProps(logo.image, '(max-width: 640px) 64px, 96px')}
                    alt={`${logo.name} Brand Logo`}
                    width={96}
                    height={96}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full object-contain select-none bg-transparent"
                    style={{
                      background: 'transparent',
                      backgroundColor: 'transparent',
                      mixBlendMode: 'normal',
                    }}
                  />
                </div>

                {/* Brand Name Label */}
                <span className="mt-2.5 text-[11px] sm:text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors duration-200 tracking-wide text-center truncate max-w-[150px]">
                  {logo.name}
                </span>

                {/* Micro tooltip info on hover */}
                <div
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#FF7A00] text-[10px] font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-lg shadow-[#FF7A00]/30 z-30 transform group-hover:translate-y-2"
                >
                  {logo.tagline}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Subtle Trust Bar */}
      <div className="max-w-4xl mx-auto mt-8 sm:mt-10 px-4 text-center">
        <p className="text-[11px] sm:text-xs text-zinc-300">
          From fast-growing regional enterprises to national retail and logistics networks, we deliver brand-compliant corporate gear built to exacting standards.
        </p>
      </div>
    </section>
  );
};
