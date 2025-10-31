import React from 'react';

// Reklamlar tamamen kaldırıldı
export const useRewardedAdNew = () => {
  return {
    isLoaded: false,
    isLoading: false,
    reward: null,
    error: null,
    loadAd: () => {},
    showAd: () => {},
    clearReward: () => {},
    clearError: () => {},
    shouldShow: false,
  };
};