import React, { useState, useMemo } from 'react';
import { Button, Calendar, Card, Col, Drawer, Modal, Popover, Row, Segmented, Space, Tag, Typography } from 'antd';
import { FiPlus, FiCalendar, FiGrid } from 'react-icons/fi';
import { FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import updateLocale from 'dayjs/plugin/updateLocale';
import enUS from 'antd/es/calendar/locale/en_US';
import ScheduleDayDetail from './ScheduleDayDetail';
import { useTheme } from '../../context/ThemeContext';

const CALENDAR_MODE_KEY = 'box-schedule-calendar-mode';
const { Text, Title } = Typography;
const calendarLocale = {
  ...enUS,
  lang: {
    ...enUS.lang,
    shortWeekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
};

dayjs.extend(updateLocale);
dayjs.updateLocale('en', { weekStart: 1 });

const CalendarView = ({
  calendarData = [], scheduleTypes = [], onRefresh,
  fetchEvents, createEvent, updateEvent, deleteEvent,
  onDeleteDay, onEditDay, onEditSchedule,
  standaloneEvents = [], onEditStandaloneEvent,
  onQuickCreateSchedule, onQuickCreateEvent, onQuickCreateNote,
  // Shared filters from BoxSchedulePage — same as List view uses.
  searchText = '', filterType = '', contentFilter = 'all',
}) => {
  const { colors } = useTheme();

  // Default calendar mode: read from localStorage, fallback to 'month'
  const [calendarMode, setCalendarMode] = useState(() => {
    try {
      const saved = localStorage.getItem(CALENDAR_MODE_KEY);
      return saved === 'day' || saved === 'week' || saved === 'month' ? saved : 'month';
    } catch { return 'month'; }
  });
  // Saved default (what was stored in localStorage) — shown as "Current" marker in popover
  const [savedCalendarMode, setSavedCalendarMode] = useState(() => {
    try {
      const saved = localStorage.getItem(CALENDAR_MODE_KEY);
      return saved === 'day' || saved === 'week' || saved === 'month' ? saved : 'month';
    } catch { return 'month'; }
  });
  const [showDefaultPopover, setShowDefaultPopover] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start of current week (Monday)
    const today = dayjs();
    return today.day() === 0 ? today.subtract(6, 'day').startOf('day') : today.day(1).startOf('day');
  });
  const [currentDay, setCurrentDay] = useState(() => dayjs().startOf('day'));
  const [selectedCell, setSelectedCell] = useState(null);
  const [quickActionCell, setQuickActionCell] = useState(null);

  // ── Apply shared filters (Show / Schedule Type / Search) ──
  const showSchedules = contentFilter === 'all' || contentFilter === 'schedules';
  const showEvents    = contentFilter === 'all' || contentFilter === 'events';
  const showNotes     = contentFilter === 'all' || contentFilter === 'notes';
  const q = searchText.trim().toLowerCase();

  const filteredCalendarData = useMemo(() => {
    if (!showSchedules) return [];
    return calendarData
      .filter((day) => {
        if (filterType && day.typeName !== filterType) return false;
        if (!q) return true;
        const hay = [day.title, day.typeName].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      // Strip nested events/notes when Show excludes them, so schedule cells don't leak them.
      .map((day) => ({
        ...day,
        events: showEvents ? (day.events || []) : [],
        notes:  showNotes  ? (day.notes  || []) : [],
      }));
  }, [calendarData, showSchedules, showEvents, showNotes, filterType, q]);

  const filteredStandaloneEvents = useMemo(() => {
    return standaloneEvents.filter((evt) => {
      const kind = evt.eventType === 'note' ? 'notes' : 'events';
      if (kind === 'events' && !showEvents) return false;
      if (kind === 'notes' && !showNotes) return false;
      if (!q) return true;
      const hay = [evt.title, evt.description, evt.notes].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [standaloneEvents, showEvents, showNotes, q]);

  // Build standalone event lookup by date (from filtered set).
  // De-dup against nested rendering: if a linked event's parent schedule is currently
  // visible in the calendar, its cell already renders the event under the schedule pill —
  // skip it here to avoid showing the same event twice.
  const standaloneByDate = useMemo(() => {
    const visibleScheduleIds = new Set(filteredCalendarData.map((d) => d._id));
    const map = {};
    filteredStandaloneEvents.forEach((evt) => {
      if (evt.scheduleDayId && visibleScheduleIds.has(evt.scheduleDayId)) return;
      // Use startDateTime date or creation date
      const evtDate = evt.startDateTime
        ? dayjs(evt.startDateTime).startOf('day').valueOf()
        : evt.date ? dayjs(evt.date).startOf('day').valueOf() : null;
      if (evtDate) {
        if (!map[evtDate]) map[evtDate] = [];
        map[evtDate].push(evt);
      }
    });
    return map;
  }, [filteredStandaloneEvents, filteredCalendarData]);

  const dayLookup = useMemo(() => {
    const lookup = {};
    filteredCalendarData.forEach((day) => {
      (day.calendarDays || []).forEach((cd) => {
        const key = dayjs(cd).startOf('day').valueOf();
        if (!lookup[key]) lookup[key] = [];
        lookup[key].push(day);
      });
    });
    return lookup;
  }, [filteredCalendarData]);

  const calendarGrid = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    let startDay = startOfMonth.startOf('week');
    if (startDay.day() === 0) startDay = startDay.add(1, 'day');
    else if (startDay.day() !== 1) startDay = startDay.day(1);
    const weeks = [];
    let current = startDay;
    while (current.isBefore(endOfMonth) || current.isSame(endOfMonth, 'week')) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const dayKey = current.startOf('day').valueOf();
        week.push({ date: current, dayKey, schedulesOnDay: dayLookup[dayKey] || [], isCurrentMonth: current.month() === currentMonth.month() });
        current = current.add(1, 'day');
      }
      weeks.push(week);
      if (weeks.length >= 6) break;
    }
    return weeks;
  }, [currentMonth, dayLookup]);

  // Week grid — single row of 7 days
  const weekGrid = useMemo(() => {
    const week = [];
    let current = currentWeekStart;
    for (let i = 0; i < 7; i++) {
      const dayKey = current.startOf('day').valueOf();
      week.push({ date: current, dayKey, schedulesOnDay: dayLookup[dayKey] || [], isCurrentMonth: true });
      current = current.add(1, 'day');
    }
    return [week]; // Return as array of weeks (1 week) to reuse same table rendering
  }, [currentWeekStart, dayLookup]);

  // Day grid — single cell
  const dayCell = useMemo(() => {
    const dayKey = currentDay.startOf('day').valueOf();
    return {
      date: currentDay,
      dayKey,
      schedulesOnDay: dayLookup[dayKey] || [],
      isCurrentMonth: true,
    };
  }, [currentDay, dayLookup]);

  const isPastDate = (cell) => dayjs(cell.dayKey).isBefore(dayjs().startOf('day'));

  const handleCellClick = (cell) => {
    if (!cell.isCurrentMonth) return;
    const past = isPastDate(cell);
    const hasSchedule = cell.schedulesOnDay.length > 0;
    const hasStandalone = (standaloneByDate[cell.dayKey] || []).length > 0;

    if (hasSchedule || hasStandalone) {
      setSelectedCell({ ...cell, isPast: past });
      setQuickActionCell(null);
    } else if (!past) {
      // Empty cell — show quick action popup (only for future dates)
      setQuickActionCell(cell);
      setSelectedCell(null);
    }
  };
  const handleCloseDrawer = () => { setSelectedCell(null); };
  const handleCloseQuickAction = () => { setQuickActionCell(null); };

  const drawerBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: '3px', background: colors.surface, border: `1px solid ${colors.borderInput}`, borderRadius: '5px', cursor: 'pointer', color: colors.textMuted, fontSize: '11px', fontWeight: '500', padding: '3px 8px', transition: 'all 0.15s' };

  return (
    <div style={{ padding: '8px 16px 8px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-center justify-between" style={{ padding: '4px 0 8px', flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <Segmented
            options={['Month', 'Week', 'Day']}
            value={calendarMode === 'day' ? 'Day' : calendarMode === 'week' ? 'Week' : 'Month'}
            onChange={(val) => setCalendarMode(val === 'Day' ? 'day' : val === 'Week' ? 'week' : 'month')}
            style={{ background: colors.segmentedBg, borderRadius: '6px' }} size="small" />
          <Popover
            trigger="click"
            placement="bottomLeft"
            open={showDefaultPopover}
            onOpenChange={setShowDefaultPopover}
            content={
              <div style={{ width: '240px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary, marginBottom: '10px' }}>
                  Choose your default view
                </div>
                <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '12px', lineHeight: '1.4' }}>
                  This view will load first every time you open the Calendar.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { value: 'month', label: 'Month View', desc: 'Full month grid with all weeks' },
                    { value: 'week', label: 'Week View', desc: 'One week at a time with bigger cells' },
                    { value: 'day', label: 'Day View', desc: 'Single day focused view with full details' },
                  ].map((opt) => {
                    const isSelected = savedCalendarMode === opt.value;
                    return (
                      <button key={opt.value}
                        onClick={() => {
                          try {
                            localStorage.setItem(CALENDAR_MODE_KEY, opt.value);
                            setSavedCalendarMode(opt.value);
                            setCalendarMode(opt.value);
                            setShowDefaultPopover(false);
                            toast.success(`${opt.label} is now your default calendar view.`);
                          } catch {
                            toast.error('Failed to save default view');
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                          border: isSelected ? `2px solid ${colors.calCellSelectedBorder}` : `1px solid ${colors.border}`,
                          background: isSelected ? colors.popoverSelectedBg : colors.popoverBg,
                          transition: 'all 0.15s', textAlign: 'left', width: '100%',
                        }}
                      >
                        <span style={{
                          width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                          border: isSelected ? `5px solid ${colors.calCellSelectedBorder}` : `2px solid ${colors.textDisabled}`,
                          background: colors.surface,
                        }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: '10px', color: colors.textSubtle }}>
                            {opt.desc}
                          </div>
                        </div>
                        {isSelected && (
                          <span style={{ marginLeft: 'auto', fontSize: '10px', color: colors.successText, fontWeight: '600' }}>Current</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            }
          >
            <Button size="small" icon={<FiGrid size={12} />}
              style={{ borderColor: colors.borderButton, color: colors.textSecondary, borderRadius: '6px', fontSize: '11px' }}>
              Set as Default
            </Button>
          </Popover>
        </div>

        <div className="flex items-center gap-3">
          <Button icon={<FiChevronLeft size={14} />} size="small"
            onClick={() => {
              if (calendarMode === 'day') setCurrentDay((d) => d.subtract(1, 'day'));
              else if (calendarMode === 'week') setCurrentWeekStart((w) => w.subtract(1, 'week'));
              else setCurrentMonth((m) => m.subtract(1, 'month'));
            }}
            style={{ borderColor: colors.borderButton, borderRadius: '6px' }} />
          <h2 style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', margin: 0, minWidth: '240px', textAlign: 'center', fontFamily: "'Georgia', serif", color: colors.textPrimary }}>
            {calendarMode === 'day'
              ? currentDay.format('dddd, MMM D, YYYY')
              : calendarMode === 'week'
                ? `${currentWeekStart.format('MMM D')} – ${currentWeekStart.add(6, 'day').format('MMM D, YYYY')}`
                : currentMonth.format('MMMM YYYY')
            }
          </h2>
          <Button icon={<FiChevronRight size={14} />} size="small"
            onClick={() => {
              if (calendarMode === 'day') setCurrentDay((d) => d.add(1, 'day'));
              else if (calendarMode === 'week') setCurrentWeekStart((w) => w.add(1, 'week'));
              else setCurrentMonth((m) => m.add(1, 'month'));
            }}
            style={{ borderColor: colors.borderButton, borderRadius: '6px' }} />
        </div>

        <Button size="small" onClick={() => {
          if (calendarMode === 'day') {
            setCurrentDay(dayjs().startOf('day'));
          } else if (calendarMode === 'week') {
            const today = dayjs();
            setCurrentWeekStart(today.day() === 0 ? today.subtract(6, 'day').startOf('day') : today.day(1).startOf('day'));
          } else {
            setCurrentMonth(dayjs().startOf('month'));
          }
        }} style={{ borderColor: colors.borderButton, borderRadius: '6px', fontSize: '11px', color: colors.textMuted }}>
          Today
        </Button>
      </div>

      <div style={{ background: colors.surface, borderRadius: '8px', border: `1px solid ${colors.border}`, overflow: 'hidden', boxShadow: `0 1px 6px ${colors.shadow}`, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {calendarMode === 'day' ? (
          <DayFocusCard
            cell={dayCell}
            standaloneEvents={standaloneByDate[dayCell.dayKey] || []}
            onOpenDetail={() => setSelectedCell({ ...dayCell, isPast: dayjs(dayCell.dayKey).isBefore(dayjs().startOf('day')) })}
            onCreateSchedule={() => { if (onQuickCreateSchedule) onQuickCreateSchedule(dayCell.dayKey); }}
            onCreateEvent={() => { if (onQuickCreateEvent) onQuickCreateEvent(dayCell.dayKey); }}
          />
        ) : calendarMode === 'month' ? (
        <div className="box-schedule-antd-calendar" style={{ flex: 1 }}>
          <Calendar
            fullscreen
            value={currentMonth}
            locale={calendarLocale}
            headerRender={() => null}
            onPanelChange={(value) => setCurrentMonth(value.startOf('month'))}
            fullCellRender={(current) => {
              const dayKey = current.startOf('day').valueOf();
              const isCurrentMonth = current.month() === currentMonth.month();
              const schedulesOnDay = dayLookup[dayKey] || [];
              const hasSchedule = schedulesOnDay.length > 0;
              const primary = schedulesOnDay[0];
              const isWeekend = current.day() === 0 || current.day() === 6;
              const isToday = current.isSame(dayjs(), 'day');
              const isSelected = selectedCell?.dayKey === dayKey;
              const isPast = current.isBefore(dayjs().startOf('day'));
              const standalone = standaloneByDate[dayKey] || [];
              const hasStandalone = standalone.length > 0;
              const isPastClickable = isPast && (hasSchedule || hasStandalone);
              // Only count notes whose `date` matches this cell's dayKey (not every note on the block).
              const noteCount = schedulesOnDay.reduce(
                (sum, s) => sum + ((s.notes || []).filter((n) => Number(n.date) === Number(dayKey)).length),
                0
              );
              const baseBackground = hasSchedule ? `${primary.color}0C` : isWeekend ? colors.calWeekendBg : colors.surface;

              return (
                <div
                  onClick={() => handleCellClick({ date: current, dayKey, schedulesOnDay, isCurrentMonth })}
                  style={{
                    height: '100%',
                    minHeight: '86px',
                    padding: '10px 12px 8px',
                    background: isSelected ? colors.calCellSelected : baseBackground,
                    opacity: !isCurrentMonth ? 0.3 : isPast && !isPastClickable ? 0.45 : 1,
                    cursor: !isCurrentMonth ? 'default' : isPast && !isPastClickable ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (isCurrentMonth && !isSelected) {
                      e.currentTarget.style.background = colors.calCellHover;
                      e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${colors.borderButton}`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = baseBackground;
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: isToday ? '800' : '600',
                    color: isToday ? colors.calTodayBg : colors.textSecondary,
                    marginBottom: '8px',
                    fontFamily: "'Georgia', serif",
                    ...(isToday ? {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: colors.calTodayBg,
                      color: colors.calTodayText,
                      fontSize: '14px',
                    } : {}),
                  }}>
                    {current.date()}
                  </div>

                  {hasSchedule && schedulesOnDay.map((s, si) => (
                    <div key={si} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px 4px 7px',
                      borderRadius: '6px',
                      background: `${s.color}18`,
                      border: `1px solid ${s.color}35`,
                      marginBottom: '4px',
                      marginRight: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textBody,
                      letterSpacing: '0.2px',
                    }}>
                      <span style={{ width: '8px', height: '8px', backgroundColor: s.color, borderRadius: '3px', flexShrink: 0 }} />
                      {s.typeName === 'Day Off' ? 'OFF' : s.typeName}
                    </div>
                  ))}

                  {schedulesOnDay.map((s) => (s.events || [])
                    .filter((evt) => Number(evt.date) === Number(dayKey))
                    .map((evt, ei) => (
                    <div key={`${s._id || 'day'}-evt-${evt._id || ei}`} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      color: colors.textBody,
                      marginTop: '2px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: evt.color || '#3498DB', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{evt.title}</span>
                    </div>
                  )))}

                  {standalone.map((evt, ei) => (
                    <div key={`se-${evt._id || ei}`} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      color: colors.textBody,
                      marginTop: '2px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: evt.color || '#3498DB', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{evt.title}</span>
                    </div>
                  ))}

                  {noteCount > 0 && (
                    <div style={{ fontSize: '10px', color: colors.textFaint, marginTop: '4px' }}>
                      {noteCount} note{noteCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
        ) : (
        <div style={{ padding: '0 0 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${colors.borderMedium}`, background: colors.surfaceAlt2 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} style={{ padding: '10px 4px', textAlign: 'center', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: colors.textSubtle, borderRight: `1px solid ${colors.borderLight}` }}>
                {d}
              </div>
            ))}
          </div>
          <Row gutter={0} wrap={false}>
            {(calendarMode === 'week' ? weekGrid[0] : []).map((cell) => (
              <Col key={cell.dayKey} flex="1 1 0">
                <WeekCell
                  cell={cell}
                  selectedCell={selectedCell}
                  standaloneEvents={standaloneByDate[cell.dayKey] || []}
                  onClick={handleCellClick}
                />
              </Col>
            ))}
          </Row>
        </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer
        title={selectedCell ? (
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: "'Georgia', serif", color: colors.textPrimary }}>
              {dayjs(selectedCell.dayKey).format('dddd, MMMM D, YYYY')}
            </div>
            {selectedCell.schedulesOnDay.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                {selectedCell.schedulesOnDay.map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px 2px 6px', borderRadius: '4px', background: `${s.color}14`, border: `1px solid ${s.color}30`, fontSize: '11px', fontWeight: '600', color: colors.textBody }}>
                    <span style={{ width: '8px', height: '8px', backgroundColor: s.color, borderRadius: '2px' }} />
                    {s.typeName}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : 'Day Details'}
        placement="right" width={640} onClose={handleCloseDrawer} open={!!selectedCell}
        styles={{ header: { borderBottom: `1px solid ${colors.border}`, background: colors.drawerHeaderBg }, body: { padding: 0, background: colors.drawerBodyBg } }}>

        {selectedCell && (
          <>
            {/* Schedule day details */}
            {selectedCell.schedulesOnDay.length > 0 && (
              selectedCell.schedulesOnDay.map((scheduleDay, idx) => (
                <div key={idx} style={{ borderBottom: `2px solid ${colors.border}` }}>
                  <ScheduleDayDetail day={{ ...scheduleDay, singleDate: selectedCell.dayKey }}
                    fetchEvents={fetchEvents} createEvent={createEvent} updateEvent={updateEvent} deleteEvent={deleteEvent}
                    onDelete={() => { onDeleteDay(scheduleDay._id, selectedCell.dayKey); handleCloseDrawer(); if (onRefresh) onRefresh(); }}
                    onEdit={(data) => { onEditDay(scheduleDay._id, data); if (onRefresh) onRefresh(); }}
                    onEditSchedule={(day) => { handleCloseDrawer(); if (onEditSchedule) onEditSchedule(day); }}
                    scheduleTypes={scheduleTypes}
                    readOnly={selectedCell.isPast} />
                </div>
              ))
            )}

            {/* Standalone events on this date */}
            {(standaloneByDate[selectedCell.dayKey] || []).length > 0 && (
              <div style={{ padding: '16px 24px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: '700', letterSpacing: '1.2px', color: colors.textMuted,
                  textTransform: 'uppercase', margin: '0 0 10px', paddingBottom: '4px', borderBottom: `1px solid ${colors.borderLight}`,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <FiClock size={13} style={{ opacity: 0.6 }} />
                  Standalone Events
                </div>
                <div className="flex flex-col gap-1.5">
                  {(standaloneByDate[selectedCell.dayKey] || []).map((evt) => (
                    <div key={evt._id} style={{
                      padding: '10px 12px', background: colors.surface,
                      border: `1px solid ${colors.border}`, borderRadius: '6px',
                      borderLeft: `3px solid ${evt.color || '#3498DB'}`,
                    }}>
                      <div className="flex items-start justify-between gap-2">
                        <div style={{ flex: 1 }}>
                          {evt.startDateTime && (
                            <div style={{ fontSize: '12px', color: colors.textMuted, fontWeight: '500', marginBottom: '2px' }}>
                              {evt.fullDay ? 'Full Day' : dayjs(evt.startDateTime).format('h:mm A')}{evt.endDateTime && !evt.fullDay ? ` – ${dayjs(evt.endDateTime).format('h:mm A')}` : ''}
                            </div>
                          )}
                          <div style={{ fontSize: '14px', fontWeight: '600', color: evt.textColor || colors.textBody }}>{evt.title}</div>
                          {evt.location && (
                            <div onClick={() => window.open(evt.locationLat ? `https://www.google.com/maps?q=${evt.locationLat},${evt.locationLng}` : `https://www.google.com/maps/search/${encodeURIComponent(evt.location)}`, '_blank')}
                              style={{ fontSize: '12px', color: colors.textLink, marginTop: '2px', cursor: 'pointer', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FiMapPin size={11} /> {evt.location}
                            </div>
                          )}
                          {(evt.description || evt.notes) && (
                            <div style={{ fontSize: '12px', color: colors.textSubtle, marginTop: '3px' }}>{evt.description || evt.notes}</div>
                          )}
                        </div>
                        {!selectedCell.isPast && (
                          <div className="flex gap-1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <button onClick={() => { if (onEditStandaloneEvent) onEditStandaloneEvent(evt); }}
                              style={drawerBtnStyle}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#eef3ff'; e.currentTarget.style.borderColor = colors.textLink; e.currentTarget.style.color = colors.textLink; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.borderInput; e.currentTarget.style.color = colors.textMuted; }}>
                              <FiEdit2 size={11} /> Edit
                            </button>
                            <button onClick={async () => { await deleteEvent(evt._id); if (onRefresh) onRefresh(); }}
                              style={drawerBtnStyle}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#e74c3c'; e.currentTarget.style.color = '#e74c3c'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.borderInput; e.currentTarget.style.color = colors.textMuted; }}>
                              <FiTrash2 size={11} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state — no schedule AND no standalone events */}
            {selectedCell.schedulesOnDay.length === 0 && (standaloneByDate[selectedCell.dayKey] || []).length === 0 && (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: colors.textPlaceholder }}>
                <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>&#x1f4c5;</div>
                <p style={{ fontSize: '15px', fontWeight: '600', color: colors.textSubtle, margin: '0 0 4px' }}>No schedule on this day</p>
                <p style={{ fontSize: '13px', color: colors.textDisabled }}>{dayjs(selectedCell.dayKey).format('MMMM D, YYYY')}</p>
              </div>
            )}

            {/* Quick actions — Create Schedule / Event / Note (future dates only) */}
            {!selectedCell.isPast && (
              <div style={{
                padding: '16px 20px', borderTop: `1px solid ${colors.border}`, background: colors.surfaceAlt,
              }}>
                <div style={{
                  fontSize: '11px', fontWeight: '700', letterSpacing: '1.2px', color: colors.textMuted,
                  textTransform: 'uppercase', marginBottom: '10px',
                }}>
                  Add to this day
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="small" icon={<FiCalendar size={12} />}
                    onClick={() => {
                      handleCloseDrawer();
                      if (onQuickCreateSchedule) onQuickCreateSchedule(selectedCell.dayKey);
                    }}
                    style={{ borderRadius: '6px', fontSize: '12px', borderColor: colors.solidDark, color: colors.textPrimary, fontWeight: '600' }}>
                    Create Schedule
                  </Button>
                  <Button size="small" icon={<FiClock size={12} />}
                    onClick={() => {
                      handleCloseDrawer();
                      if (onQuickCreateEvent) onQuickCreateEvent(selectedCell.dayKey);
                    }}
                    style={{ borderRadius: '6px', fontSize: '12px', borderColor: colors.borderButton, color: colors.textSecondary }}>
                    Create Event
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Quick Action Modal — shown when clicking empty cell */}
      <Modal open={!!quickActionCell} onCancel={handleCloseQuickAction} centered width={380}
        footer={null}
        title={
          <span style={{ fontSize: '15px', fontWeight: '700' }}>
            {quickActionCell ? dayjs(quickActionCell.dayKey).format('dddd, MMMM D, YYYY') : ''}
          </span>
        }>
        <div style={{ padding: '4px 0' }}>
          <p style={{ fontSize: '13px', color: colors.textMuted, margin: '0 0 16px' }}>
            This date has no schedule or events. What would you like to create?
          </p>
          <div className="flex flex-col gap-2">
            <Button block size="large" icon={<FiCalendar size={15} />}
              onClick={() => {
                const dateVal = quickActionCell?.dayKey;
                handleCloseQuickAction();
                if (onQuickCreateSchedule) onQuickCreateSchedule(dateVal);
              }}
              style={{ textAlign: 'left', height: 'auto', padding: '12px 16px', borderRadius: '8px', borderColor: colors.solidDark, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Create Schedule</div>
                <div style={{ fontSize: '12px', color: colors.textMuted, fontWeight: '400' }}>Add a Prep, Shoot, Wrap, Day Off, or Travel day</div>
              </div>
            </Button>
            <Button block size="large" icon={<FiClock size={15} />}
              onClick={() => {
                const dateVal = quickActionCell?.dayKey;
                handleCloseQuickAction();
                if (onQuickCreateEvent) onQuickCreateEvent(dateVal);
              }}
              style={{ textAlign: 'left', height: 'auto', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Create Event</div>
                <div style={{ fontSize: '12px', color: colors.textMuted, fontWeight: '400' }}>Add a meeting, call, or activity with time and location</div>
              </div>
            </Button>
            <Button block size="large" icon={<FiEdit2 size={15} />}
              onClick={() => {
                const dateVal = quickActionCell?.dayKey;
                handleCloseQuickAction();
                if (onQuickCreateNote) onQuickCreateNote(dateVal);
              }}
              style={{ textAlign: 'left', height: 'auto', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Create Note</div>
                <div style={{ fontSize: '12px', color: colors.textMuted, fontWeight: '400' }}>Add a quick note or reminder for this day</div>
              </div>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const WeekCell = ({ cell, selectedCell, standaloneEvents, onClick }) => {
  const { colors } = useTheme();
  const hasSchedule = cell.schedulesOnDay.length > 0;
  const primary = cell.schedulesOnDay[0];
  const isWeekend = cell.date.day() === 0 || cell.date.day() === 6;
  const isToday = cell.date.isSame(dayjs(), 'day');
  const isSelected = selectedCell?.dayKey === cell.dayKey;
  const isPast = cell.date.isBefore(dayjs().startOf('day'));
  const hasStandalone = standaloneEvents.length > 0;
  const isPastClickable = isPast && (hasSchedule || hasStandalone);
  const noteCount = cell.schedulesOnDay.reduce((sum, s) => sum + (s.notes?.length || 0), 0);

  return (
    <Card
      hoverable={cell.isCurrentMonth && !(isPast && !isPastClickable)}
      onClick={() => onClick(cell)}
      bodyStyle={{ padding: '12px 14px', minHeight: 180 }}
      style={{
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: `1px solid ${colors.borderLight}`,
        borderBottom: `1px solid ${colors.borderLight}`,
        boxShadow: 'none',
        cursor: !cell.isCurrentMonth ? 'default' : isPast && !isPastClickable ? 'not-allowed' : 'pointer',
        opacity: !cell.isCurrentMonth ? 0.3 : isPast && !isPastClickable ? 0.45 : 1,
        background: isSelected ? colors.calCellSelected : hasSchedule ? `${primary.color}0C` : isWeekend ? colors.calWeekendBg : colors.surface,
      }}
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <div style={{
            fontSize: '16px',
            fontWeight: 700,
            color: isToday ? colors.calTodayText : colors.textSecondary,
            fontFamily: "'Georgia', serif",
            width: isToday ? 40 : 'auto',
            height: isToday ? 40 : 'auto',
            borderRadius: isToday ? '50%' : 0,
            background: isToday ? colors.calTodayBg : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {cell.date.date()}
          </div>
          <div style={{ fontSize: '10px', color: colors.textPlaceholder, marginTop: '6px', letterSpacing: '0.5px' }}>
            {cell.date.format('ddd, MMM D')}
          </div>
        </div>

        <Space size={[6, 6]} wrap>
          {cell.schedulesOnDay.map((s, si) => (
            <Tag key={si} style={{ marginInlineEnd: 0, padding: '6px 10px', borderRadius: '6px', background: `${s.color}18`, borderColor: `${s.color}35`, color: colors.textBody, fontSize: '11px', fontWeight: 600 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: s.color, borderRadius: 3, marginRight: 6 }} />
              {s.typeName === 'Day Off' ? 'OFF' : s.typeName}
            </Tag>
          ))}
        </Space>

        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {cell.schedulesOnDay.flatMap((s) => (s.events || [])).map((evt, ei) => (
            <div key={`evt-${evt._id || ei}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: colors.textBody, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: evt.color || '#3498DB', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{evt.title}</span>
            </div>
          ))}
          {standaloneEvents.map((evt, ei) => (
            <div key={`se-${evt._id || ei}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: colors.textBody, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: evt.color || '#3498DB', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{evt.title}</span>
            </div>
          ))}
        </Space>

        {noteCount > 0 && (
          <Text style={{ fontSize: 10, color: colors.textFaint }}>
            {noteCount} note{noteCount > 1 ? 's' : ''}
          </Text>
        )}
      </Space>
    </Card>
  );
};

// ── DayFocusCard — single-day focused view with full schedule/event/note details ──
const DayFocusCard = ({ cell, standaloneEvents, onOpenDetail, onCreateSchedule, onCreateEvent }) => {
  const { colors } = useTheme();
  const isToday = cell.date.isSame(dayjs(), 'day');
  const isPast = cell.date.isBefore(dayjs().startOf('day'));
  const schedules = cell.schedulesOnDay || [];
  const allEvents = schedules.flatMap((s) => s.events || []);
  const allNotes = schedules.flatMap((s) => s.notes || []);
  const standaloneList = standaloneEvents || [];
  const isEmpty = schedules.length === 0 && allEvents.length === 0 && allNotes.length === 0 && standaloneList.length === 0;

  return (
    <Card bordered={false} bodyStyle={{ padding: '24px 32px', overflowY: 'auto' }} style={{ flex: 1, boxShadow: 'none' }}>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '18px', paddingBottom: '16px', borderBottom: `2px solid ${colors.border}` }}>
          <div style={{
            fontSize: '72px', fontWeight: '800', lineHeight: 1, color: isToday ? colors.calTodayBg : colors.textSecondary,
            fontFamily: "'Georgia', serif",
            ...(isToday ? { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '96px', height: '96px', borderRadius: '50%', background: colors.calTodayBg, color: colors.calTodayText, fontSize: '56px' } : {}),
          }}>
            {cell.date.date()}
          </div>
          <div>
            <Title level={2} style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: colors.textPrimary, fontFamily: "'Georgia', serif", letterSpacing: '0.5px' }}>
              {cell.date.format('dddd')}
            </Title>
            <Text style={{ display: 'block', fontSize: '13px', color: colors.textMuted, fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4px' }}>
              {cell.date.format('MMMM YYYY')}
            </Text>
            {isToday && <Tag color="success" style={{ marginTop: 10, borderRadius: 12, fontWeight: 700 }}>TODAY</Tag>}
            {isPast && !isToday && <Tag style={{ marginTop: 10, borderRadius: 12, fontWeight: 700, color: colors.textMuted, background: colors.segmentedBg, borderColor: colors.border }}>PAST</Tag>}
          </div>
        </div>

        {schedules.length > 0 && (
          <div>
            <Text style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted, letterSpacing: '1.2px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Schedules on this day
            </Text>
            <Space size={[8, 8]} wrap>
              {schedules.map((s) => (
                <Tag key={s._id} style={{ marginInlineEnd: 0, padding: '10px 14px', borderRadius: '8px', background: `${s.color}15`, borderColor: `${s.color}40`, color: colors.textPrimary }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: s.color, display: 'inline-block', marginRight: 8 }} />
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{s.typeName}</span>
                  {s.title ? <span style={{ marginLeft: 8, fontSize: '11px', color: colors.textSecondary, fontFamily: "'Georgia', serif" }}>"{s.title}"</span> : null}
                </Tag>
              ))}
            </Space>
          </div>
        )}

        {(allEvents.length > 0 || standaloneList.length > 0) && (
          <div>
            <Text style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted, letterSpacing: '1.2px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Events
            </Text>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {[...allEvents, ...standaloneList].map((evt, i) => (
                <Card key={`${evt._id || i}`} size="small" bodyStyle={{ padding: '10px 14px' }} style={{ background: colors.historyCardBg, borderLeft: `4px solid ${evt.color || '#3498DB'}` }}>
                  {evt.startDateTime && (
                    <Text style={{ display: 'block', fontSize: '11px', color: colors.textMuted, fontWeight: '600', marginBottom: '3px' }}>
                      {evt.fullDay ? 'Full Day' : dayjs(evt.startDateTime).format('h:mm A')}
                      {evt.endDateTime && !evt.fullDay ? ` – ${dayjs(evt.endDateTime).format('h:mm A')}` : ''}
                    </Text>
                  )}
                  <div style={{ fontSize: '14px', fontWeight: '700', color: colors.textPrimary }}>{evt.title}</div>
                  {evt.location && <div style={{ fontSize: '11px', color: colors.textLink, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}><FiMapPin size={11} /> {evt.location}</div>}
                  {evt.description && <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>{evt.description}</div>}
                </Card>
              ))}
            </Space>
          </div>
        )}

        {allNotes.length > 0 && (
          <div>
            <Text style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted, letterSpacing: '1.2px', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
              Notes
            </Text>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {allNotes.map((n, i) => (
                <Card key={i} size="small" bodyStyle={{ padding: '10px 14px' }} style={{ background: colors.surfaceNoteCard, borderColor: colors.surfaceNoteCardBorder }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>{n.title}</div>
                  {n.notes && <div style={{ fontSize: '12px', color: '#777', marginTop: '3px' }}>{n.notes}</div>}
                </Card>
              ))}
            </Space>
          </div>
        )}

        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: colors.textPlaceholder }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.35 }}>&#x1f4c5;</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: colors.textSubtle, marginBottom: '4px' }}>
              Nothing scheduled on this day
            </div>
            <div style={{ fontSize: '12px', color: colors.textDisabled }}>
              {isPast ? 'This date is in the past.' : 'Add a schedule or event to get started.'}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2" style={{ marginTop: isEmpty ? '16px' : '8px', paddingTop: '14px', borderTop: `1px dashed ${colors.borderDashed}` }}>
          {(schedules.length > 0 || standaloneList.length > 0) && (
            <Button size="small" onClick={onOpenDetail}
              style={{ borderColor: colors.solidDark, color: colors.textPrimary, borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
              View Full Details
            </Button>
          )}
          {!isPast && (
            <>
              <Button size="small" icon={<FiCalendar size={12} />} onClick={onCreateSchedule}
                style={{ borderColor: colors.borderButton, color: colors.textSecondary, borderRadius: '6px', fontSize: '12px' }}>
                Add Schedule
              </Button>
              <Button size="small" icon={<FiClock size={12} />} onClick={onCreateEvent}
                style={{ borderColor: colors.borderButton, color: colors.textSecondary, borderRadius: '6px', fontSize: '12px' }}>
                Add Event
              </Button>
            </>
          )}
        </div>
      </Space>
    </Card>
  );
};

export default CalendarView;
