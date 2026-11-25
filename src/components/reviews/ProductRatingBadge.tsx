import React from 'react';
import { Star } from 'lucide-react';
import { useReviewSummaries } from '../../context/ReviewSummaryContext';
import { StarRatingDisplay } from './StarRating';

interface ProductRatingBadgeProps {
  productId: string;
  variant?: 'pdp' | 'card';
  className?: string;
}

/**
 * Displays live published rating & review count for a specific product ID.
 * Never fabricates ratings when a product has zero published reviews.
 */
export const ProductRatingBadge: React.FC<ProductRatingBadgeProps> = ({
  productId,
  variant = 'pdp',
  className = '',
}) => {
  const { getProductRatingMeta } = useReviewSummaries();
  const { rating, reviewCount } = getProductRatingMeta(productId);

  const handleJumpToReviews = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById('product-reviews');
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (variant === 'card') {
    if (reviewCount <= 0) {
      return (
        <div className={`inline-flex items-center gap-1 text-[11px] text-zinc-400 ${className}`}>
          <Star className="w-3.5 h-3.5 text-zinc-300" />
          <span>No reviews yet</span>
        </div>
      );
    }

    return (
      <div className={`inline-flex items-center gap-1 text-xs ${className}`}>
        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
        <span className="font-bold text-zinc-800 tabular-nums">{rating.toFixed(1)}</span>
        <span className="text-zinc-500 text-[11px] tabular-nums">
          ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
        </span>
      </div>
    );
  }

  // PDP header variant (clickable smooth-scroll to #product-reviews)
  if (reviewCount <= 0) {
    return (
      <a
        href="#product-reviews"
        onClick={handleJumpToReviews}
        className={`inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-[#FF7A00] transition-colors group ${className}`}
      >
        <Star className="w-3.5 h-3.5 text-zinc-300 group-hover:text-[#FF7A00] transition-colors shrink-0" />
        <span>No reviews yet</span>
        <span aria-hidden="true" className="text-zinc-300">·</span>
        <span className="font-semibold text-[#FF7A00] group-hover:underline">
          Be the first to review
        </span>
      </a>
    );
  }

  return (
    <a
      href="#product-reviews"
      onClick={handleJumpToReviews}
      className={`inline-flex items-center gap-1.5 text-xs hover:opacity-85 transition-opacity ${className}`}
    >
      <StarRatingDisplay rating={rating} size="sm" />
      <span className="font-bold text-zinc-900 tabular-nums ml-0.5">{rating.toFixed(1)}</span>
      <span className="text-zinc-500 tabular-nums hover:underline">
        ({reviewCount} {reviewCount === 1 ? 'Review' : 'Reviews'})
      </span>
    </a>
  );
};
