import React, { useState, useMemo } from 'react';
import { Checkbox, Segmented, Modal, Tag, Popover, Button } from 'antd';
import { toast } from 'react-toastify';
import { FiChevronDown, FiChevronRight, FiClock, FiMapPin, FiTrash2, FiEdit2, FiEye, FiCalendar, FiGrid } from 'react-icons/fi';
import dayjs from 'dayjs';
import ScheduleDayDetail from './ScheduleDayDetail';

const LIST_MODE_KEY = 'box-schedule-list-mode';

const ScheduleTable = ({
  rows = [], expandedDayId, onToggleExpand, onDeleteDay, onEditDay, onEditSchedule,
  fetchEvents, createEvent, updateEvent, deleteEvent,
  scheduleTypes = [],
  standaloneEvents = [], onDeleteEvent, onEditStandaloneEvent, onViewEvent,
  isSelectMode = false, selectedRowKeys = [], onToggleSelect, onSelectAll, onDeselectAll,
  // New props for "By Schedule" view
  scheduleDays = [], onEditFullBlock, onDeleteFullBlock,
}) => {
  const [savedListMode, setSavedListMode] = useState(() => {
    try {
      const stored = localStorage.getItem(LIST_MODE_KEY);
      return stored === 'by_schedule' ? 'by_schedule' : 'by_date';
    } catch { return 'by_date'; }
  });
  const [listMode, setListMode] = useState(savedListMode); // 'by_date' | 'by_schedule'
  const [showListDefaultPopover, setShowListDefaultPopover] = useState(false);
  const [deleteBlockConfirm, setDeleteBlockConfirm] = useState(null);

  // Group schedule blocks for "By Schedule" view
  const scheduleBlocks = useMemo(() => {
    return [...scheduleDays]
      .sort((a, b) => {
        const aMin = Math.min(...(a.calendarDays || []).map(Number));
        const bMin = Math.min(...(b.calendarDays || []).map(Number));
        return aMin - bMin;
      });
  }, [scheduleDays]);

  if (rows.length === 0 && standaloneEvents.length === 0 && scheduleDays.length === 0) {
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

      {/* ── View Mode Toggle ── */}
      {!isSelectMode && (rows.length > 0 || scheduleDays.length > 0) && (
        <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
          <Segmented
            options={[
              { label: 'By Date', value: 'by_date' },
              { label: 'By Schedule', value: 'by_schedule' },
            ]}
            value={listMode}
            onChange={setListMode}
            size="small"
            style={{ background: '#f0efec', borderRadius: '6px' }}
          />
          <Popover
            trigger="click"
            placement="bottomLeft"
            open={showListDefaultPopover}
            onOpenChange={setShowListDefaultPopover}
            content={
              <div style={{ width: '240px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginBottom: '10px' }}>
                  Choose your default view
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px', lineHeight: '1.4' }}>
                  This view will load first every time you open the List view.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { value: 'by_date', label: 'By Date', desc: 'One row per calendar day in order' },
                    { value: 'by_schedule', label: 'By Schedule', desc: 'Grouped by each schedule block' },
                  ].map((opt) => {
                    const isSelected = savedListMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          try {
                            localStorage.setItem(LIST_MODE_KEY, opt.value);
                            setSavedListMode(opt.value);
                            setListMode(opt.value);
                            setShowListDefaultPopover(false);
                            toast.success(`${opt.label} is now your default list view.`);
                          } catch {
                            toast.error('Failed to save default view');
                          }
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
                            {opt.label}
                          </div>
                          <div style={{ fontSize: '10px', color: '#999' }}>
                            {opt.desc}
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
            <Button size="small" icon={<FiGrid size={12} />}
              style={{ borderColor: '#d0ccc5', color: '#555', borderRadius: '6px', fontSize: '11px' }}>
              Set as Default
            </Button>
          </Popover>
        </div>
      )}

      {/* ══════════ BY DATE VIEW (existing) ══════════ */}
      {listMode === 'by_date' && (
        <>
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
        </>
      )}

      {/* ══════════ BY SCHEDULE VIEW (new) ══════════ */}
      {listMode === 'by_schedule' && (
        <div className="flex flex-col gap-3">
          {scheduleBlocks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px', opacity: 0.25 }}>&#x1f4c5;</div>
              <p style={{ fontSize: '15px', fontWeight: '600', color: '#999' }}>No schedule blocks yet</p>
            </div>
          )}

          {scheduleBlocks.map((block) => {
            const sortedDates = [...(block.calendarDays || [])].map(Number).sort((a, b) => a - b);
            const firstDate = sortedDates[0];
            const lastDate = sortedDates[sortedDates.length - 1];
            const totalDays = sortedDates.length;
            const color = block.color || '#ccc';
            const typeName = block.typeName || 'Unknown';

            // Check if ALL dates in the block are in the past
            const allPast = sortedDates.every(d => dayjs(d).isBefore(dayjs().startOf('day')));
            // Check if ANY date is in the past (partially past)
            const somePast = sortedDates.some(d => dayjs(d).isBefore(dayjs().startOf('day')));

            return (
              <div key={block._id} style={{
                background: '#fff', borderRadius: '10px', border: '1px solid #e0ddd8',
                overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                borderLeft: `4px solid ${color}`,
                opacity: allPast ? 0.5 : 1,
              }}>
                {/* Block Header */}
                <div style={{
                  padding: '16px 20px', display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', gap: '12px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Type Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 12px 4px 8px', borderRadius: '6px',
                        background: `${color}14`, border: `1px solid ${color}30`,
                        fontSize: '13px', fontWeight: '700', color: '#333', letterSpacing: '0.5px',
                      }}>
                        <span style={{ width: '10px', height: '10px', backgroundColor: color, borderRadius: '3px' }} />
                        {typeName}
                      </span>
                      <span style={{ fontSize: '12px', color: '#999', fontWeight: '500' }}>
                        {totalDays} day{totalDays > 1 ? 's' : ''}
                      </span>
                      {allPast && (
                        <span style={{ fontSize: '10px', color: '#bbb', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>
                          Past
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    {block.title && (
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a', marginBottom: '6px' }}>
                        {block.title}
                      </div>
                    )}

                    {/* Date Range */}
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiCalendar size={13} style={{ color: '#bbb' }} />
                      {totalDays === 1
                        ? dayjs(firstDate).format('dddd, MMMM D, YYYY')
                        : `${dayjs(firstDate).format('MMM D')} – ${dayjs(lastDate).format('MMM D, YYYY')}`
                      }
                    </div>

                    {/* Date Tags */}
                    <div className="flex flex-wrap gap-1">
                      {sortedDates.slice(0, 14).map((d) => {
                        const isPastDate = dayjs(d).isBefore(dayjs().startOf('day'));
                        const isToday = dayjs(d).isSame(dayjs(), 'day');
                        return (
                          <Tag key={d} style={{
                            borderRadius: '4px', fontSize: '11px', margin: 0,
                            background: isToday ? '#1a1a1a' : isPastDate ? '#f5f5f5' : `${color}10`,
                            color: isToday ? '#fff' : isPastDate ? '#bbb' : '#555',
                            border: isToday ? '1px solid #1a1a1a' : `1px solid ${isPastDate ? '#e0e0e0' : color + '30'}`,
                          }}>
                            {dayjs(d).format('MMM D')}
                          </Tag>
                        );
                      })}
                      {sortedDates.length > 14 && (
                        <Tag style={{ borderRadius: '4px', fontSize: '11px', margin: 0, color: '#999' }}>
                          +{sortedDates.length - 14} more
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2" style={{ flexShrink: 0 }}>
                    {!allPast && onEditFullBlock && (
                      <button onClick={() => onEditFullBlock(block)}
                        style={blockBtnStyle}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#eef3ff'; e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.color = '#1a73e8'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#555'; }}>
                        <FiEdit2 size={12} /> Edit
                      </button>
                    )}
                    {!allPast && onDeleteFullBlock && (
                      <button onClick={() => setDeleteBlockConfirm(block)}
                        style={blockBtnStyle}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#e74c3c'; e.currentTarget.style.color = '#e74c3c'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#555'; }}>
                        <FiTrash2 size={12} /> Delete Script
                      </button>
                    )}
                  </div>
                </div>

                {/* Block Footer — quick stats */}
                <div style={{
                  padding: '8px 20px', background: '#fafaf8', borderTop: '1px solid #f0efec',
                  fontSize: '11px', color: '#aaa', display: 'flex', gap: '16px',
                }}>
                  <span>ID: {String(block._id).slice(-6)}</span>
                  <span>Created: {dayjs(block.createdAt).format('MMM D, YYYY')}</span>
                  {block.version > 1 && <span>Version: {block.version}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ Standalone Events ══════════ */}
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

      {/* Delete Script Confirmation Modal */}
      <Modal open={!!deleteBlockConfirm} onCancel={() => setDeleteBlockConfirm(null)} centered width={420}
        title={<span style={{ fontSize: '16px', fontWeight: '700' }}>Delete Script</span>}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteBlockConfirm(null)}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
            <button onClick={() => {
              if (deleteBlockConfirm && onDeleteFullBlock) {
                onDeleteFullBlock(deleteBlockConfirm._id);
                setDeleteBlockConfirm(null);
              }
            }}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#e74c3c', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              Delete Script
            </button>
          </div>
        }>
        {deleteBlockConfirm && (
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontSize: '14px', color: '#555', margin: '0 0 12px' }}>
              Are you sure you want to delete this script? This will remove <strong>all {deleteBlockConfirm.calendarDays?.length || 0} day(s)</strong> and any linked events.
            </p>
            <div style={{
              padding: '10px 14px', background: '#fef2f2', borderRadius: '8px',
              border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: deleteBlockConfirm.color, borderRadius: '3px' }} />
              <span style={{ fontWeight: '600', color: '#333' }}>{deleteBlockConfirm.typeName}</span>
              <span style={{ color: '#888', fontSize: '12px' }}>
                {dayjs(Math.min(...(deleteBlockConfirm.calendarDays || []).map(Number))).format('MMM D')} – {dayjs(Math.max(...(deleteBlockConfirm.calendarDays || []).map(Number))).format('MMM D, YYYY')}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#e74c3c', margin: '10px 0 0', fontWeight: '500' }}>
              This action cannot be undone.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

const thStyle = { padding: '12px 14px', textAlign: 'center', fontWeight: '700', fontSize: '10px', letterSpacing: '1.5px', color: '#999', textTransform: 'uppercase' };
const tdStyle = { padding: '12px 14px', verticalAlign: 'middle' };
const standaloneBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fff', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', color: '#888', fontSize: '11px', fontWeight: '500', padding: '3px 8px', transition: 'all 0.15s' };
const blockBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', color: '#555', fontSize: '12px', fontWeight: '500', padding: '6px 12px', transition: 'all 0.15s', width: '100%', justifyContent: 'center' };

export default ScheduleTable;
