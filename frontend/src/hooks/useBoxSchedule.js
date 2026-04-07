import { useState, useCallback, useEffect, useRef } from 'react';
import boxScheduleService from '../services/boxScheduleService';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import { BOX_SCHEDULE_API_BASE_URL } from '../config/constants';

const SOCKET_URL = BOX_SCHEDULE_API_BASE_URL.replace('/api/v2/box-schedule', '');

const useBoxSchedule = () => {
  const [scheduleTypes, setScheduleTypes] = useState([]);
  const [scheduleDays, setScheduleDays] = useState([]);
  const [events, setEvents] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const refreshCallbackRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      if (refreshCallbackRef.current) refreshCallbackRef.current();
    }, 500);
  }, []);

  useEffect(() => {
    try {
      const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      socketRef.current = socket;
      socket.on('connect', () => console.log('Box Schedule socket connected'));
      const socketEvents = [
        'box_schedule_day_added', 'box_schedule_day_updated', 'box_schedule_day_deleted',
        'box_schedule_event_added', 'box_schedule_event_updated', 'box_schedule_event_deleted',
      ];
      socketEvents.forEach((evt) => { socket.on(evt, () => debouncedRefresh()); });
      return () => { socket.disconnect(); if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
    } catch {}
  }, [debouncedRefresh]);

  const setRefreshCallback = useCallback((cb) => { refreshCallbackRef.current = cb; }, []);
  const joinProject = useCallback((projectId) => { if (socketRef.current) socketRef.current.emit('join_project', projectId); }, []);

  // ── Types ──
  const fetchTypes = useCallback(async () => {
    try {
      const data = await boxScheduleService.getTypes();
      const result = data.data || [];
      setScheduleTypes(Array.isArray(result) ? result : []);
      return Array.isArray(result) ? result : [];
    } catch { setScheduleTypes([]); return []; }
  }, []);

  const createType = useCallback(async ({ title, color }) => {
    try {
      const data = await boxScheduleService.createType({ title, color });
      toast.success('Schedule type created');
      await fetchTypes();
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create type'); throw err; }
  }, [fetchTypes]);

  const updateType = useCallback(async (id, updates) => {
    try {
      const data = await boxScheduleService.updateType(id, updates);
      toast.success('Schedule type updated');
      await fetchTypes();
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update type'); throw err; }
  }, [fetchTypes]);

  const deleteType = useCallback(async (id) => {
    try { await boxScheduleService.deleteType(id); toast.success('Schedule type deleted'); await fetchTypes(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to delete type'); throw err; }
  }, [fetchTypes]);

  // ── Days ──
  const fetchDays = useCallback(async (params = {}) => {
    setLoading(true); setError(null);
    try {
      const data = await boxScheduleService.getDays(params);
      const result = data.data || [];
      setScheduleDays(Array.isArray(result) ? result : []);
      return Array.isArray(result) ? result : [];
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch schedule';
      setError(msg); toast.error(msg); setScheduleDays([]); return [];
    } finally { setLoading(false); }
  }, []);

  const createDay = useCallback(async (dayData) => {
    try {
      const data = await boxScheduleService.createDay(dayData);
      toast.success('Schedule created');
      return data;
    } catch (err) {
      if (err.response?.status === 409) throw err;
      toast.error(err.response?.data?.message || 'Failed to create schedule'); throw err;
    }
  }, []);

  const updateDay = useCallback(async (id, dayData) => {
    try { const data = await boxScheduleService.updateDay(id, dayData); toast.success('Schedule updated'); return data.data; }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to update schedule'); throw err; }
  }, []);

  const deleteDay = useCallback(async (id) => {
    try { await boxScheduleService.deleteDay(id); toast.success('Schedule deleted'); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to delete schedule'); throw err; }
  }, []);

  const bulkUpdateDays = useCallback(async (updates) => {
    try { const data = await boxScheduleService.bulkUpdateDays(updates); toast.success('Schedule updated'); return data.data; }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to update schedule'); throw err; }
  }, []);

  // ── Events ──
  const fetchEvents = useCallback(async (params = {}) => {
    try {
      const data = await boxScheduleService.getEvents(params);
      const result = data.data || [];
      setEvents(Array.isArray(result) ? result : []);
      return Array.isArray(result) ? result : [];
    } catch { setEvents([]); return []; }
  }, []);

  const createEvent = useCallback(async (eventData) => {
    try { const data = await boxScheduleService.createEvent(eventData); toast.success(eventData.eventType === 'event' ? 'Event created' : 'Note created'); return data.data; }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to create event'); throw err; }
  }, []);

  const updateEvent = useCallback(async (id, eventData) => {
    try { const data = await boxScheduleService.updateEvent(id, eventData); toast.success('Event updated'); return data.data; }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to update event'); throw err; }
  }, []);

  const deleteEvent = useCallback(async (id) => {
    try { await boxScheduleService.deleteEvent(id); toast.success('Event deleted'); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to delete event'); throw err; }
  }, []);

  // ── Calendar ──
  const fetchCalendar = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const data = await boxScheduleService.getCalendar(params);
      const result = data.data || [];
      setCalendarData(Array.isArray(result) ? result : []);
      return Array.isArray(result) ? result : [];
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to fetch calendar'); setCalendarData([]); return []; }
    finally { setLoading(false); }
  }, []);

  return {
    scheduleTypes, scheduleDays, events, calendarData, loading, error,
    fetchTypes, createType, updateType, deleteType,
    fetchDays, createDay, updateDay, deleteDay, bulkUpdateDays,
    fetchEvents, createEvent, updateEvent, deleteEvent,
    fetchCalendar,
    joinProject, setRefreshCallback,
  };
};

export default useBoxSchedule;
