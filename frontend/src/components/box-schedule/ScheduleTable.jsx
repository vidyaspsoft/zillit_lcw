import React, { useState, useMemo } from 'react';
import { Checkbox, Segmented, Modal, Tag, Popover, Button } from 'antd';
import { toast } from 'react-toastify';
import { FiChevronDown, FiChevronRight, FiClock, FiMapPin, FiTrash2, FiEdit2, FiEye, FiCalendar, FiGrid } from 'react-icons/fi';
import dayjs from 'dayjs';
import ScheduleDayDetail from './ScheduleDayDetail';
import { useTheme } from '../../context/ThemeContext';

const LIST_MODE_KEY = 'box-schedule-list-mode';

const ScheduleTable = ({
  rows = [], expandedDayId, onToggleExpand, onDeleteDay, onEditDay, onEditSchedule,
  fetchEvents, createEvent, updateEvent, deleteEvent,
  scheduleTypes = [],
  standaloneEvents = [], onDeleteEvent, onEditStandaloneEvent, onViewEvent,
  isSelectMode = false, selectedRowKeys = [], onToggleSelect, onSelectAll, onDeselectAll,
  // New props for "By Schedule" view
  scheduleDays = [], onEditFullBlock, onDeleteFullBlock,
  // Consolidated content-kind filter — driven by the page-level Filter modal.
  contentFilter = 'all',
}) => {
  const { colors } = useTheme();

  const [savedListMode, setSavedListMode] = useState(() => {
    try {
      const stored = localStorage.getItem(LIST_MODE_KEY);
      return stored === 'by_schedule' ? 'by_schedule' : 'by_date';
    } catch { return 'by_date'; }
  });
  const [listMode, setListMode] = useState(savedListMode); // 'by_date' | 'by_schedule'
  const [showListDefaultPopover, setShowListDefaultPopover] = useState(false);
  const [deleteBlockConfirm, setDeleteBlockConfirm] = useState(null);

  const showSchedules = contentFilter === 'all' || contentFilter === 'schedules';
  const showEvents    = contentFilter === 'all' || contentFilter === 'events';
  const showNotes     = contentFilter === 'all' || contentFilter === 'notes';

  const visibleEvents = useMemo(
    () => standaloneEvents.filter((e) => {
      const kind = e.eventType === 'note' ? 'notes' : 'events';
      return contentFilter === 'all' || contentFilter === kind;
    }),
    [standaloneEvents, contentFilter]
  );

  // Schedule blocks sorted by start date — consumed by by_schedule view.
  const scheduleBlocks = useMemo(() => {
    return [...scheduleDays]
      .sort((a, b) => {
        const aMin = Math.min(...(a.calendarDays || []).map(Number));
        const bMin = Math.min(...(b.calendarDays || []).map(Number));
        return aMin - bMin;
      });
  }, [scheduleDays]);

  // Merged chronological list — matches iOS/Android ordering.
  // Each entry is { kind: 'schedule-row' | 'schedule-block' | 'event', sortKey, payload }.
  const mergedByDate = useMemo(() => {
    const items = [];
    if (showSchedules) {
      rows.forEach((row) => items.push({
        kind: 'schedule-row', sortKey: Number(row.singleDate), id: `s-${row._id}-${row.singleDate}`, payload: row,
      }));
    }
    visibleEvents.forEach((evt) => items.push({
      kind: 'event', sortKey: Number(evt.date || evt.startDateTime || 0), id: `e-${evt._id}`, payload: evt,
    }));
    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [rows, visibleEvents, showSchedules]);

  const mergedBySchedule = useMemo(() => {
    const items = [];
    if (showSchedules) {
      scheduleBlocks.forEach((block) => {
        const firstDate = Math.min(...(block.calendarDays || []).map(Number));
        items.push({ kind: 'schedule-block', sortKey: firstDate, id: `b-${block._id}`, payload: block });
      });
    }
    visibleEvents.forEach((evt) => items.push({
      kind: 'event', sortKey: Number(evt.date || evt.startDateTime || 0), id: `e-${evt._id}`, payload: evt,
    }));
    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [scheduleBlocks, visibleEvents, showSchedules]);

  // Inline event/note card — shared between by_date & by_schedule views.
  const renderInlineEventCard = (evt) => {
    const isEvent = evt.eventType === 'event';
    const timeStr = isEvent && evt.startDateTime
      ? (evt.fullDay ? 'Full Day' : `${dayjs(evt.startDateTime).format('h:mm A')}${evt.endDateTime ? ` – ${dayjs(evt.endDateTime).format('h:mm A')}` : ''}`)
      : '';
    const evtDate = evt.date ? dayjs(evt.date) : evt.startDateTime ? dayjs(evt.startDateTime) : null;
    const isEvtPast = evtDate && evtDate.isBefore(dayjs().startOf('day'));
    return (
      <div key={evt._id} style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 14px',
        borderLeft: `3px solid ${evt.color || '#3498DB'}`,
        background: colors.surface,
        opacity: isEvtPast ? 0.5 : 1,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.8px', color: evt.color || '#3498DB', textTransform: 'uppercase', marginBottom: '2px' }}>
            {isEvent ? 'Event' : 'Note'}
          </div>
          {timeStr && <div style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '500' }}>{timeStr}</div>}
          <div style={{ fontSize: '14px', fontWeight: '600', color: evt.textColor || colors.textBody }}>{evt.title || '(untitled)'}</div>
          {evtDate && <div style={{ fontSize: '10px', color: colors.textMuted }}>{evtDate.format('ddd, MMM D')}</div>}
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
        <div className="flex gap-1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
          {onViewEvent && (
            <button onClick={() => onViewEvent(evt)} style={standaloneBtnStyle}>
              <FiEye size={11} /> View
            </button>
          )}
          {!isEvtPast && onEditStandaloneEvent && (
            <button onClick={() => onEditStandaloneEvent(evt)} style={standaloneBtnStyle}>
              <FiEdit2 size={11} /> Edit
            </button>
          )}
          {!isEvtPast && onDeleteEvent && (
            <button onClick={() => { onDeleteEvent(evt._id); }} style={standaloneBtnStyle}>
              <FiTrash2 size={11} /> Remove
            </button>
          )}
        </div>
      </div>
    );
  };

  // Style constants (inside component to access colors)
  const thStyle = { padding: '12px 14px', textAlign: 'center', fontWeight: '700', fontSize: '10px', letterSpacing: '1.5px', color: colors.textSubtle, textTransform: 'uppercase' };
  const tdStyle = { padding: '12px 14px', verticalAlign: 'middle' };
  const standaloneBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: '3px', background: colors.surface, border: `1px solid ${colors.borderInput}`, borderRadius: '5px', cursor: 'pointer', color: colors.textMuted, fontSize: '11px', fontWeight: '500', padding: '3px 8px', transition: 'all 0.15s' };
  const blockBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: '4px', background: colors.surface, border: `1px solid ${colors.borderInput}`, borderRadius: '6px', cursor: 'pointer', color: colors.textSecondary, fontSize: '12px', fontWeight: '500', padding: '6px 12px', transition: 'all 0.15s', width: '100%', justifyContent: 'center' };

  const hasAnyData = rows.length > 0 || standaloneEvents.length > 0 || scheduleDays.length > 0;
  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div style={{ textAlign: 'center', padding: '40px', color: colors.textFaint }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>&#x1f4c5;</div>
          <p style={{ fontSize: '16px', fontWeight: '600', color: colors.textMuted, margin: '0 0 4px' }}>No schedule days yet</p>
          <p style={{ fontSize: '13px', color: colors.textPlaceholder }}>Click "Add Schedule" to create your production schedule.</p>
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
            style={{ background: colors.segmentedBg, borderRadius: '6px' }}
          />
          <Popover
            trigger="click"
            placement="bottomLeft"
            open={showListDefaultPopover}
            onOpenChange={setShowListDefaultPopover}
            content={
              <div style={{ width: '240px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary, marginBottom: '10px' }}>
                  Choose your default view
                </div>
                <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '12px', lineHeight: '1.4' }}>
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
                          border: isSelected ? `2px solid ${colors.solidDark}` : `1px solid ${colors.border}`,
                          background: isSelected ? colors.popoverSelectedBg : colors.popoverBg,
                          transition: 'all 0.15s', textAlign: 'left', width: '100%',
                        }}
                      >
                        <span style={{
                          width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                          border: isSelected ? `5px solid ${colors.solidDark}` : `2px solid ${colors.textDisabled}`,
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
      )}

      {/* ══════════ BY DATE VIEW ══════════ */}
      {listMode === 'by_date' && (
        <>
          {mergedByDate.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 40px 20px', color: colors.textFaint }}>
              <div style={{ fontSize: '40px', marginBottom: '8px', opacity: 0.25 }}>&#x1f4c5;</div>
              <p style={{ fontSize: '15px', fontWeight: '600', color: colors.textSubtle, margin: '0 0 4px' }}>Nothing to show</p>
              <p style={{ fontSize: '12px', color: colors.textDisabled }}>Adjust the filter or add a schedule/event.</p>
            </div>
          )}

          {mergedByDate.length > 0 && (
          <div style={{ background: colors.surface, borderRadius: '10px', border: `1px solid ${colors.border}`, overflow: 'hidden', boxShadow: `0 1px 6px ${colors.shadow}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: `linear-gradient(180deg, ${colors.surfaceAlt} 0%, ${colors.surfaceAlt2} 100%)`, borderBottom: `2px solid ${colors.borderMedium}` }}>
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
                {mergedByDate.map((mItem) => {
                  if (mItem.kind === 'event') {
                    const colSpan = isSelectMode ? 5 : 6;
                    return (
                      <tr key={mItem.id}>
                        <td colSpan={colSpan} style={{ padding: 0, borderBottom: `1px solid ${colors.borderLight}` }}>
                          {renderInlineEventCard(mItem.payload)}
                        </td>
                      </tr>
                    );
                  }
                  const row = mItem.payload;
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
                        <tr><td colSpan={isSelectMode ? 5 : 5} style={{ height: '1px', background: `linear-gradient(90deg, transparent 0%, ${colors.textDisabled} 20%, ${colors.textDisabled} 80%, transparent 100%)`, padding: 0 }}><div style={{ height: '10px' }} /></td></tr>
                      )}

                      <tr onClick={() => { if (isSelectMode) onToggleSelect(rowKey); else onToggleExpand(row._id, row.singleDate); }}
                        style={{
                          borderBottom: isExpanded ? 'none' : `1px solid ${colors.borderLight}`, cursor: 'pointer',
                          background: isSelected ? colors.surfaceHoverBlue : isExpanded ? colors.surfaceExpanded : isDayOff ? colors.surfaceDayOff : colors.surface,
                          transition: 'all 0.2s ease',
                          opacity: isPast ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => { if (!isExpanded && !isSelected) e.currentTarget.style.background = colors.surfaceAlt; }}
                        onMouseLeave={(e) => { if (!isExpanded && !isSelected) e.currentTarget.style.background = isDayOff ? colors.surfaceDayOff : colors.surface; }}>

                        {isSelectMode && (
                          <td style={{ ...tdStyle, textAlign: 'center', width: '44px', padding: '8px 10px' }}>
                            <Checkbox checked={isSelected} onChange={(e) => { e.stopPropagation(); onToggleSelect(rowKey); }} onClick={(e) => e.stopPropagation()} />
                          </td>
                        )}
                        <td style={{ ...tdStyle, textAlign: 'center', width: '60px', fontWeight: '700', fontSize: '15px', color: isDayOff ? colors.textDisabled : colors.textBody, fontFamily: "'Georgia', serif" }}>
                          {isDayOff ? '—' : row.dayNumber}
                        </td>
                        <td style={{ ...tdStyle, color: colors.textSecondary, fontWeight: '500' }}>{dateStr}</td>
                        <td style={tdStyle}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px 3px 6px', borderRadius: '4px', background: `${row.color}14`, border: `1px solid ${row.color}30`, fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', color: colors.textBody }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: row.color, borderRadius: '2px', flexShrink: 0 }} />
                            {isDayOff ? 'DAY OFF' : row.typeName.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: '#777', fontSize: '13px', fontStyle: row.title ? 'normal' : 'italic' }}>
                          {row.title || '—'}
                        </td>
                        {!isSelectMode && (
                          <td style={{ ...tdStyle, textAlign: 'center', color: colors.textPlaceholder }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: isExpanded ? colors.borderLight : 'transparent', transition: 'all 0.2s' }}>
                              {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                            </span>
                          </td>
                        )}
                      </tr>

                      {isExpanded && (
                        <tr><td colSpan={5} style={{ borderBottom: `2px solid ${colors.border}`, background: colors.surfaceExpanded, padding: 0 }}>
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

      {/* ══════════ BY SCHEDULE VIEW ══════════ */}
      {listMode === 'by_schedule' && (
        <div className="flex flex-col gap-3">
          {mergedBySchedule.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: colors.textFaint }}>
              <div style={{ fontSize: '40px', marginBottom: '8px', opacity: 0.25 }}>&#x1f4c5;</div>
              <p style={{ fontSize: '15px', fontWeight: '600', color: colors.textSubtle }}>Nothing to show</p>
            </div>
          )}

          {mergedBySchedule.map((mItem) => {
            if (mItem.kind === 'event') {
              return (
                <div key={mItem.id} style={{ background: colors.surface, borderRadius: '10px', border: `1px solid ${colors.border}`, overflow: 'hidden', boxShadow: `0 1px 6px ${colors.shadow}` }}>
                  {renderInlineEventCard(mItem.payload)}
                </div>
              );
            }
            const block = mItem.payload;
            const sortedDates = [...(block.calendarDays || [])].map(Number).sort((a, b) => a - b);
            const firstDate = sortedDates[0];
            const lastDate = sortedDates[sortedDates.length - 1];
            const totalDays = sortedDates.length;
            const color = block.color || colors.textDisabled;
            const typeName = block.typeName || 'Unknown';

            // Check if ALL dates in the block are in the past
            const allPast = sortedDates.every(d => dayjs(d).isBefore(dayjs().startOf('day')));
            // Check if ANY date is in the past (partially past)
            const somePast = sortedDates.some(d => dayjs(d).isBefore(dayjs().startOf('day')));

            return (
              <div key={block._id} style={{
                background: colors.surface, borderRadius: '10px', border: `1px solid ${colors.border}`,
                overflow: 'hidden', boxShadow: `0 1px 6px ${colors.shadow}`,
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
                        fontSize: '13px', fontWeight: '700', color: colors.textBody, letterSpacing: '0.5px',
                      }}>
                        <span style={{ width: '10px', height: '10px', backgroundColor: color, borderRadius: '3px' }} />
                        {typeName}
                      </span>
                      <span style={{ fontSize: '12px', color: colors.textSubtle, fontWeight: '500' }}>
                        {totalDays} day{totalDays > 1 ? 's' : ''}
                      </span>
                      {allPast && (
                        <span style={{ fontSize: '10px', color: colors.textPlaceholder, background: colors.surfaceMuted, padding: '2px 8px', borderRadius: '4px' }}>
                          Past
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    {block.title && (
                      <div style={{ fontSize: '15px', fontWeight: '600', color: colors.textPrimary, marginBottom: '6px' }}>
                        {block.title}
                      </div>
                    )}

                    {/* Date Range */}
                    <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiCalendar size={13} style={{ color: colors.textPlaceholder }} />
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
                            background: isToday ? colors.solidDark : isPastDate ? colors.surfaceMuted : `${color}10`,
                            color: isToday ? colors.surface : isPastDate ? colors.textPlaceholder : colors.textSecondary,
                            border: isToday ? `1px solid ${colors.solidDark}` : `1px solid ${isPastDate ? '#e0e0e0' : color + '30'}`,
                          }}>
                            {dayjs(d).format('MMM D')}
                          </Tag>
                        );
                      })}
                      {sortedDates.length > 14 && (
                        <Tag style={{ borderRadius: '4px', fontSize: '11px', margin: 0, color: colors.textSubtle }}>
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
                        onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHoverBlue; e.currentTarget.style.borderColor = colors.textLink; e.currentTarget.style.color = colors.textLink; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.borderInput; e.currentTarget.style.color = colors.textSecondary; }}>
                        <FiEdit2 size={12} /> Edit
                      </button>
                    )}
                    {!allPast && onDeleteFullBlock && (
                      <button onClick={() => setDeleteBlockConfirm(block)}
                        style={blockBtnStyle}
                        onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHoverRed; e.currentTarget.style.borderColor = colors.dangerBg; e.currentTarget.style.color = colors.dangerBg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.borderInput; e.currentTarget.style.color = colors.textSecondary; }}>
                        <FiTrash2 size={12} /> Delete Script
                      </button>
                    )}
                  </div>
                </div>

                {/* Block Footer — quick stats */}
                <div style={{
                  padding: '8px 20px', background: colors.surfaceAlt, borderTop: `1px solid ${colors.segmentedBg}`,
                  fontSize: '11px', color: colors.textFaint, display: 'flex', gap: '16px',
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

      {/* Delete Script Confirmation Modal */}
      <Modal open={!!deleteBlockConfirm} onCancel={() => setDeleteBlockConfirm(null)} centered width={420}
        title={<span style={{ fontSize: '16px', fontWeight: '700' }}>Delete Script</span>}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteBlockConfirm(null)}
              style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${colors.borderInput}`, background: colors.surface, cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
            <button onClick={() => {
              if (deleteBlockConfirm && onDeleteFullBlock) {
                onDeleteFullBlock(deleteBlockConfirm._id);
                setDeleteBlockConfirm(null);
              }
            }}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: colors.dangerBg, color: colors.surface, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              Delete Script
            </button>
          </div>
        }>
        {deleteBlockConfirm && (
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontSize: '14px', color: colors.textSecondary, margin: '0 0 12px' }}>
              Are you sure you want to delete this script? This will remove <strong>all {deleteBlockConfirm.calendarDays?.length || 0} day(s)</strong> and any linked events.
            </p>
            <div style={{
              padding: '10px 14px', background: colors.surfaceHoverRed, borderRadius: '8px',
              border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: deleteBlockConfirm.color, borderRadius: '3px' }} />
              <span style={{ fontWeight: '600', color: colors.textBody }}>{deleteBlockConfirm.typeName}</span>
              <span style={{ color: colors.textMuted, fontSize: '12px' }}>
                {dayjs(Math.min(...(deleteBlockConfirm.calendarDays || []).map(Number))).format('MMM D')} – {dayjs(Math.max(...(deleteBlockConfirm.calendarDays || []).map(Number))).format('MMM D, YYYY')}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: colors.dangerBg, margin: '10px 0 0', fontWeight: '500' }}>
              This action cannot be undone.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ScheduleTable;
