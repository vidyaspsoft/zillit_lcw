import React from 'react';
import { Checkbox } from 'antd';
import { FiChevronDown, FiChevronRight, FiClock, FiMapPin, FiTrash2, FiEdit2, FiEye } from 'react-icons/fi';
import dayjs from 'dayjs';
import ScheduleDayDetail from './ScheduleDayDetail';

const ScheduleTable = ({
  rows = [], expandedDayId, onToggleExpand, onDeleteDay, onEditDay, onEditSchedule,
  fetchEvents, createEvent, updateEvent, deleteEvent,
  scheduleTypes = [],
  standaloneEvents = [], onDeleteEvent, onEditStandaloneEvent, onViewEvent,
  isSelectMode = false, selectedRowKeys = [], onToggleSelect, onSelectAll, onDeselectAll,
}) => {
  if (rows.length === 0 && standaloneEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>&#x1f4c5;</div>
          <p style={{ fontSize: '16px', fontWeight: '600', color: '#888', margin: '0 0 4px' }}>No schedule days yet</p>
          <p style={{ fontSize: '13px', color: '#bbb' }}>Click "Add Schedule" to create your production schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 28px 28px' }}>
      {/* Empty state for schedule + standalone events below */}
      {rows.length === 0 && standaloneEvents.length > 0 && (
        <div style={{ textAlign: 'center', padding: '30px 40px 20px', color: '#aaa' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px', opacity: 0.25 }}>&#x1f4c5;</div>
          <p style={{ fontSize: '15px', fontWeight: '600', color: '#999', margin: '0 0 4px' }}>No schedule days yet</p>
          <p style={{ fontSize: '12px', color: '#ccc' }}>Click "Add Schedule" to create your production schedule.</p>
        </div>
      )}

      {rows.length > 0 && (
      <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e0ddd8', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(180deg, #fafaf8 0%, #f4f3f0 100%)', borderBottom: '2px solid #d8d5cf' }}>
              {isSelectMode && (
                <th style={{ ...thStyle, width: '44px' }}>
                  <Checkbox checked={rows.length > 0 && selectedRowKeys.length === rows.length}
                    indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < rows.length}
                    onChange={(e) => { if (e.target.checked) onSelectAll(); else onDeselectAll(); }} />
                </th>
              )}
              <th style={thStyle}>DAY</th>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: '140px' }}>DATE</th>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: '110px' }}>TYPE</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>DETAILS</th>
              {!isSelectMode && <th style={{ ...thStyle, width: '50px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const dateStr = dayjs(row.singleDate).format('ddd, MMM DD');
              const key = `${row._id}-${row.singleDate}`;
              const isExpanded = !isSelectMode && expandedDayId === key;
              const rowKey = `${row._id}-${row.singleDate}`;
              const isSelected = selectedRowKeys.includes(rowKey);
              const isDayOff = row.typeName === 'Day Off';
              const isPast = dayjs(row.singleDate).isBefore(dayjs().startOf('day'));

              return (
                <React.Fragment key={key}>
                  {row.isNewBlock && (
                    <tr><td colSpan={isSelectMode ? 5 : 5} style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, #ccc 20%, #ccc 80%, transparent 100%)', padding: 0 }}><div style={{ height: '10px' }} /></td></tr>
                  )}

                  <tr onClick={() => { if (isSelectMode) onToggleSelect(rowKey); else onToggleExpand(row._id, row.singleDate); }}
                    style={{
                      borderBottom: isExpanded ? 'none' : '1px solid #eeece8', cursor: 'pointer',
                      background: isSelected ? '#eef3ff' : isExpanded ? '#fdfcf8' : isDayOff ? '#fbfbfb' : '#fff',
                      transition: 'all 0.2s ease',
                      opacity: isPast ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { if (!isExpanded && !isSelected) e.currentTarget.style.background = '#fafaf6'; }}
                    onMouseLeave={(e) => { if (!isExpanded && !isSelected) e.currentTarget.style.background = isDayOff ? '#fbfbfb' : '#fff'; }}>

                    {isSelectMode && (
                      <td style={{ ...tdStyle, textAlign: 'center', width: '44px', padding: '8px 10px' }}>
                        <Checkbox checked={isSelected} onChange={(e) => { e.stopPropagation(); onToggleSelect(rowKey); }} onClick={(e) => e.stopPropagation()} />
                      </td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'center', width: '60px', fontWeight: '700', fontSize: '15px', color: isDayOff ? '#ccc' : '#333', fontFamily: "'Georgia', serif" }}>
                      {isDayOff ? '—' : row.dayNumber}
                    </td>
                    <td style={{ ...tdStyle, color: '#555', fontWeight: '500' }}>{dateStr}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px 3px 6px', borderRadius: '4px', background: `${row.color}14`, border: `1px solid ${row.color}30`, fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', color: '#444' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: row.color, borderRadius: '2px', flexShrink: 0 }} />
                        {isDayOff ? 'DAY OFF' : row.typeName.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#777', fontSize: '13px', fontStyle: row.title ? 'normal' : 'italic' }}>
                      {row.title || '—'}
                    </td>
                    {!isSelectMode && (
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#bbb' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isExpanded ? '#eee' : 'transparent', transition: 'all 0.2s' }}>
                          {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                        </span>
                      </td>
                    )}
                  </tr>

                  {isExpanded && (
                    <tr><td colSpan={5} style={{ borderBottom: '2px solid #e0ddd8', background: '#fdfcf8', padding: 0 }}>
                      <ScheduleDayDetail day={row}
                        fetchEvents={fetchEvents} createEvent={createEvent} updateEvent={updateEvent} deleteEvent={deleteEvent}
                        onDelete={() => onDeleteDay(row._id, row.singleDate)} onEdit={(data) => onEditDay(row._id, data)}
                        onEditSchedule={onEditSchedule} scheduleTypes={scheduleTypes}
                        readOnly={isPast} />
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* ══════════ Standalone Events (not linked to any schedule day) ══════════ */}
      {standaloneEvents.length > 0 && !isSelectMode && (
        <div style={{
          background: '#fff', borderRadius: '10px', border: '1px solid #e0ddd8',
          overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', marginTop: '16px',
        }}>
          <div style={{
            padding: '12px 16px', background: 'linear-gradient(180deg, #fafaf8 0%, #f4f3f0 100%)',
            borderBottom: '2px solid #d8d5cf', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <FiClock size={14} style={{ color: '#888' }} />
            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', color: '#888', textTransform: 'uppercase' }}>
              Standalone Events & Notes
            </span>
            <span style={{ fontSize: '11px', color: '#bbb' }}>({standaloneEvents.length})</span>
          </div>
          {standaloneEvents.map((evt) => {
            const isEvent = evt.eventType === 'event';
            const timeStr = isEvent && evt.startDateTime
              ? (evt.fullDay ? 'Full Day' : `${dayjs(evt.startDateTime).format('h:mm A')}${evt.endDateTime ? ` – ${dayjs(evt.endDateTime).format('h:mm A')}` : ''}`)
              : '';
            const evtDate = evt.startDateTime ? dayjs(evt.startDateTime) : evt.date ? dayjs(evt.date) : null;
            const isEvtPast = evtDate && evtDate.isBefore(dayjs().startOf('day'));

            return (
              <div key={evt._id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '12px 16px', borderBottom: '1px solid #f0eeea',
                borderLeft: `3px solid ${evt.color || '#3498DB'}`,
                opacity: isEvtPast ? 0.5 : 1,
              }}>
                <div style={{ flex: 1 }}>
                  {timeStr && <div style={{ fontSize: '12px', color: '#888', fontWeight: '500', marginBottom: '2px' }}>{timeStr}</div>}
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
                <div className="flex gap-1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                  {onViewEvent && (
                    <button onClick={() => onViewEvent(evt)}
                      style={standaloneBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#27ae60'; e.currentTarget.style.color = '#27ae60'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
                      <FiEye size={11} /> View
                    </button>
                  )}
                  {!isEvtPast && onEditStandaloneEvent && (
                    <button onClick={() => onEditStandaloneEvent(evt)}
                      style={standaloneBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#eef3ff'; e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.color = '#1a73e8'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
                      <FiEdit2 size={11} /> Edit
                    </button>
                  )}
                  {!isEvtPast && onDeleteEvent && (
                    <button onClick={() => { onDeleteEvent(evt._id); }}
                      style={standaloneBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#e74c3c'; e.currentTarget.style.color = '#e74c3c'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#888'; }}>
                      <FiTrash2 size={11} /> Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const thStyle = { padding: '12px 14px', textAlign: 'center', fontWeight: '700', fontSize: '10px', letterSpacing: '1.5px', color: '#999', textTransform: 'uppercase' };
const tdStyle = { padding: '12px 14px', verticalAlign: 'middle' };
const standaloneBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fff', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', color: '#888', fontSize: '11px', fontWeight: '500', padding: '3px 8px', transition: 'all 0.15s' };

export default ScheduleTable;
