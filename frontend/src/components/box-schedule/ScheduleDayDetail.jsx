import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spin } from 'antd';
import { FiPlus, FiTrash2, FiEdit2, FiClock, FiMapPin, FiCopy } from 'react-icons/fi';
import dayjs from 'dayjs';
import CreateEventModal from './CreateEventModal';
import DuplicateScheduleModal from './DuplicateScheduleModal';

const ScheduleDayDetail = ({
  day, fetchEvents, createEvent, updateEvent, deleteEvent,
  onDelete, onEdit, onEditSchedule, scheduleTypes = [],
}) => {
  const [dayEvents, setDayEvents] = useState([]);
  const [dayNotes, setDayNotes] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [createEventTab, setCreateEventTab] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const dateStr = dayjs(day.singleDate).format('dddd, MMMM D, YYYY');

  const loadDayData = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const result = await fetchEvents({ scheduleDayId: day._id });
      const all = Array.isArray(result) ? result : result?.data || [];
      setDayEvents(all.filter((e) => e.eventType === 'event'));
      setDayNotes(all.filter((e) => e.eventType === 'note' || !e.eventType));
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

  return (
    <div style={{ padding: '20px 28px 24px', borderLeft: `3px solid ${day.color}` }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#1a1a1a', fontFamily: "'Georgia', serif" }}>
            {day.typeName === 'Day Off' ? 'Day Off' : `${day.typeName} Day ${day.dayNumber}`}
          </h3>
          <p style={{ fontSize: '13px', color: '#999', margin: '2px 0 0', fontStyle: 'italic' }}>
            {dateStr}{day.title ? ` — ${day.title}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {onEditSchedule && (
            <Button size="small" icon={<FiEdit2 size={12} />}
              onClick={(e) => { e.stopPropagation(); onEditSchedule(day); }}
              style={{ borderRadius: '6px', fontSize: '12px', borderColor: '#d0ccc5', color: '#555' }}>
              Edit
            </Button>
          )}
          <Button size="small" icon={<FiCopy size={12} />}
            onClick={(e) => { e.stopPropagation(); setShowDuplicateModal(true); }}
            style={{ borderRadius: '6px', fontSize: '12px', borderColor: '#d0ccc5', color: '#555' }}>
            Duplicate
          </Button>
          <Button size="small" icon={<FiTrash2 size={12} />} danger onClick={onDelete}
            style={{ borderRadius: '6px', fontSize: '12px' }}>
            Delete
          </Button>
        </div>
      </div>

      {loadingEvents ? (
        <div className="flex justify-center py-4"><Spin size="small" /></div>
      ) : (
        <>
          {/* ══════════ EVENTS ══════════ */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '11px', fontWeight: '700', letterSpacing: '1.2px', color: '#888',
              textTransform: 'uppercase', margin: '0 0 8px', paddingBottom: '4px', borderBottom: '1px solid #eee',
            }}>
              <div className="flex items-center gap-1.5">
                <FiClock size={13} style={{ opacity: 0.6 }} /> EVENTS
              </div>
              <Button size="small" type="link" icon={<FiPlus size={11} />}
                onClick={() => { setEditingEvent(null); setCreateEventTab('Event'); setShowCreateEvent(true); }}
                style={{ fontSize: '11px', color: '#888', padding: '0 4px', height: 'auto' }}>
                Create Event
              </Button>
            </div>

            {dayEvents.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {dayEvents.map((evt) => (
                  <div key={evt._id} style={{
                    padding: '10px 12px', background: '#fff',
                    border: '1px solid #e8e5e0', borderRadius: '6px',
                    borderLeft: `3px solid ${evt.color || '#3498DB'}`,
                  }}>
                    <div className="flex items-start justify-between gap-2">
                      <div style={{ flex: 1 }}>
                        {/* Time */}
                        <div style={{ fontSize: '12px', color: '#888', fontWeight: '500', marginBottom: '2px' }}>
                          {formatTimeRange(evt)}
                        </div>
                        {/* Title */}
                        <div style={{ fontSize: '14px', fontWeight: '600', color: evt.textColor || '#333' }}>
                          {evt.title}
                        </div>
                        {/* Location — clickable to open map */}
                        {evt.location && (
                          <div
                            onClick={() => openLocationMap(evt)}
                            style={{
                              fontSize: '12px', color: '#1a73e8', marginTop: '3px',
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
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '3px' }}>{evt.description}</div>
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
                      <div className="flex gap-1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <button onClick={() => handleEditEvent(evt)} style={actionBtnStyle}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#eef3ff'; e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.color = '#1a73e8'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
                          <FiEdit2 size={11} /> Edit
                        </button>
                        <button onClick={() => handleDeleteEvent(evt._id)} style={actionBtnStyle}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#e74c3c'; e.currentTarget.style.color = '#e74c3c'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
                          <FiTrash2 size={11} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#ccc', margin: '0', fontStyle: 'italic' }}>No events yet.</p>
            )}
          </div>

          {/* ══════════ NOTES ══════════ */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '11px', fontWeight: '700', letterSpacing: '1.2px', color: '#888',
              textTransform: 'uppercase', margin: '0 0 8px', paddingBottom: '4px', borderBottom: '1px solid #eee',
            }}>
              <div className="flex items-center gap-1.5">
                <FiEdit2 size={12} style={{ opacity: 0.6 }} /> NOTES
              </div>
              <Button size="small" type="link" icon={<FiPlus size={11} />}
                onClick={() => { setEditingEvent(null); setCreateEventTab('Note'); setShowCreateEvent(true); }}
                style={{ fontSize: '11px', color: '#888', padding: '0 4px', height: 'auto' }}>
                Create Note
              </Button>
            </div>

            {dayNotes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {dayNotes.map((note) => (
                  <div key={note._id} style={{
                    padding: '8px 12px', background: '#fff',
                    border: '1px solid #e8e5e0', borderRadius: '6px',
                    borderLeft: `3px solid ${note.color || '#95A5A6'}`,
                  }}>
                    <div className="flex items-start justify-between gap-2">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{note.title}</div>
                        {(note.notes || note.description) && (
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{note.notes || note.description}</div>
                        )}
                      </div>
                      <div className="flex gap-1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <button onClick={() => handleEditEvent(note)} style={actionBtnStyle}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#eef3ff'; e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.color = '#1a73e8'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
                          <FiEdit2 size={11} /> Edit
                        </button>
                        <button onClick={() => handleDeleteEvent(note._id)} style={actionBtnStyle}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#e74c3c'; e.currentTarget.style.color = '#e74c3c'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
                          <FiTrash2 size={11} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#ccc', margin: '0', fontStyle: 'italic' }}>No notes yet.</p>
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

      {showDuplicateModal && (
        <DuplicateScheduleModal
          open={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          day={day}
          onSuccess={() => { if (onEdit) onEdit({}); }}
        />
      )}
    </div>
  );
};

const badgeStyle = {
  fontSize: '10px', color: '#888', background: '#f5f5f5',
  padding: '1px 6px', borderRadius: '3px', border: '1px solid #eee',
};

const actionBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '3px',
  background: '#fff', border: '1px solid #ddd', borderRadius: '5px',
  cursor: 'pointer', color: '#888', fontSize: '11px', fontWeight: '500',
  padding: '3px 8px', transition: 'all 0.15s',
};

export default ScheduleDayDetail;
