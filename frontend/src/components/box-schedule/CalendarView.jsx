import React, { useState, useMemo } from 'react';
import { Button, Drawer, Modal, Segmented } from 'antd';
import { FiPlus, FiCalendar } from 'react-icons/fi';
import { FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiEdit2, FiTrash2 } from 'react-icons/fi';
import dayjs from 'dayjs';
import ScheduleDayDetail from './ScheduleDayDetail';

const CalendarView = ({
  calendarData = [], scheduleTypes = [], onRefresh,
  fetchEvents, createEvent, updateEvent, deleteEvent,
  onDeleteDay, onEditDay, onEditSchedule,
  standaloneEvents = [], onEditStandaloneEvent,
  onQuickCreateSchedule, onQuickCreateEvent, onQuickCreateNote,
}) => {
  const [calendarMode, setCalendarMode] = useState('week'); // 'week' | 'month'
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start of current week (Monday)
    const today = dayjs();
    return today.day() === 0 ? today.subtract(6, 'day').startOf('day') : today.day(1).startOf('day');
  });
  const [selectedCell, setSelectedCell] = useState(null);
  const [quickActionCell, setQuickActionCell] = useState(null);

  // Build standalone event lookup by date
  const standaloneByDate = useMemo(() => {
    const map = {};
    standaloneEvents.forEach((evt) => {
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
  }, [standaloneEvents]);

  const dayLookup = useMemo(() => {
    const lookup = {};
    calendarData.forEach((day) => {
      (day.calendarDays || []).forEach((cd) => {
        const key = dayjs(cd).startOf('day').valueOf();
        if (!lookup[key]) lookup[key] = [];
        lookup[key].push(day);
      });
    });
    return lookup;
  }, [calendarData]);

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

  return (
    <div style={{ padding: '8px 16px 8px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-center justify-between" style={{ padding: '4px 0 8px', flexShrink: 0 }}>
        <Segmented options={['Week', 'Month']} value={calendarMode === 'week' ? 'Week' : 'Month'}
          onChange={(val) => setCalendarMode(val === 'Week' ? 'week' : 'month')}
          style={{ background: '#f0efec', borderRadius: '6px' }} size="small" />

        <div className="flex items-center gap-3">
          <Button icon={<FiChevronLeft size={14} />} size="small"
            onClick={() => {
              if (calendarMode === 'week') setCurrentWeekStart((w) => w.subtract(1, 'week'));
              else setCurrentMonth((m) => m.subtract(1, 'month'));
            }}
            style={{ borderColor: '#d0ccc5', borderRadius: '6px' }} />
          <h2 style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', margin: 0, minWidth: '200px', textAlign: 'center', fontFamily: "'Georgia', serif", color: '#1a1a1a' }}>
            {calendarMode === 'week'
              ? `${currentWeekStart.format('MMM D')} – ${currentWeekStart.add(6, 'day').format('MMM D, YYYY')}`
              : currentMonth.format('MMMM YYYY')
            }
          </h2>
          <Button icon={<FiChevronRight size={14} />} size="small"
            onClick={() => {
              if (calendarMode === 'week') setCurrentWeekStart((w) => w.add(1, 'week'));
              else setCurrentMonth((m) => m.add(1, 'month'));
            }}
            style={{ borderColor: '#d0ccc5', borderRadius: '6px' }} />
        </div>

        <Button size="small" onClick={() => {
          if (calendarMode === 'week') {
            const today = dayjs();
            setCurrentWeekStart(today.day() === 0 ? today.subtract(6, 'day').startOf('day') : today.day(1).startOf('day'));
          } else {
            setCurrentMonth(dayjs().startOf('month'));
          }
        }} style={{ borderColor: '#d0ccc5', borderRadius: '6px', fontSize: '11px', color: '#888' }}>
          Today
        </Button>
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e0ddd8', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', height: calendarMode === 'week' ? 'auto' : '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <th key={d} style={{ padding: '6px 4px', borderBottom: '1px solid #d8d5cf', borderRight: '1px solid #eee', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textAlign: 'center', textTransform: 'uppercase', color: '#999', background: '#f7f6f3', width: `${100 / 7}%` }}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(calendarMode === 'week' ? weekGrid : calendarGrid).map((week, wi) => (
              <tr key={wi}>
                {week.map((cell) => {
                  const hasSchedule = cell.schedulesOnDay.length > 0;
                  const primary = cell.schedulesOnDay[0];
                  const isWeekend = cell.date.day() === 0 || cell.date.day() === 6;
                  const isToday = cell.date.isSame(dayjs(), 'day');
                  const isSelected = selectedCell?.dayKey === cell.dayKey;
                  const isPast = cell.date.isBefore(dayjs().startOf('day'));
                  const hasStandalone = (standaloneByDate[cell.dayKey] || []).length > 0;
                  const isPastClickable = isPast && (hasSchedule || hasStandalone); // past with data = view only

                  // Count events and notes from calendar data
                  const eventCount = cell.schedulesOnDay.reduce((sum, s) => sum + (s.events?.length || 0), 0);
                  const noteCount = cell.schedulesOnDay.reduce((sum, s) => sum + (s.notes?.length || 0), 0);

                  return (
                    <td key={cell.dayKey} onClick={() => handleCellClick(cell)}
                      style={{
                        border: isSelected ? '2px solid #1a1a1a' : '1px solid #eee',
                        padding: calendarMode === 'week' ? '10px 10px' : '4px 6px',
                        verticalAlign: 'top',
                        minHeight: calendarMode === 'week' ? '200px' : undefined,
                        background: isSelected ? '#fdfcf4' : hasSchedule ? `${primary.color}0C` : isWeekend ? '#fdfcfa' : '#fff',
                        opacity: !cell.isCurrentMonth ? 0.3 : isPast && !isPastClickable ? 0.45 : 1,
                        transition: 'all 0.15s ease',
                        cursor: !cell.isCurrentMonth ? 'default' : isPast && !isPastClickable ? 'not-allowed' : 'pointer',
                      }}
                      onMouseEnter={(e) => { if (cell.isCurrentMonth && !isSelected) { e.currentTarget.style.background = '#f8f7f0'; e.currentTarget.style.boxShadow = 'inset 0 0 0 1px #d0ccc5'; } }}
                      onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.background = hasSchedule ? `${primary.color}0C` : isWeekend ? '#fdfcfa' : '#fff'; e.currentTarget.style.boxShadow = 'none'; } }}>

                      <div style={{
                        fontSize: calendarMode === 'week' ? '16px' : '14px',
                        fontWeight: isToday ? '800' : '600', color: isToday ? '#1a1a1a' : '#555',
                        marginBottom: calendarMode === 'week' ? '6px' : '3px', fontFamily: "'Georgia', serif",
                        ...(isToday ? { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: calendarMode === 'week' ? '28px' : '24px', height: calendarMode === 'week' ? '28px' : '24px', borderRadius: '50%', background: '#1a1a1a', color: '#fff', fontSize: calendarMode === 'week' ? '14px' : '12px' } : {}),
                      }}>
                        {cell.date.date()}
                      </div>
                      {calendarMode === 'week' && (
                        <div style={{ fontSize: '10px', color: '#bbb', marginBottom: '4px', letterSpacing: '0.5px' }}>
                          {cell.date.format('ddd, MMM D')}
                        </div>
                      )}

                      {hasSchedule && cell.schedulesOnDay.map((s, si) => (
                        <div key={si} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px 2px 5px', borderRadius: '4px', background: `${s.color}20`, border: `1px solid ${s.color}35`, marginBottom: '3px', fontSize: '11px', fontWeight: '600', color: '#444', letterSpacing: '0.3px' }}>
                          <span style={{ width: '7px', height: '7px', backgroundColor: s.color, borderRadius: '2px', flexShrink: 0 }} />
                          {s.typeName === 'Day Off' ? 'OFF' : s.typeName}
                        </div>
                      ))}

                      {/* Event indicators — colored dots with title */}
                      {cell.schedulesOnDay.map((s) => (s.events || []).map((evt, ei) => (
                        <div key={`evt-${ei}`} style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          fontSize: '10px', color: '#444', marginTop: '2px',
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }}>
                          <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            backgroundColor: evt.color || '#3498DB', flexShrink: 0,
                          }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{evt.title}</span>
                        </div>
                      )))}
                      {/* Standalone events on this date */}
                      {(standaloneByDate[cell.dayKey] || []).map((evt, ei) => (
                        <div key={`se-${ei}`} style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          fontSize: '10px', color: '#444', marginTop: '2px',
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: evt.color || '#3498DB', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{evt.title}</span>
                        </div>
                      ))}
                      {noteCount > 0 && (
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>
                          {noteCount} note{noteCount > 1 ? 's' : ''}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Drawer */}
      <Drawer
        title={selectedCell ? (
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: "'Georgia', serif", color: '#1a1a1a' }}>
              {dayjs(selectedCell.dayKey).format('dddd, MMMM D, YYYY')}
            </div>
            {selectedCell.schedulesOnDay.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                {selectedCell.schedulesOnDay.map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px 2px 6px', borderRadius: '4px', background: `${s.color}14`, border: `1px solid ${s.color}30`, fontSize: '11px', fontWeight: '600', color: '#444' }}>
                    <span style={{ width: '8px', height: '8px', backgroundColor: s.color, borderRadius: '2px' }} />
                    {s.typeName}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : 'Day Details'}
        placement="right" width={640} onClose={handleCloseDrawer} open={!!selectedCell}
        styles={{ header: { borderBottom: '1px solid #e0ddd8', background: '#fafaf8' }, body: { padding: 0, background: '#fdfcf8' } }}>

        {selectedCell && (
          <>
            {/* Schedule day details */}
            {selectedCell.schedulesOnDay.length > 0 && (
              selectedCell.schedulesOnDay.map((scheduleDay, idx) => (
                <div key={idx} style={{ borderBottom: '2px solid #e0ddd8' }}>
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
                  fontSize: '11px', fontWeight: '700', letterSpacing: '1.2px', color: '#888',
                  textTransform: 'uppercase', margin: '0 0 10px', paddingBottom: '4px', borderBottom: '1px solid #eee',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <FiClock size={13} style={{ opacity: 0.6 }} />
                  Standalone Events
                </div>
                <div className="flex flex-col gap-1.5">
                  {(standaloneByDate[selectedCell.dayKey] || []).map((evt) => (
                    <div key={evt._id} style={{
                      padding: '10px 12px', background: '#fff',
                      border: '1px solid #e8e5e0', borderRadius: '6px',
                      borderLeft: `3px solid ${evt.color || '#3498DB'}`,
                    }}>
                      <div className="flex items-start justify-between gap-2">
                        <div style={{ flex: 1 }}>
                          {evt.startDateTime && (
                            <div style={{ fontSize: '12px', color: '#888', fontWeight: '500', marginBottom: '2px' }}>
                              {evt.fullDay ? 'Full Day' : dayjs(evt.startDateTime).format('h:mm A')}{evt.endDateTime && !evt.fullDay ? ` – ${dayjs(evt.endDateTime).format('h:mm A')}` : ''}
                            </div>
                          )}
                          <div style={{ fontSize: '14px', fontWeight: '600', color: evt.textColor || '#333' }}>{evt.title}</div>
                          {evt.location && (
                            <div onClick={() => window.open(evt.locationLat ? `https://www.google.com/maps?q=${evt.locationLat},${evt.locationLng}` : `https://www.google.com/maps/search/${encodeURIComponent(evt.location)}`, '_blank')}
                              style={{ fontSize: '12px', color: '#1a73e8', marginTop: '2px', cursor: 'pointer', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FiMapPin size={11} /> {evt.location}
                            </div>
                          )}
                          {(evt.description || evt.notes) && (
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '3px' }}>{evt.description || evt.notes}</div>
                          )}
                        </div>
                        {!selectedCell.isPast && (
                          <div className="flex gap-1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <button onClick={() => { if (onEditStandaloneEvent) onEditStandaloneEvent(evt); }}
                              style={drawerBtnStyle}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#eef3ff'; e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.color = '#1a73e8'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
                              <FiEdit2 size={11} /> Edit
                            </button>
                            <button onClick={async () => { await deleteEvent(evt._id); if (onRefresh) onRefresh(); }}
                              style={drawerBtnStyle}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#e74c3c'; e.currentTarget.style.color = '#e74c3c'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
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
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#bbb' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>&#x1f4c5;</div>
                <p style={{ fontSize: '15px', fontWeight: '600', color: '#999', margin: '0 0 4px' }}>No schedule on this day</p>
                <p style={{ fontSize: '13px', color: '#ccc' }}>{dayjs(selectedCell.dayKey).format('MMMM D, YYYY')}</p>
              </div>
            )}

            {/* Quick actions — Create Schedule / Event / Note (future dates only) */}
            {!selectedCell.isPast && (
              <div style={{
                padding: '16px 20px', borderTop: '1px solid #e0ddd8', background: '#fafaf8',
              }}>
                <div style={{
                  fontSize: '11px', fontWeight: '700', letterSpacing: '1.2px', color: '#888',
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
                    style={{ borderRadius: '6px', fontSize: '12px', borderColor: '#1a1a1a', color: '#1a1a1a', fontWeight: '600' }}>
                    Create Schedule
                  </Button>
                  <Button size="small" icon={<FiClock size={12} />}
                    onClick={() => {
                      handleCloseDrawer();
                      if (onQuickCreateEvent) onQuickCreateEvent(selectedCell.dayKey);
                    }}
                    style={{ borderRadius: '6px', fontSize: '12px', borderColor: '#d0ccc5', color: '#555' }}>
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
          <p style={{ fontSize: '13px', color: '#888', margin: '0 0 16px' }}>
            This date has no schedule or events. What would you like to create?
          </p>
          <div className="flex flex-col gap-2">
            <Button block size="large" icon={<FiCalendar size={15} />}
              onClick={() => {
                const dateVal = quickActionCell?.dayKey;
                handleCloseQuickAction();
                if (onQuickCreateSchedule) onQuickCreateSchedule(dateVal);
              }}
              style={{ textAlign: 'left', height: 'auto', padding: '12px 16px', borderRadius: '8px', borderColor: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Create Schedule</div>
                <div style={{ fontSize: '12px', color: '#888', fontWeight: '400' }}>Add a Prep, Shoot, Wrap, Day Off, or Travel day</div>
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
                <div style={{ fontSize: '12px', color: '#888', fontWeight: '400' }}>Add a meeting, call, or activity with time and location</div>
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
                <div style={{ fontSize: '12px', color: '#888', fontWeight: '400' }}>Add a quick note or reminder for this day</div>
              </div>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const drawerBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fff', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', color: '#888', fontSize: '11px', fontWeight: '500', padding: '3px 8px', transition: 'all 0.15s' };

export default CalendarView;
