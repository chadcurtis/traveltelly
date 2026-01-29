import { useEffect, useState, useCallback } from 'react';
import { useNostrLogin } from '@nostrify/react/login';
import { Loader2, CheckCircle } from 'lucide-react';

// Storage key must match the one in App.tsx NostrLoginProvider
const LOGINS_STORAGE_KEY = 'nostr:login';

export function RemoteLoginSuccess() {
  const { logins } = useNostrLogin();
  const [checkCount, setCheckCount] = useState(0);
  const [status, setStatus] = useState<'checking' | 'success'>('checking');

  // Check localStorage directly as a fallback
  const checkLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(LOGINS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length > 0;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }, []);

  // Check if logged in via React state or localStorage
  const isLoggedIn = logins.length > 0 || checkLocalStorage();

  useEffect(() => {
    if (isLoggedIn) {
      setStatus('success');
      const timer = setTimeout(() => {
        // Try to close this tab (works if opened by signer app)
        window.close();
        // If we're still here (close didn't work), do a full page redirect
        window.location.href = '/';
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Check for 5 seconds, then show success anyway
    // (login completes in original tab, this page may be in an in-app browser)
    if (checkCount < 10) {
      const timer = setTimeout(() => {
        setCheckCount(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // After 5 seconds, assume the connection was approved
      // The login will complete in the original browser tab
      setStatus('success');
    }
  }, [isLoggedIn, checkCount, checkLocalStorage]);

  // Listen for storage events (in case login is added from another context)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOGINS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStatus('success');
            setTimeout(() => {
              window.close();
              window.location.href = '/';
            }, 1500);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        {status === 'checking' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Completing Login...</h1>
            <p className="text-muted-foreground">Please wait while we verify your connection.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Connection Approved!</h1>
            <p className="text-muted-foreground mb-2">You can close this tab and return to TravelTelly.</p>
            <p className="text-sm text-muted-foreground">Your login will complete in the original browser tab.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default RemoteLoginSuccess;
