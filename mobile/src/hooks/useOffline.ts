import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { initDatabase } from '../services/database';
import { getPendingCount } from '../services/syncQueue';
import { getSyncStatus } from '../services/offlineData';
import { syncPendingOperations, fullSync, isOnline } from '../services/syncManager';
import { logError } from '../lib/sentry';

export interface OfflineState {
  isOnline: boolean;
  isInitialized: boolean;
  pendingOperations: number;
  lastSync: string | null;
  isSyncing: boolean;
}

export interface UseOfflineReturn extends OfflineState {
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOffline(): UseOfflineReturn {
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    isInitialized: false,
    pendingOperations: 0,
    lastSync: null,
    isSyncing: false,
  });

  // Initialize database and check status
  useEffect(() => {
    async function init() {
      try {
        await initDatabase();

        const online = await isOnline();
        const status = await getSyncStatus();

        setState((prev) => ({
          ...prev,
          isOnline: online,
          isInitialized: true,
          pendingOperations: status.pendingOperations,
          lastSync: status.lastSync,
        }));

        // Auto-sync if online and have pending operations
        if (online && status.pendingOperations > 0) {
          syncPendingOperations().catch((e) => logError(e, { context: 'autoSync' }));
        }
      } catch (error) {
        logError(error, { context: 'initOfflineSupport' });
        setState((prev) => ({ ...prev, isInitialized: true }));
      }
    }

    init();
  }, []);

  // Listen for network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      const online = netState.isConnected === true && netState.isInternetReachable !== false;

      setState((prev) => {
        // If we just came online and have pending ops, trigger sync
        if (online && !prev.isOnline && prev.pendingOperations > 0) {
          syncPendingOperations()
            .then(() => refresh())
            .catch((e) => logError(e, { context: 'reconnectSync' }));
        }
        return { ...prev, isOnline: online };
      });
    });

    return () => unsubscribe();
  }, []);

  // Refresh status
  const refresh = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setState((prev) => ({
        ...prev,
        pendingOperations: status.pendingOperations,
        lastSync: status.lastSync,
      }));
    } catch (error) {
      logError(error, { context: 'refreshOfflineStatus' });
    }
  }, []);

  // Manual sync
  const sync = useCallback(async () => {
    if (state.isSyncing) return;

    setState((prev) => ({ ...prev, isSyncing: true }));

    try {
      await fullSync();
      await refresh();
    } catch (error) {
      logError(error, { context: 'manualSync' });
      throw error;
    } finally {
      setState((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [state.isSyncing, refresh]);

  return {
    ...state,
    sync,
    refresh,
  };
}

// Simple hook to just check online status
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

  return isOnline;
}
