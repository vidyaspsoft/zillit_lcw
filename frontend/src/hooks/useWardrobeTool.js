import { useState, useCallback, useEffect, useRef } from 'react';
import wardrobeToolService from '../services/wardrobeToolService';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import { WARDROBE_API_BASE_URL } from '../config/constants';

const SOCKET_URL = WARDROBE_API_BASE_URL.replace('/api/v2/wardrobe', '');

const useWardrobeTool = (toolType = 'main') => {
  const [units, setUnits] = useState([]);
  // All wardrobes for the active tab -- fetched once, grouped client-side
  const [allWardrobes, setAllWardrobes] = useState([]);
  const [stats, setStats] = useState({
    stats: {},
    badges: {},
    unitChats: {},
  });
  // Badge counts per folder key for the active tab
  const [badgeMap, setBadgeMap] = useState({});
  const [deletedWardrobes, setDeletedWardrobes] = useState([]);
  const [unitChats, setUnitChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const refreshCallbackRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // Debounced refresh -- prevents rapid-fire re-fetches from socket events
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
        console.log('Wardrobe socket connected');
      });

      // Real-time event handlers -- trigger debounced refresh
      const events = [
        'wardrobe_created', 'wardrobes_moved', 'wardrobe_deleted',
        'wardrobe_comment', 'wardrobe_unit_chat_message',
      ];
      events.forEach((evt) => {
        socket.on(evt, () => debouncedRefresh());
      });

      socket.on('wardrobes_shared', (data) => {
        toast.info(`${data.sharedBy?.name || 'Someone'} shared costumes with you`);
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
      const data = await wardrobeToolService.getUnits();
      const result = data.data || data || [];
      setUnits(Array.isArray(result) ? result : []);
      return Array.isArray(result) ? result : [];
    } catch {
      setUnits([]);
      return [];
    }
  }, []);

  // ── Fetch ALL wardrobes for a tab (single API call) ──
  const fetchAllWardrobes = useCallback(async (status) => {
    setLoading(true);
    setError(null);
    try {
      const data = await wardrobeToolService.getWardrobes({ status, toolType, limit: 0 });
      const result = data.data || {};
      const wardrobes = result.wardrobes || [];
      setAllWardrobes(wardrobes);
      return wardrobes;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch wardrobes';
      setError(msg);
      toast.error(msg);
      setAllWardrobes([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch badges for a tab ──
  const fetchBadges = useCallback(async (status) => {
    try {
      const data = await wardrobeToolService.getBadges(status, toolType);
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
      await wardrobeToolService.markViewed(folderKey);
      // Update local badge map -- set this key to 0
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
      const data = await wardrobeToolService.getStats(toolType);
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
  const fetchDeletedWardrobes = useCallback(async () => {
    try {
      const data = await wardrobeToolService.getDeletedWardrobes(toolType);
      setDeletedWardrobes(data.data || []);
    } catch {
      setDeletedWardrobes([]);
    }
  }, []);

  // ── Unit Chat ──
  const fetchUnitChats = useCallback(async (unit) => {
    try {
      const data = await wardrobeToolService.getUnitChats(unit);
      setUnitChats(data.data || []);
    } catch {
      setUnitChats([]);
    }
  }, []);

  const sendUnitChat = useCallback(async (unit, text, files = []) => {
    try {
      const data = await wardrobeToolService.createUnitChat(unit, text, files);
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      return null;
    }
  }, []);

  // ── CRUD ──
  const createWardrobe = useCallback(async (formData) => {
    try {
      formData.append('toolType', toolType);
      const data = await wardrobeToolService.createWardrobe(formData);
      toast.success('Costume created successfully');
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create wardrobe');
      return null;
    }
  }, [toolType]);

  const updateWardrobe = useCallback(async (id, formData) => {
    try {
      const data = await wardrobeToolService.updateWardrobe(id, formData);
      toast.success('Costume updated successfully');
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update wardrobe');
      return null;
    }
  }, []);

  const moveWardrobes = useCallback(async (wardrobeIds, targetStatus, { commonDetails, perItemDetails } = {}) => {
    try {
      const resp = await wardrobeToolService.moveWardrobes(wardrobeIds, targetStatus, { commonDetails, perItemDetails, toolType });
      const data = resp?.data || resp;
      const movedCount = data?.movedCount || wardrobeIds.length;
      const dupCount = data?.duplicateCount || 0;
      let msg = `${movedCount} costume(s) copied to ${targetStatus}`;
      if (dupCount > 0) msg += ` (${dupCount} already there, skipped)`;
      toast.success(msg);
      return { success: true };
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Failed to move wardrobes';
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
      const resp = await wardrobeToolService.moveFolder(folderField, folderValue, currentStatus, targetStatus, { commonDetails, perItemDetails });
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

  const deleteWardrobe = useCallback(async (id) => {
    try {
      await wardrobeToolService.deleteWardrobe(id);
      toast.success('Costume deleted');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete wardrobe');
      return false;
    }
  }, []);

  const restoreWardrobe = useCallback(async (id) => {
    try {
      await wardrobeToolService.restoreWardrobe(id);
      toast.success('Costume restored');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore wardrobe');
      return false;
    }
  }, []);

  const deleteFolder = useCallback(async (folderField, folderValue, status) => {
    try {
      await wardrobeToolService.deleteFolder(folderField, folderValue, status, toolType);
      toast.success('Folder deleted');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete folder');
      return false;
    }
  }, []);

  const getLinkPreview = useCallback(async (url) => {
    try {
      const data = await wardrobeToolService.getLinkPreview(url);
      return data.data || null;
    } catch {
      return null;
    }
  }, []);

  const generatePDF = useCallback(async (wardrobeIds, title) => {
    try {
      const blob = await wardrobeToolService.generatePDF(wardrobeIds, title);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `wardrobe-report-${Date.now()}.pdf`;
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

  const shareWardrobes = useCallback(async (wardrobeIds, userIds, message) => {
    try {
      await wardrobeToolService.shareWardrobes(wardrobeIds, userIds, message);
      toast.success('Costumes shared successfully');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to share wardrobes');
      return false;
    }
  }, []);

  return {
    units,
    allWardrobes,
    stats,
    badgeMap,
    deletedWardrobes,
    unitChats,
    loading,
    error,
    fetchUnits,
    fetchAllWardrobes,
    fetchBadges,
    markFolderViewed,
    fetchStats,
    fetchDeletedWardrobes,
    fetchUnitChats,
    sendUnitChat,
    createWardrobe,
    updateWardrobe,
    moveWardrobes,
    moveFolder,
    deleteWardrobe,
    restoreWardrobe,
    deleteFolder,
    getLinkPreview,
    generatePDF,
    shareWardrobes,
    joinProject,
    setRefreshCallback,
  };
};

export default useWardrobeTool;
