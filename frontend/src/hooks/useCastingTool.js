import { useState, useCallback, useEffect, useRef } from 'react';
import castingToolService from '../services/castingToolService';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import { CASTING_API_BASE_URL } from '../config/constants';

const SOCKET_URL = CASTING_API_BASE_URL.replace('/api/v2/casting', '');

const useCastingTool = (toolType = 'main') => {
  const [units, setUnits] = useState([]);
  // All castings for the active tab — fetched once, grouped client-side
  const [allCastings, setAllCastings] = useState([]);
  const [stats, setStats] = useState({
    stats: {},
    badges: {},
    unitChats: {},
  });
  // Badge counts per folder key for the active tab
  const [badgeMap, setBadgeMap] = useState({});
  const [deletedCastings, setDeletedCastings] = useState([]);
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
        console.log('Casting socket connected');
      });

      // Real-time event handlers — trigger debounced refresh
      const events = [
        'casting_created', 'castings_moved', 'casting_deleted',
        'casting_comment', 'casting_unit_chat_message',
      ];
      events.forEach((evt) => {
        socket.on(evt, () => debouncedRefresh());
      });

      socket.on('castings_shared', (data) => {
        toast.info(`${data.sharedBy?.name || 'Someone'} shared castings with you`);
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
      const data = await castingToolService.getUnits();
      const result = data.data || data || [];
      setUnits(Array.isArray(result) ? result : []);
      return Array.isArray(result) ? result : [];
    } catch {
      setUnits([]);
      return [];
    }
  }, []);

  // ── Fetch ALL castings for a tab (single API call) ──
  const fetchAllCastings = useCallback(async (status) => {
    setLoading(true);
    setError(null);
    try {
      const data = await castingToolService.getCastings({ status, toolType, limit: 0 });
      const result = data.data || {};
      const castings = result.castings || [];
      setAllCastings(castings);
      return castings;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch castings';
      setError(msg);
      toast.error(msg);
      setAllCastings([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch badges for a tab ──
  const fetchBadges = useCallback(async (status) => {
    try {
      const data = await castingToolService.getBadges(status, toolType);
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
      await castingToolService.markViewed(folderKey);
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
      const data = await castingToolService.getStats(toolType);
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
  const fetchDeletedCastings = useCallback(async () => {
    try {
      const data = await castingToolService.getDeletedCastings(toolType);
      setDeletedCastings(data.data || []);
    } catch {
      setDeletedCastings([]);
    }
  }, []);

  // ── Unit Chat ──
  const fetchUnitChats = useCallback(async (unit) => {
    try {
      const data = await castingToolService.getUnitChats(unit);
      setUnitChats(data.data || []);
    } catch {
      setUnitChats([]);
    }
  }, []);

  const sendUnitChat = useCallback(async (unit, text, files = []) => {
    try {
      const data = await castingToolService.createUnitChat(unit, text, files);
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      return null;
    }
  }, []);

  // ── CRUD ──
  const createCasting = useCallback(async (formData) => {
    try {
      formData.append('toolType', toolType);
      const data = await castingToolService.createCasting(formData);
      toast.success('Casting created successfully');
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create casting');
      return null;
    }
  }, [toolType]);

  const updateCasting = useCallback(async (id, formData) => {
    try {
      const data = await castingToolService.updateCasting(id, formData);
      toast.success('Casting updated successfully');
      return data.data || data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update casting');
      return null;
    }
  }, []);

  const moveCastings = useCallback(async (castingIds, targetStatus, { commonDetails, perItemDetails } = {}) => {
    try {
      const resp = await castingToolService.moveCastings(castingIds, targetStatus, { commonDetails, perItemDetails, toolType });
      const data = resp?.data || resp;
      const movedCount = data?.movedCount || castingIds.length;
      const dupCount = data?.duplicateCount || 0;
      let msg = `${movedCount} casting(s) copied to ${targetStatus}`;
      if (dupCount > 0) msg += ` (${dupCount} already there, skipped)`;
      toast.success(msg);
      return { success: true };
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Failed to move castings';
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
      const resp = await castingToolService.moveFolder(folderField, folderValue, currentStatus, targetStatus, { commonDetails, perItemDetails, toolType });
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

  const deleteCasting = useCallback(async (id) => {
    try {
      await castingToolService.deleteCasting(id);
      toast.success('Casting deleted');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete casting');
      return false;
    }
  }, []);

  const restoreCasting = useCallback(async (id) => {
    try {
      await castingToolService.restoreCasting(id);
      toast.success('Casting restored');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore casting');
      return false;
    }
  }, []);

  const deleteFolder = useCallback(async (folderField, folderValue, status) => {
    try {
      await castingToolService.deleteFolder(folderField, folderValue, status, toolType);
      toast.success('Folder deleted');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete folder');
      return false;
    }
  }, []);

  const getLinkPreview = useCallback(async (url) => {
    try {
      const data = await castingToolService.getLinkPreview(url);
      return data.data || null;
    } catch {
      return null;
    }
  }, []);

  const generatePDF = useCallback(async (castingIds, title) => {
    try {
      const blob = await castingToolService.generatePDF(castingIds, title);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `casting-report-${Date.now()}.pdf`;
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

  const shareCastings = useCallback(async (castingIds, userIds, message) => {
    try {
      await castingToolService.shareCastings(castingIds, userIds, message);
      toast.success('Castings shared successfully');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to share castings');
      return false;
    }
  }, []);

  return {
    units,
    allCastings,
    stats,
    badgeMap,
    deletedCastings,
    unitChats,
    loading,
    error,
    fetchUnits,
    fetchAllCastings,
    fetchBadges,
    markFolderViewed,
    fetchStats,
    fetchDeletedCastings,
    fetchUnitChats,
    sendUnitChat,
    createCasting,
    updateCasting,
    moveCastings,
    moveFolder,
    deleteCasting,
    restoreCasting,
    deleteFolder,
    getLinkPreview,
    generatePDF,
    shareCastings,
    joinProject,
    setRefreshCallback,
  };
};

export default useCastingTool;
