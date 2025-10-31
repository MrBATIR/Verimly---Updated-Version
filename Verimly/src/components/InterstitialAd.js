import React from 'react';

// Reklamlar tamamen kaldırıldı
const InterstitialAd = (onAdWatched, screenName = 'unknown') => {
  return {
    isLoaded: false,
    isLoading: false,
    shouldShow: false,
    showReason: '',
    error: null,
    showAd: () => {},
    loadAd: () => {},
    clearError: () => {},
  };
};

export default InterstitialAd;