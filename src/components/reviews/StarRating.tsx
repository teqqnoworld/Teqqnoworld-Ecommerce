import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingDisplayProps {
  rating: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

/**
 * Fractional star rating display with crisp partial fill support.
 */
export const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({
  rating,
  size = 'sm',
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(5, Number(rating) || 0));
  const iconClass = SIZE_MAP[size];

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillRatio = Math.max(0, Math.min(1, clamped - (starIndex - 1)));
        const percent = Math.round(fillRatio * 100);
        return (
          <span key={starIndex} className={`relative inline-block ${iconClass} shrink-0`}>
            <Star className={`${iconClass} text-zinc-200 fill-zinc-200`} />
            {percent > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${percent}%` }}
              >
                <Star className={`${iconClass} text-amber-500 fill-amber-500`} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};

const RATING_LABELS: Record<number, { label: string; hint: string }> = {
  1: { label: 'Poor', hint: 'Did not meet expectations' },
  2: { label: 'Fair', hint: 'Below expectations in some areas' },
  3: { label: 'Good', hint: 'Solid quality with minor room to improve' },
  4: { label: 'Very Good', hint: 'Great print and material quality' },
  5: { label: 'Excellent', hint: 'Outstanding craftsmanship and delivery' },
};

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

export const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [hovered, setHovered] = useState<number>(0);
  const activeRating = hovered || value;
  const meta = RATING_LABELS[activeRating];

  return (
    <div className="space-y-2">
      <div
        className="inline-flex items-center gap-1.5"
        role="radiogroup"
        aria-label="Select star rating"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeRating;
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={value === star}
              aria-label={`Rate ${star} out of 5 stars — ${RATING_LABELS[star].label}`}
              onMouseEnter={() => setHovered(star)}
              onFocus={() => setHovered(star)}
              onBlur={() => setHovered(0)}
              onClick={() => onChange(star)}
              className="p-1.5 rounded-lg transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-[#FF7A00] cursor-pointer disabled:opacity-50"
            >
              <Star
                className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors duration-150 ${
                  isFilled
                    ? 'text-amber-500 fill-amber-500'
                    : 'text-zinc-300 fill-zinc-100 hover:text-amber-300'
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="min-h-[20px] flex items-center gap-2 text-xs">
        {meta ? (
          <>
            <span className="font-semibold text-[#0B0B0D]">{meta.label}</span>
            <span aria-hidden="true" className="text-zinc-300">·</span>
            <span className="text-zinc-500">{meta.hint}</span>
          </>
        ) : (
          <span className="text-zinc-500">Tap a star to rate this product</span>
        )}
      </div>
    </div>
  );
};
