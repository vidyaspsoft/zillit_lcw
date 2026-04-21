import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spin } from 'antd';
import { FiPlus, FiTrash2, FiEdit2, FiClock, FiMapPin } from 'react-icons/fi';
import dayjs from 'dayjs';
import { useTheme } from '../../context/ThemeContext';
import CreateEventModal from './CreateEventModal';

const ScheduleDayDetail = ({
  day, fetchEvents, createEvent, updateEvent, deleteEvent,
  onDelete, onEdit, onEditSchedule, scheduleTypes = [],
  readOnly = false,
}) => {
  const { colors } = useTheme();
  const [dayEvents, setDayEvents] = useState([]);
  const [dayNotes, setDayNotes] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [createEventTab, setCreateEventTab] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const dateStr = dayjs(day.singleDate).format('dddd, MMMM D, YYYY');

  const loadDayData = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const result = await fetchEvents({ scheduleDayId: day._id });
      const all = Array.isArray(result) ? result : result?.data || [];
      // Only the events/notes whose `date` matches the single day being viewed.
      // Without this filter, an event attached to a multi-day block shows on every day of the block.
      const forThisDay = all.filter((e) => Number(e.date) === Number(day.singleDate));
      setDayEvents(forThisDay.filter((e) => e.eventType === 'event'));
      setDayNotes(forThisDay.filter((e) => e.eventType === 'note' || !e.eventType));
    } catch {} finally { setLoadingEvents(false); }
  }, [day._id, fetchEvents]);

  useEffect(() => { loadDayData(); }, [loadDayData]);

  const handleCreateEvent = useCallback(async (eventData) => {
    await createEvent(eventData);
    loadDayData();
  }, [createEvent, loadDayData]);

  const handleUpdateEvent = useCallback(async (eventData) => {
    if (!editingEvent) return;
    await updateEvent(editingEvent._id, eventData);
    setEditingEvent(null);
    loadDayData();
  }, [editingEvent, updateEvent, loadDayData]);

  const handleDeleteEvent = useCallback(async (eventId) => {
    try { await deleteEvent(eventId); loadDayData(); } catch {}
  }, [deleteEvent, loadDayData]);

  const formatTimeRange = (evt) => {
    if (evt.fullDay) return 'Full Day';
    const start = evt.startDateTime ? dayjs(evt.startDateTime).format('h:mm A') : '';
    const end = evt.endDateTime ? dayjs(evt.endDateTime).format('h:mm A') : '';
    if (start && end) return `${start} – ${end}`;
    if (start) return start;
    return '';
  };

  // Open Google Maps when location is clicked
  const openLocationMap = (evt) => {
    if (evt.locationLat && evt.locationLng) {
      window.open(`https://www.google.com/maps?q=${evt.locationLat},${evt.locationLng}`, '_blank');
    } else if (evt.location) {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(evt.location)}`, '_blank');
    }
  };

  // Open edit drawer for an event
  const handleEditEvent = (evt) => {
    setEditingEvent(evt);
    setCreateEventTab(evt.eventType === 'note' ? 'Note' : 'Event');
    setShowCreateEvent(true);
  };

  const badgeStyle = {
    fontSize: '10px', color: colors.textMuted, background: colors.surfaceMuted,
    padding: '1px 6px', borderRadius: '3px', border: `1px solid ${colors.borderLight}`,
  };

  const actionBtnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    background: colors.surface, border: `1px solid ${colors.borderInput}`, borderRadius: '5px',
    cursor: 'pointer', color: colors.textMuted, fontSize: '11px', fontWeight: '500',
    padding: '3px 8px', transition: 'all 0.15s',
  };

  return (
    <div style={{ padding: '20px 28px 24px', borderLeft: `3px solid ${day.color}` }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: colors.textPrimary, fontFamily: "'Georgia', serif" }}>
            {day.typeName === 'Day Off'
              ? 'Day Off'
              : day.dayNumber != null
                ? `${day.typeName} Day ${day.dayNumber}`
                : day.typeName}
          </h3>
          <p style={{ fontSize: '13px', color: colors.textSubtle, margin: '2px 0 0', fontStyle: 'italic' }}>
            {dateStr}{day.title ? ` — ${day.title}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {!readOnly && onEditSchedule && (
            <Button size="small" icon={<FiEdit2 size={12} />}
              onClick={(e) => { e.stopPropagation(); onEditSchedule({ ...day, _singleDayEdit: true }); }}
              style={{ borderRadius: '6px', fontSize: '12px', borderColor: colors.borderButton, color: colors.textSecondary }}>
              Edit
            </Button>
          )}
          {!readOnly && (
            <Button size="small" icon={<FiTrash2 size={12} />} danger onClick={onDelete}
              style={{ borderRadius: '6px', fontSize: '12px' }}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {loadingEvents ? (
        <div className="flex justify-center py-4"><Spin size="small" /></div>
      ) : (
        <>
          {/* EVENTS */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '11px', fontWeight: '700', letterSpacing: '1.2px', color: colors.textMuted,
              textTransform: 'uppercase', margin: '0 0 8px', paddingBottom: '4px', borderBottom: `1px solid ${colors.borderLight}`,
            }}>
              <div className="flex items-center gap-1.5">
                <FiClock size={13} style={{ opacity: 0.6 }} /> EVENTS
              </div>
              {!readOnly && (
                <Button size="small" type="link" icon={<FiPlus size={11} />}
                  onClick={() => { setEditingEvent(null); setCreateEventTab('Event'); setShowCreateEvent(true); }}
                  style={{ fontSize: '11px', color: colors.textMuted, padding: '0 4px', height: 'auto' }}>
                  Create Event
                </Button>
              )}
            </div>

            {dayEvents.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {dayEvents.map((evt) => (
                  <div key={evt._id} style={{
                    padding: '10px 12px', background: colors.surface,
                    border: `1px solid ${colors.borderDashed}`, borderRadius: '6px',
                    borderLeft: `3px solid ${evt.color || '#3498DB'}`,
                  }}>
                    <div className="flex items-start justify-between gap-2">
                      <div style={{ flex: 1 }}>
                        {/* Time */}
                        <div style={{ fontSize: '12px', color: colors.textMuted, fontWeight: '500', marginBottom: '2px' }}>
                          {formatTimeRange(evt)}
                        </div>
                        {/* Title */}
                        <div style={{ fontSize: '14px', fontWeight: '600', color: evt.textColor || colors.textBody }}>
                          {evt.title}
                        </div>
                        {/* Location — clickable to open map */}
                        {evt.location && (
                          <div
                            onClick={() => openLocationMap(evt)}
                            style={{
                              fontSize: '12px', color: colors.textLink, marginTop: '3px',
                              display: 'flex', alignItems: 'flex-start', gap: '4px',
                              cursor: 'pointer', textDecoration: 'underline',
                            }}
                            title="Open in Google Maps"
                          >
                            <FiMapPin size={11} style={{ marginTop: '2px', flexShrink: 0 }} />
                            <span>{evt.location}</span>
                          </div>
                        )}
                        {/* Description */}
                        {evt.description && (
                          <div style={{ fontSize: '12px', color: colors.textSubtle, marginTop: '3px' }}>{evt.description}</div>
                        )}
                        {/* Badges: call type, reminder, timezone */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '5px' }}>
                          {evt.callType && (
                            <span style={badgeStyle}>
                              {evt.callType === 'meet_in_person' ? 'In Person' : evt.callType === 'audio' ? 'Audio Call' : 'Video Call'}
                            </span>
                          )}
                          {evt.reminder && evt.reminder !== 'none' && (
                            <span style={badgeStyle}>Reminder: {evt.reminder.replace(/_/g, ' ')}</span>
                          )}
                          {evt.timezone && (
                            <span style={badgeStyle}>{evt.timezone.replace(/_/g, ' ')}</span>
                          )}
                          {evt.repeatStatus && evt.repeatStatus !== 'none' && (
                            <span style={badgeStyle}>Repeats {evt.repeatStatus}</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      {!readOnly && (
                        <div className="flex gap-1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                          <button onClick={() => handleEditEvent(evt)} style={actionBtnStyle}
                            onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHoverBlue; e.currentTarget.style.borderColor = colors.textLink; e.currentTarget.style.color = colors.textLink; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.borderInput; e.currentTarget.style.color = colors.textMuted; }}>
                            <FiEdit2 size={11} /> Edit
                          </button>
                          <button onClick={() => handleDeleteEvent(evt._id)} style={actionBtnStyle}
                            onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHoverRed; e.currentTarget.style.borderColor = colors.dangerBg; e.currentTarget.style.color = colors.dangerBg; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.borderInput; e.currentTarget.style.color = colors.textMuted; }}>
                            <FiTrash2 size={11} /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: colors.textDisabled, margin: '0', fontStyle: 'italic' }}>No events yet.</p>
            )}
          </div>

          {/* NOTES */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '11px', fontWeight: '700', letterSpacing: '1.2px', color: colors.textMuted,
              textTransform: 'uppercase', margin: '0 0 8px', paddingBottom: '4px', borderBottom: `1px solid ${colors.borderLight}`,
            }}>
              <div className="flex items-center gap-1.5">
                <FiEdit2 size={12} style={{ opacity: 0.6 }} /> NOTES
              </div>
              {!readOnly && (
                <Button size="small" type="link" icon={<FiPlus size={11} />}
                  onClick={() => { setEditingEvent(null); setCreateEventTab('Note'); setShowCreateEvent(true); }}
                  style={{ fontSize: '11px', color: colors.textMuted, padding: '0 4px', height: 'auto' }}>
                  Create Note
                </Button>
              )}
            </div>

            {dayNotes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {dayNotes.map((note) => (
                  <div key={note._id} style={{
                    padding: '8px 12px', background: colors.surface,
                    border: `1px solid ${colors.borderDashed}`, borderRadius: '6px',
                    borderLeft: `3px solid ${note.color || '#95A5A6'}`,
                  }}>
                    <div className="flex items-start justify-between gap-2">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: colors.textBody }}>{note.title}</div>
                        {(note.notes || note.description) && (
                          <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '2px' }}>{note.notes || note.description}</div>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex gap-1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                          <button onClick={() => handleEditEvent(note)} style={actionBtnStyle}
                            onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHoverBlue; e.currentTarget.style.borderColor = colors.textLink; e.currentTarget.style.color = colors.textLink; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.borderInput; e.currentTarget.style.color = colors.textMuted; }}>
                            <FiEdit2 size={11} /> Edit
                          </button>
                          <button onClick={() => handleDeleteEvent(note._id)} style={actionBtnStyle}
                            onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHoverRed; e.currentTarget.style.borderColor = colors.dangerBg; e.currentTarget.style.color = colors.dangerBg; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.borderInput; e.currentTarget.style.color = colors.textMuted; }}>
                            <FiTrash2 size={11} /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: colors.textDisabled, margin: '0', fontStyle: 'italic' }}>No notes yet.</p>
            )}
          </div>
        </>
      )}

      {/* Create / Edit Event Drawer */}
      {showCreateEvent && (
        <CreateEventModal
          open={showCreateEvent}
          onClose={() => { setShowCreateEvent(false); setCreateEventTab(null); setEditingEvent(null); }}
          onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
          scheduleDayId={day._id}
          date={day.singleDate}
          defaultTab={createEventTab}
          editingEvent={editingEvent}
        />
      )}

    </div>
  );
};

export default ScheduleDayDetail;
