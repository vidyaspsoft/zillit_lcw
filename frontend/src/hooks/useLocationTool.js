import { useState, useCallback, useEffect, useRef } from 'react';
import locationToolService from '../services/locationToolService';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import { LOCATION_API_BASE_URL } from '../config/constants';

const SOCKET_URL = LOCATION_API_BASE_URL.replace('/api/v2/location', '');

const useLocationTool = () => {
  const [units, setUnits] = useState([]);
  // All locations for the active tab — fetched once, grouped client-side
  const [allLocations, setAllLocations] = useState([]);
  const [stats, setStats] = useState({
    stats: {},
    badges: {},
    unitChats: {},
  });
  // Badge counts per folder key for the active tab
  const [badgeMap, setBadgeMap] = useState({});
  const [deletedLocations, setDeletedLocations] = useState([]);
  const [unitChats, setUnitChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const refreshCallbackRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // Debounced refresh — prevents rapid-fire re-fetches from socket events
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      if (refreshCallbackRef.current) refreshCallbackRef.current();
    }, 500);
  }, []);

  // Socket.IO connection
  useEffect(() => {
    try {
      const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Location socket connected');
      });

      // Real-time event handlers — trigger debounced refresh
      const events = [
        'location_created', 'locations_moved', 'location_deleted',
        'new_comment', 'new_unit_chat',
      ];
      events.forEach((evt) => {
        socket.on(evt, () => debouncedRefresh());
      });

      socket.on('locations_shared', (data) => {
        toast.info(`${data.sharedBy?.name || 'Someone'} shared locations with you`);
        debouncedRefresh();
      });

      return () => {
        socket.disconnect();
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      };
    } catch {
      // Socket connection optional
    }
  }, [debouncedRefresh]);

  const setRefreshCallback = useCallback((cb) => {
    refreshCallbackRef.current = cb;
  }, []);

  const joinProject = useCallback((projectId) => {
    if (socketRef.current) {
      socketRef.current.emit('join_project', projectId);
    }
  }, []);

  // ── Units ──
  const fetchUnits = useCallback(async () => {
    try {
      const data = await locationToolService.getUnits();
      const result = data.data || data || [];
      setUnits(Array.isArray(result) ? result : []);
      return Array.isArray(result) ? result : [];
    } catch {
      setUnits([]);
      return [];
    }
  }, []);

  // ── Fetch ALL locations for a tab (single API call) ──
  const fetchAllLocations = useCallback(async (status) => {
    setLoading(true);
    setError(null);
    try {
      const data = await locationToolService.getLocations({ status, limit: 0 });
      const result = data.data || {};
      const locs = result.locations || [];
      setAllLocations(locs);
      return locs;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch locations';
      setError(msg);
      toast.error(msg);
      setAllLocations([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch badges for a tab ──
  const fetchBadges = useCallback(async (status) => {
    try {
      const data = await locationToolService.getBadges(status);
      const badges = data.data || {};
      setBadgeMap(badges);
      return badges;
    } catch {
      setBadgeMap({});
      return {};
    }
  }, []);

  // ── Mark folder as viewed ──
  const markFolderViewed = useCallback(async (folderKey) => {
    try {
      await locationToolService.markViewed(folderKey);
      // Update local badge map — set this key to 0
      setBadgeMap((prev) => {
        const next = { ...prev };
        delete next[folderKey];
        return next;
      });
    } catch {
      // silent
    }
  }, []);

  // ── Stats (counts + badges) ──
  const fetchStats = useCallback(async () => {
    try {
      const data = await locationToolService.getStats();
      setStats(data.data || {
        stats: {},
        badges: {},
        unitChats: {},
      });
    } catch {
      // silent
    }
  }, []);

  // ── Deleted ──
  const fetchDeletedLocations = useCallback(async () => {
    try {
      const data = await locationToolService.getDeletedLocations();
      setDeletedLocations(data.data || []);
    } catch {
      setDeletedLocations([]);
    }
  }, []);

  // ── Unit Chat ──
  const fetchUnitChats = useCallback(async (unit) => {
    try {
      const data = await locationToolService.getUnitChats(unit);
      setUnitChats(data.data || []);
    } catch {
      setUnitChats([]);
    }
  }, []);

  const sendUnitChat = useCallback(async (unit, text, files = []) => {
    try {
      const data = await locationToolService.createUnitChat(unit, text, files);
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      return null;
    }
  }, []);

  // ── CRUD ──
  const createLocation = useCallback(async (formData) => {
    try {
      const data = await locationToolService.createLocation(formData);
      toast.success('Location created successfully');
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create location');
      return null;
    }
  }, []);

  const updateLocation = useCallback(async (id, formData) => {
    try {
      const data = await locationToolService.updateLocation(id, formData);
      toast.success('Location updated successfully');
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update location');
      return null;
    }
  }, []);

  const moveLocations = useCallback(async (locationIds, targetStatus, { commonDetails, perItemDetails } = {}) => {
    try {
      const resp = await locationToolService.moveLocations(locationIds, targetStatus, { commonDetails, perItemDetails });
      const data = resp?.data || resp;
      const movedCount = data?.movedCount || locationIds.length;
      const dupCount = data?.duplicateCount || 0;
      let msg = `${movedCount} location(s) copied to ${targetStatus}`;
      if (dupCount > 0) msg += ` (${dupCount} already there, skipped)`;
      toast.success(msg);
      return { success: true };
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Failed to move locations';
      if (status === 409) {
        toast.warn(message);
      } else {
        toast.error(message);
      }
      return null;
    }
  }, []);

  const moveFolder = useCallback(async (folderField, folderValue, currentStatus, targetStatus, { commonDetails, perItemDetails } = {}) => {
    try {
      const resp = await locationToolService.moveFolder(folderField, folderValue, currentStatus, targetStatus, { commonDetails, perItemDetails });
      const data = resp?.data || resp;
      const movedCount = data?.movedCount || 0;
      const dupCount = data?.duplicateCount || 0;
      let msg = `${movedCount} item(s) copied to ${targetStatus}`;
      if (dupCount > 0) msg += ` (${dupCount} skipped)`;
      toast.success(msg);
      return { success: true };
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Failed to move folder';
      if (status === 409) {
        toast.warn(message);
      } else {
        toast.error(message);
      }
      return null;
    }
  }, []);

  const deleteLocation = useCallback(async (id) => {
    try {
      await locationToolService.deleteLocation(id);
      toast.success('Location deleted');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete location');
      return false;
    }
  }, []);

  const restoreLocation = useCallback(async (id) => {
    try {
      await locationToolService.restoreLocation(id);
      toast.success('Location restored');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore location');
      return false;
    }
  }, []);

  const deleteFolder = useCallback(async (folderField, folderValue, status) => {
    try {
      await locationToolService.deleteFolder(folderField, folderValue, status);
      toast.success('Folder deleted');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete folder');
      return false;
    }
  }, []);

  const getLinkPreview = useCallback(async (url) => {
    try {
      const data = await locationToolService.getLinkPreview(url);
      return data.data || null;
    } catch {
      return null;
    }
  }, []);

  const generatePDF = useCallback(async (locationIds, title) => {
    try {
      const blob = await locationToolService.generatePDF(locationIds, title);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `location-report-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate PDF');
      return false;
    }
  }, []);

  const shareLocations = useCallback(async (locationIds, userIds, message) => {
    try {
      await locationToolService.shareLocations(locationIds, userIds, message);
      toast.success('Locations shared successfully');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to share locations');
      return false;
    }
  }, []);

  return {
    units,
    allLocations,
    stats,
    badgeMap,
    deletedLocations,
    unitChats,
    loading,
    error,
    fetchUnits,
    fetchAllLocations,
    fetchBadges,
    markFolderViewed,
    fetchStats,
    fetchDeletedLocations,
    fetchUnitChats,
    sendUnitChat,
    createLocation,
    updateLocation,
    moveLocations,
    moveFolder,
    deleteLocation,
    restoreLocation,
    deleteFolder,
    getLinkPreview,
    generatePDF,
    shareLocations,
    joinProject,
    setRefreshCallback,
  };
};

export default useLocationTool;
