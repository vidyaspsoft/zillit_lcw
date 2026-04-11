import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spin, Segmented, Modal, Input, Select, Popover } from 'antd';
import { FiArrowLeft, FiPlus, FiSettings, FiPrinter, FiCheckSquare, FiTrash2, FiX, FiCalendar, FiEdit2, FiClock, FiShare2, FiSearch, FiList, FiGrid } from 'react-icons/fi';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import useBoxSchedule from '../../hooks/useBoxSchedule';
import boxScheduleService from '../../services/boxScheduleService';
import ScheduleLegend from './ScheduleLegend';
import ScheduleTable from './ScheduleTable';
import CalendarView from './CalendarView';
import CreateScheduleModal from './CreateScheduleModal';
import ConflictDialog from './ConflictDialog';
import ScheduleTypeManager from './ScheduleTypeManager';
import CreateEventModal from './CreateEventModal';
import PrintableSchedule from './PrintableSchedule';
import ActivityLogDrawer from './ActivityLogDrawer';
import ViewEventDrawer from './ViewEventDrawer';
import ShareScheduleModal from './ShareScheduleModal';
import './boxSchedulePrint.css';

const BoxSchedulePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    scheduleTypes, scheduleDays, calendarData, loading,
    fetchTypes, fetchDays, fetchCalendar,
    createDay, updateDay, deleteDay,
    createType, updateType, deleteType,
    createEvent, updateEvent, deleteEvent, fetchEvents,
    joinProject, setRefreshCallback,
  } = useBoxSchedule();

  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('boxScheduleDefaultView') || 'Calendar View';
  });
  const [savedDefaultView, setSavedDefaultView] = useState(() => {
    return localStorage.getItem('boxScheduleDefaultView') || 'Calendar View';
  });
  const [showDefaultViewPopover, setShowDefaultViewPopover] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [expandedDayId, setExpandedDayId] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  const [pendingDayData, setPendingDayData] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showGlobalEventModal, setShowGlobalEventModal] = useState(false);
  const [globalEventTab, setGlobalEventTab] = useState('Event');

  // Standalone events (not linked to any schedule day)
  const [standaloneEvents, setStandaloneEvents] = useState([]);

  // Search & Filter
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');

  // New feature drawers/modals
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentRevision, setCurrentRevision] = useState(null);

  // Multi-select
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadStandaloneEvents = useCallback(async () => {
    try {
      const result = await fetchEvents({});
      const all = Array.isArray(result) ? result : result?.data || [];
      setStandaloneEvents(all.filter((e) => !e.scheduleDayId));
    } catch { setStandaloneEvents([]); }
  }, [fetchEvents]);

  useEffect(() => {
    fetchTypes(); fetchDays(); loadStandaloneEvents();
    if (user?.projectId) joinProject(user.projectId);
    boxScheduleService.getCurrentRevision().then((data) => {
      setCurrentRevision(data.data || null);
    }).catch(() => {});
  }, [fetchTypes, fetchDays, loadStandaloneEvents, joinProject, user?.projectId]);

  // Unified refresh — call this after any CRUD to update whichever view is active
  const refreshAll = useCallback(() => {
    fetchDays();
    loadStandaloneEvents();
    fetchCalendar();
  }, [fetchDays, loadStandaloneEvents, fetchCalendar]);

  // Expose refresh functions globally for CreateScheduleModal
  useEffect(() => {
    window.__boxScheduleRefreshTypes = fetchTypes;
    window.__boxScheduleRefreshDays = refreshAll;
    return () => { delete window.__boxScheduleRefreshTypes; delete window.__boxScheduleRefreshDays; };
  }, [fetchTypes, refreshAll]);

  useEffect(() => {
    setRefreshCallback(() => { fetchTypes(); refreshAll(); });
  }, [fetchTypes, refreshAll, setRefreshCallback]);

  useEffect(() => {
    if (activeView === 'Calendar View') fetchCalendar();
  }, [activeView, fetchCalendar]);

  const flatSchedule = useMemo(() => {
    const typeCounters = {};
    const allDays = [];
    scheduleDays.forEach((day) => {
      [...(day.calendarDays || [])].sort((a, b) => a - b).forEach((cd) => allDays.push({ ...day, singleDate: cd }));
    });
    allDays.sort((a, b) => a.singleDate - b.singleDate);
    let prevTypeName = null;
    return allDays.map((day) => {
      if (!typeCounters[day.typeName]) typeCounters[day.typeName] = 0;
      typeCounters[day.typeName]++;
      const isNewBlock = prevTypeName !== null && prevTypeName !== day.typeName;
      prevTypeName = day.typeName;
      return { ...day, dayNumber: typeCounters[day.typeName], isNewBlock };
    });
  }, [scheduleDays]);

  // Apply search & filter
  const filteredSchedule = useMemo(() => {
    let rows = flatSchedule;
    if (filterType) {
      rows = rows.filter((r) => r.typeName === filterType);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      rows = rows.filter((r) =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.typeName || '').toLowerCase().includes(q) ||
        dayjs(r.singleDate).format('ddd MMM DD YYYY').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [flatSchedule, searchText, filterType]);

  const allRowKeys = useMemo(() => filteredSchedule.map((r) => `${r._id}-${r.singleDate}`), [filteredSchedule]);

  // ── Schedule CRUD ──
  const handleCreateSchedule = useCallback(async (dayData) => {
    try {
      const result = await createDay(dayData);
      setShowCreateModal(false); setPendingDayData(null); refreshAll();
      return result;
    } catch (err) {
      if (err.response?.status === 409) { setConflictData(err.response.data.data); setPendingDayData(dayData); setShowCreateModal(false); }
      throw err;
    }
  }, [createDay, refreshAll]);

  const handleConflictResolve = useCallback(async (action) => {
    if (!pendingDayData) return;
    try { await createDay({ ...pendingDayData, conflictAction: action }); setConflictData(null); setPendingDayData(null); refreshAll(); } catch {}
  }, [pendingDayData, createDay, refreshAll]);

  const handleDeleteDay = useCallback((id, singleDate) => { setDeleteConfirm({ id, singleDate }); }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { id, singleDate } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      const block = scheduleDays.find((d) => String(d._id) === String(id));
      if ((block?.calendarDays?.length || 0) <= 1 || !singleDate) { await deleteDay(id); }
      else {
        try { await boxScheduleService.removeDates([{ id, dates: [Number(singleDate)] }]); toast.success('Day removed'); }
        catch { await deleteDay(id); }
      }
      setExpandedDayId(null); refreshAll();
    } catch { toast.error('Failed to delete'); }
  }, [deleteConfirm, scheduleDays, deleteDay, refreshAll]);

  const handleEditDay = useCallback(async (id, data) => {
    try { await updateDay(id, data); refreshAll(); } catch {}
  }, [updateDay, refreshAll]);

  const handleEditSchedule = useCallback((day) => { setEditingDay(day); setShowCreateModal(true); }, []);

  // View / Edit standalone event
  const [viewingEvent, setViewingEvent] = useState(null);
  const [editingStandaloneEvent, setEditingStandaloneEvent] = useState(null);
  const [quickCreateDate, setQuickCreateDate] = useState(null); // date from calendar quick action
  const handleEditStandaloneEvent = useCallback((evt) => {
    setEditingStandaloneEvent(evt);
    setGlobalEventTab(evt.eventType === 'note' ? 'Note' : 'Event');
    setShowGlobalEventModal(true);
  }, []);

  const toggleDayExpand = useCallback((dayId, singleDate) => {
    if (isSelectMode) return;
    const key = `${dayId}-${singleDate}`;
    setExpandedDayId((prev) => (prev === key ? null : key));
  }, [isSelectMode]);

  // ── Select Mode ──
  const enterSelectMode = () => { setIsSelectMode(true); setSelectedRowKeys([]); setExpandedDayId(null); };
  const exitSelectMode = () => { setIsSelectMode(false); setSelectedRowKeys([]); };

  const toggleSelectRow = useCallback((rowKey) => {
    setSelectedRowKeys((prev) => prev.includes(rowKey) ? prev.filter((k) => k !== rowKey) : [...prev, rowKey]);
  }, []);

  const selectAll = useCallback(() => { setSelectedRowKeys([...allRowKeys]); }, [allRowKeys]);
  const deselectAll = useCallback(() => { setSelectedRowKeys([]); }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedRowKeys.length} day(s)?`);
    if (!confirmed) return;

    const idToDateMap = {};
    selectedRowKeys.forEach((rowKey) => {
      const row = flatSchedule.find((r) => `${r._id}-${r.singleDate}` === rowKey);
      if (!row) return;
      if (!idToDateMap[row._id]) idToDateMap[row._id] = [];
      idToDateMap[row._id].push(row.singleDate);
    });
    const entries = Object.entries(idToDateMap).map(([id, dates]) => ({ id, dates }));

    setBulkDeleting(true);
    try {
      await boxScheduleService.removeDates(entries);
      toast.success(`${selectedRowKeys.length} day(s) deleted`);
      setSelectedRowKeys([]); setIsSelectMode(false); refreshAll();
    } catch {
      try { for (const e of entries) await deleteDay(e.id); toast.success('Schedules deleted'); setSelectedRowKeys([]); setIsSelectMode(false); refreshAll(); }
      catch { toast.error('Failed to delete'); }
    } finally { setBulkDeleting(false); }
  }, [selectedRowKeys, flatSchedule, refreshAll, deleteDay]);

  const selectedRows = useMemo(() => {
    if (selectedRowKeys.length === 0) return [];
    return flatSchedule.filter((r) => selectedRowKeys.includes(`${r._id}-${r.singleDate}`));
  }, [flatSchedule, selectedRowKeys]);

  const handlePrintSelected = useCallback(() => {
    if (selectedRowKeys.length === 0) return;
    setIsPrintMode(true);
  }, [selectedRowKeys]);

  // ── Print ──
  const injectPrintOrientation = useCallback((orientation) => {
    const existing = document.getElementById('box-schedule-print-orientation');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = 'box-schedule-print-orientation';
    style.textContent = `@media print { @page { size: A4 ${orientation}; } }`;
    document.head.appendChild(style);
  }, []);

  const cleanupPrintOrientation = useCallback(() => {
    const existing = document.getElementById('box-schedule-print-orientation');
    if (existing) existing.remove();
  }, []);

  const handlePrint = useCallback(() => {
    injectPrintOrientation(activeView === 'Calendar View' ? 'landscape' : 'portrait');
    if (activeView === 'List View') { setIsPrintMode(true); }
    else { window.print(); cleanupPrintOrientation(); }
  }, [activeView, injectPrintOrientation, cleanupPrintOrientation]);

  const handlePrintReady = useCallback(() => {
    setTimeout(() => { window.print(); setIsPrintMode(false); cleanupPrintOrientation(); }, 200);
  }, [cleanupPrintOrientation]);

  const printRows = isSelectMode && selectedRowKeys.length > 0 ? selectedRows : filteredSchedule;

  return (
    <div className="flex flex-col h-[calc(100vh-var(--navbar-height))]" style={{ background: '#f8f7f4' }}>

      {/* ══════════ SCREEN HEADER ══════════ */}
      <div className="box-schedule-no-print">
        <div style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #fafaf8 100%)',
          borderBottom: '1px solid #e0ddd8', padding: '18px 28px 14px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-1.5 transition-all duration-200"
              style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#333'} onMouseLeave={(e) => e.currentTarget.style.color = '#888'}>
              <FiArrowLeft size={14} /> Back to Tools
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              {activeView === 'List View' && !isSelectMode && filteredSchedule.length > 0 && (
                <Button icon={<FiCheckSquare size={13} />} onClick={enterSelectMode} size="middle"
                  style={toolbarBtnStyle}>Select</Button>
              )}
              <Button icon={<FiClock size={13} />} onClick={() => setShowActivityLog(true)} size="middle"
                style={toolbarBtnStyle}>History</Button>
              <Button icon={<FiShare2 size={13} />} onClick={() => setShowShareModal(true)} size="middle"
                style={toolbarBtnStyle}>Share</Button>
              <Button icon={<FiSettings size={13} />} onClick={() => setShowTypeManager(true)} size="middle"
                style={toolbarBtnStyle}>Edit Types</Button>
              <Button icon={<FiPrinter size={13} />} onClick={handlePrint} loading={isPrintMode && !isSelectMode} size="middle"
                style={toolbarBtnStyle}>
                {isPrintMode && !isSelectMode ? 'Preparing...' : 'Print'}
              </Button>
              <Button icon={<FiCalendar size={13} />}
                onClick={() => { setGlobalEventTab('Event'); setShowGlobalEventModal(true); }} size="middle"
                style={toolbarBtnStyle}>
                Create Event
              </Button>
              <Button icon={<FiEdit2 size={13} />}
                onClick={() => { setGlobalEventTab('Note'); setShowGlobalEventModal(true); }} size="middle"
                style={toolbarBtnStyle}>
                Create Note
              </Button>
              <Button type="primary" icon={<FiPlus size={14} />}
                onClick={() => { setEditingDay(null); setShowCreateModal(true); }} size="middle"
                style={{ background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: '600', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                Create Schedule
              </Button>
            </div>
          </div>
          <div className="text-center" style={{ padding: '4px 0 2px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 3px 0', color: '#1a1a1a', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
              Production Schedule
            </h1>
            <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>
              Prepared: {dayjs().format('MMMM D, YYYY')}
            </p>
          </div>
        </div>

        {/* Selection bar */}
        {isSelectMode && (
          <div style={{ padding: '10px 28px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="flex items-center gap-3">
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{selectedRowKeys.length} of {allRowKeys.length} selected</span>
              <Button size="small" type="link" onClick={selectedRowKeys.length === allRowKeys.length ? deselectAll : selectAll}
                style={{ color: '#aaa', fontSize: '12px', padding: '0 4px' }}>
                {selectedRowKeys.length === allRowKeys.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="small" icon={<FiPrinter size={12} />} onClick={handlePrintSelected} loading={isPrintMode}
                disabled={selectedRowKeys.length === 0}
                style={{ borderColor: '#555', color: '#fff', background: 'transparent', borderRadius: '6px', fontSize: '12px' }}>
                {isPrintMode ? 'Preparing...' : 'Print Selected'}
              </Button>
              <Button size="small" icon={<FiTrash2 size={12} />} onClick={handleBulkDelete} loading={bulkDeleting}
                disabled={selectedRowKeys.length === 0}
                style={{ borderRadius: '6px', fontSize: '12px', background: '#e74c3c', borderColor: '#e74c3c', color: '#fff' }}>
                Delete Selected
              </Button>
              <Button size="small" icon={<FiX size={12} />} onClick={exitSelectMode}
                style={{ borderColor: '#555', color: '#fff', background: 'transparent', borderRadius: '6px', fontSize: '12px' }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* View Switcher + Search/Filter */}
        {!isSelectMode && (
          <div style={{ borderBottom: '1px solid #e0ddd8', padding: '10px 28px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div className="flex items-center gap-3 flex-wrap">
              <Segmented options={['Calendar View', 'List View']} value={activeView} onChange={(val) => { setActiveView(val); }}
                style={{ background: '#f0efec', borderRadius: '8px', padding: '2px' }} />
              <Popover
                open={showDefaultViewPopover}
                onOpenChange={setShowDefaultViewPopover}
                trigger="click"
                placement="bottomLeft"
                content={
                  <div style={{ width: '240px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginBottom: '10px' }}>
                      Choose your default view
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px', lineHeight: '1.4' }}>
                      This view will load first every time you open the Production Schedule.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {['Calendar View', 'List View'].map((view) => {
                        const isSelected = savedDefaultView === view;
                        return (
                          <button key={view}
                            onClick={() => {
                              localStorage.setItem('boxScheduleDefaultView', view);
                              setSavedDefaultView(view);
                              setShowDefaultViewPopover(false);
                              toast.success(`${view} is now your default view.`);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                              border: isSelected ? '2px solid #1a1a1a' : '1px solid #e0ddd8',
                              background: isSelected ? '#f8f8f4' : '#fff',
                              transition: 'all 0.15s', textAlign: 'left', width: '100%',
                            }}
                          >
                            <span style={{
                              width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                              border: isSelected ? '5px solid #1a1a1a' : '2px solid #ccc',
                              background: '#fff',
                            }} />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>
                                {view === 'Calendar View' ? 'Calendar View' : 'List View'}
                              </div>
                              <div style={{ fontSize: '10px', color: '#999' }}>
                                {view === 'Calendar View' ? 'Monthly calendar grid' : 'Table with expandable rows'}
                              </div>
                            </div>
                            {isSelected && (
                              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#27ae60', fontWeight: '600' }}>Current</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                }
              >
                <Button size="middle" icon={<FiGrid size={13} />}
                  style={{ borderColor: '#d0ccc5', color: '#555', borderRadius: '6px', fontSize: '13px' }}>
                  Set Default View
                </Button>
              </Popover>
              {activeView === 'List View' && (
                <>
                  <Input placeholder="Search by title, type, date..." prefix={<FiSearch size={13} style={{ color: '#bbb' }} />}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear
                    style={{ width: '180px', borderRadius: '6px' }} size="middle" />
                  <Select value={filterType || undefined} onChange={(v) => setFilterType(v || '')} allowClear
                    placeholder="All Types" style={{ width: '130px' }} size="middle"
                    options={[{ value: '', label: 'All Types' }, ...scheduleTypes.map((t) => ({ value: t.title, label: t.title }))]} />
                </>
              )}
            </div>
            <ScheduleLegend types={scheduleTypes} />
          </div>
        )}
      </div>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <div className="flex-1 overflow-y-auto box-schedule-content">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
        ) : (
          <>
            {activeView === 'List View' && (
              <div className="box-schedule-screen-only">
                <ScheduleTable rows={filteredSchedule} expandedDayId={expandedDayId} onToggleExpand={toggleDayExpand}
                  onDeleteDay={handleDeleteDay} onEditDay={handleEditDay} onEditSchedule={handleEditSchedule}
                  fetchEvents={fetchEvents} createEvent={createEvent} updateEvent={updateEvent} deleteEvent={deleteEvent}
                  scheduleTypes={scheduleTypes} isSelectMode={isSelectMode} selectedRowKeys={selectedRowKeys}
                  onToggleSelect={toggleSelectRow} onSelectAll={selectAll} onDeselectAll={deselectAll}
                  standaloneEvents={standaloneEvents} onDeleteEvent={async (id) => { await deleteEvent(id); loadStandaloneEvents(); }}
                  onEditStandaloneEvent={handleEditStandaloneEvent}
                  onViewEvent={(evt) => setViewingEvent(evt)}
                  scheduleDays={scheduleDays}
                  onEditFullBlock={(block) => { setEditingDay(block); setShowCreateModal(true); }}
                  onDeleteFullBlock={async (blockId) => { await deleteDay(blockId); refreshAll(); }}
 />
              </div>
            )}
            {activeView === 'Calendar View' && (
              <div className="box-schedule-print-view" style={{ height: '100%' }}>
                <CalendarView calendarData={calendarData} scheduleTypes={scheduleTypes} onRefresh={fetchCalendar}
                  fetchEvents={fetchEvents} createEvent={createEvent} updateEvent={updateEvent} deleteEvent={deleteEvent}
                  onDeleteDay={handleDeleteDay} onEditDay={handleEditDay} onEditSchedule={handleEditSchedule}
                  standaloneEvents={standaloneEvents} onEditStandaloneEvent={handleEditStandaloneEvent}
                  onQuickCreateSchedule={(dateVal) => {
                    setEditingDay({ startDate: dateVal, calendarDays: [dateVal], numberOfDays: 1, _lockedStartDate: true });
                    setShowCreateModal(true);
                  }}
                  onQuickCreateEvent={(dateVal) => {
                    setEditingStandaloneEvent(null);
                    setQuickCreateDate(dateVal);
                    setGlobalEventTab('Event');
                    setShowGlobalEventModal(true);
                  }}
                  onQuickCreateNote={(dateVal) => {
                    setEditingStandaloneEvent(null);
                    setQuickCreateDate(dateVal);
                    setGlobalEventTab('Note');
                    setShowGlobalEventModal(true);
                  }} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════ PRINTABLE VIEW ══════════ */}
      <div className="printable-schedule-wrapper">
        {isPrintMode && (
          <PrintableSchedule rows={printRows} scheduleTypes={scheduleTypes} fetchEvents={fetchEvents} onReady={handlePrintReady} />
        )}
      </div>

      {/* ══════════ MODALS ══════════ */}
      {showCreateModal && (
        <CreateScheduleModal open={showCreateModal} onClose={() => { setShowCreateModal(false); setEditingDay(null); }}
          onSubmit={handleCreateSchedule} scheduleTypes={scheduleTypes} editingDay={editingDay} onEdit={handleEditDay} />
      )}
      {conflictData && (
        <ConflictDialog open={!!conflictData} conflicts={conflictData.conflicts || []}
          totalDays={pendingDayData?.calendarDays?.length || 0}
          onResolve={handleConflictResolve}
          onBack={() => { setConflictData(null); setEditingDay(pendingDayData); setShowCreateModal(true); }}
          onCancel={() => { setConflictData(null); setPendingDayData(null); }} />
      )}
      {showTypeManager && (
        <ScheduleTypeManager open={showTypeManager} onClose={() => setShowTypeManager(false)}
          types={scheduleTypes} onCreateType={createType} onUpdateType={updateType} onDeleteType={deleteType} />
      )}

      {/* Global Create Event Modal */}
      {showGlobalEventModal && (
        <CreateEventModal open={showGlobalEventModal}
          onClose={() => { setShowGlobalEventModal(false); setEditingStandaloneEvent(null); setQuickCreateDate(null); }}
          onSubmit={async (eventData) => {
            if (editingStandaloneEvent) {
              await updateEvent(editingStandaloneEvent._id, eventData);
            } else {
              await createEvent(eventData);
            }
            refreshAll();
            setQuickCreateDate(null);
          }}
          scheduleDays={scheduleDays}
          defaultTab={globalEventTab}
          editingEvent={editingStandaloneEvent}
          date={quickCreateDate} />
      )}

      {/* Delete Confirmation */}
      <Modal open={!!deleteConfirm} onCancel={() => setDeleteConfirm(null)} centered width={400}
        title={<span style={{ fontSize: '16px', fontWeight: '700' }}>Delete Schedule Day</span>}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDeleteConfirm(null)} style={{ borderRadius: '6px' }}>Cancel</Button>
            <Button onClick={confirmDelete} style={{ borderRadius: '6px', background: '#e74c3c', borderColor: '#e74c3c', color: '#fff' }}>Delete</Button>
          </div>
        }>
        <p style={{ fontSize: '14px', color: '#555', margin: '8px 0' }}>Are you sure you want to delete this schedule day? This action cannot be undone.</p>
      </Modal>

      {/* View Event Detail Drawer */}
      <ViewEventDrawer open={!!viewingEvent} onClose={() => setViewingEvent(null)}
        event={viewingEvent} onEdit={handleEditStandaloneEvent} />

      {/* Activity Log Drawer */}
      <ActivityLogDrawer open={showActivityLog} onClose={() => setShowActivityLog(false)} />

      {/* Revision History Drawer */}

      {/* Share Modal */}
      {showShareModal && (
        <ShareScheduleModal open={showShareModal} onClose={() => setShowShareModal(false)}
          scheduleDays={scheduleDays} scheduleTypes={scheduleTypes} />
      )}
    </div>
  );
};

const toolbarBtnStyle = { borderColor: '#d0ccc5', color: '#555', borderRadius: '6px', fontSize: '13px' };

export default BoxSchedulePage;
