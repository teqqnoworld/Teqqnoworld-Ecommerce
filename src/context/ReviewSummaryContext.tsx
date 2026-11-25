import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ProductReviewSummary } from '../types';
import { fetchAllProductReviewSummaries } from '../services/reviewsService';

interface ReviewSummaryContextValue {
  summaries: Record<string, ProductReviewSummary>;
  loaded: boolean;
  refreshSummaries: () => Promise<void>;
  updateSingleSummary: (summary: ProductReviewSummary) => void;
  getProductRatingMeta: (productId: string) => {
    rating: number;
    reviewCount: number;
    verifiedCount: number;
    hasReviews: boolean;
  };
}

const ReviewSummaryContext = createContext<ReviewSummaryContextValue>({
  summaries: {},
  loaded: false,
  refreshSummaries: async () => {},
  updateSingleSummary: () => {},
  getProductRatingMeta: () => ({
    rating: 0,
    reviewCount: 0,
    verifiedCount: 0,
    hasReviews: false,
  }),
});

export const ReviewSummaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [summaries, setSummaries] = useState<Record<string, ProductReviewSummary>>({});
  const [loaded, setLoaded] = useState(false);

  const refreshSummaries = useCallback(async () => {
    const res = await fetchAllProductReviewSummaries();
    if (res.success && res.summaries) {
      setSummaries(res.summaries);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refreshSummaries();
  }, [refreshSummaries]);

  const updateSingleSummary = useCallback((summary: ProductReviewSummary) => {
    if (!summary?.productId) return;
    setSummaries((prev) => ({
      ...prev,
      [summary.productId]: summary,
    }));
  }, []);

  // Strictly derives ratings ONLY from genuine published reviews (never fabricates ratings)
  const getProductRatingMeta = useCallback(
    (productId: string) => {
      const live = summaries[productId];
      if (live && live.totalReviews > 0) {
        return {
          rating: live.averageRating,
          reviewCount: live.totalReviews,
          verifiedCount: live.verifiedCount,
          hasReviews: true,
        };
      }
      return {
        rating: 0,
        reviewCount: 0,
        verifiedCount: 0,
        hasReviews: false,
      };
    },
    [summaries]
  );

  const value = useMemo(
    () => ({
      summaries,
      loaded,
      refreshSummaries,
      updateSingleSummary,
      getProductRatingMeta,
    }),
    [summaries, loaded, refreshSummaries, updateSingleSummary, getProductRatingMeta]
  );

  return (
    <ReviewSummaryContext.Provider value={value}>
      {children}
    </ReviewSummaryContext.Provider>
  );
};

export function useReviewSummaries(): ReviewSummaryContextValue {
  return useContext(ReviewSummaryContext);
}
