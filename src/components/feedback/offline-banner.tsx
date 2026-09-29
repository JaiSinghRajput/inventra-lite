import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 select-none shadow-inner sticky top-0 z-50">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>
        <strong>Offline Mode:</strong> Showing cached data. Connect to network to record bills or modify inventory.
      </span>
    </div>
  );
};
