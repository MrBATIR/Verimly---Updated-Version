import React from 'react';

// Reklamlar tamamen kaldırıldı
const RewardedAd = (onAdWatched, screenName = 'unknown') => {
  return {
    isLoaded: false,
    isLoading: false,
    shouldShow: false,
    showReason: '',
    reward: null,
    error: null,
    showAd: () => {},
    loadAd: () => {},
    clearReward: () => {},
    clearError: () => {},
  };
};

export default RewardedAd;