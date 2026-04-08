import React, { useState, useMemo, useCallback } from 'react';
import { Drawer, Input, Select, DatePicker, InputNumber, Button, Checkbox, Tag, Tabs } from 'antd';
import { FiPlus } from 'react-icons/fi';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

/**
 * CreateScheduleModal — Drawer form for creating/editing a schedule block.
 * Pick type and dates. Four date modes:
 *   1. Set by Date Range — start date + number of days OR start date + end date
 *   2. Set by Calendar — pick multiple individual dates
 *   3. Set by Range — pick a range between two dates
 *   4. Set by Day Wise — pick days of the week (Mon, Tue, etc.) within a date range
 */
const CreateScheduleModal = ({ open, onClose, onSubmit, scheduleTypes = [], editingDay = null, onEdit }) => {
  const isSingleDayEdit = editingDay?._singleDayEdit === true;
  const isLockedStartDate = editingDay?._lockedStartDate === true;
  const editTypeId = editingDay?.typeId?._id || editingDay?.typeId || '';
  const editCalendarDays = editingDay?.calendarDays || [];
  const editStartDate = editCalendarDays.length > 0
    ? dayjs(Math.min(...editCalendarDays))
    : editingDay?.startDate ? dayjs(editingDay.startDate) : null;

  const [title, setTitle] = useState(editingDay?.title || '');
  const [typeId, setTypeId] = useState(String(editTypeId));
  const [submitting, setSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDone, setCalendarDone] = useState(editCalendarDays.length > 0);

  // Single-day edit conflict state
  const [singleDayConflict, setSingleDayConflict] = useState(null);
  const [singleDayConflictAction, setSingleDayConflictAction] = useState('replace'); // 'replace' | 'overlap'

  // New type inline creation
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#3498DB');
  const [creatingType, setCreatingType] = useState(false);

  // Date mode tabs — detect gaps in dates to auto-select Calendar tab
  const getInitialDateTab = () => {
    if (editingDay?.dateRangeType === 'by_dates') return 'calendar';
    // If editing a block with non-consecutive dates (gaps), use Calendar tab
    if (editingDay?._id && editCalendarDays.length > 1) {
      const sorted = [...editCalendarDays].map(Number).sort((a, b) => a - b);
      const oneDay = 24 * 60 * 60 * 1000;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > oneDay + 3600000) { // +1hr tolerance for DST
          return 'calendar';
        }
      }
    }
    return 'date_range';
  };
  const [dateTab, setDateTab] = useState(getInitialDateTab());

  // --- Date Range mode ---
  const [rangeSubMode, setRangeSubMode] = useState('by_days');
  const [startDate, setStartDate] = useState(editStartDate);
  const [numberOfDays, setNumberOfDays] = useState(editCalendarDays.length || editingDay?.numberOfDays || 5);
  const [endDate, setEndDate] = useState(
    editCalendarDays.length > 1 ? dayjs(Math.max(...editCalendarDays)) : null
  );

  // --- Calendar mode ---
  const [pickedDates, setPickedDates] = useState(
    editCalendarDays.length > 0 ? editCalendarDays.map((d) => dayjs(d)) : []
  );

  // --- Range Between mode ---
  const [rangeBetweenStart, setRangeBetweenStart] = useState(editStartDate);
  const [rangeBetweenEnd, setRangeBetweenEnd] = useState(
    editCalendarDays.length > 1 ? dayjs(Math.max(...editCalendarDays)) : null
  );

  // --- Day Wise mode ---
  const [dayWiseStart, setDayWiseStart] = useState(isLockedStartDate ? editStartDate : null);
  const [dayWiseEnd, setDayWiseEnd] = useState(null);
  const [selectedWeekDays, setSelectedWeekDays] = useState([]);

  const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Compute calendarDays based on active tab
  const calendarDays = useMemo(() => {
    if (dateTab === 'date_range') {
      if (rangeSubMode === 'by_days' && startDate && numberOfDays > 0) {
        const days = [];
        let current = startDate.startOf('day');
        for (let i = 0; i < numberOfDays; i++) { days.push(current.valueOf()); current = current.add(1, 'day'); }
        return days;
      }
      if (rangeSubMode === 'by_end_date' && startDate && endDate && endDate.isAfter(startDate.subtract(1, 'day'))) {
        const days = [];
        let current = startDate.startOf('day');
        const end = endDate.startOf('day');
        while (current.isBefore(end) || current.isSame(end, 'day')) { days.push(current.valueOf()); current = current.add(1, 'day'); }
        return days;
      }
      return [];
    }
    if (dateTab === 'calendar') {
      if (pickedDates.length > 0) return [...pickedDates].sort((a, b) => a.valueOf() - b.valueOf()).map((d) => d.startOf('day').valueOf());
      return [];
    }
    if (dateTab === 'range_between') {
      if (rangeBetweenStart && rangeBetweenEnd && (rangeBetweenEnd.isAfter(rangeBetweenStart) || rangeBetweenEnd.isSame(rangeBetweenStart, 'day'))) {
        const days = [];
        let current = rangeBetweenStart.startOf('day');
        const end = rangeBetweenEnd.startOf('day');
        while (current.isBefore(end) || current.isSame(end, 'day')) { days.push(current.valueOf()); current = current.add(1, 'day'); }
        return days;
      }
      return [];
    }
    if (dateTab === 'day_wise') {
      if (dayWiseStart && dayWiseEnd && selectedWeekDays.length > 0 &&
          (dayWiseEnd.isAfter(dayWiseStart) || dayWiseEnd.isSame(dayWiseStart, 'day'))) {
        const days = [];
        let current = dayWiseStart.startOf('day');
        const end = dayWiseEnd.startOf('day');
        while (current.isBefore(end) || current.isSame(end, 'day')) {
          if (selectedWeekDays.includes(current.day())) days.push(current.valueOf());
          current = current.add(1, 'day');
        }
        return days;
      }
      return [];
    }
    return [];
  }, [dateTab, rangeSubMode, startDate, numberOfDays, endDate, pickedDates, rangeBetweenStart, rangeBetweenEnd, dayWiseStart, dayWiseEnd, selectedWeekDays]);

  const getDateRangeType = () => {
    if (dateTab === 'calendar') return 'by_dates';
    return 'by_days';
  };

  // ── Single Day Edit Logic ──
  // Replace: Remove date from old block (block shrinks by 1). Create new type on that date.
  // Extend:  Remove date from old block, BUT add 1 day at the end of old block (total stays same). Create new type on that date.
  // Overlap: Keep old block unchanged. Add new type on same date (both types visible).
  const executeSingleDayEdit = async () => {
    setSubmitting(true);
    try {
      const boxScheduleService = (await import('../../services/boxScheduleService')).default;
      const singleDate = Number(editingDay.singleDate);
      const originalBlockDates = (editingDay.calendarDays || []).map(Number).sort((a, b) => a - b);
      const isSameType = typeId === String(editingDay.typeId?._id || editingDay.typeId);

      if (isSameType) {
        await onEdit(editingDay._id, { title });
        toast.success('Schedule updated successfully');
        onClose();
        if (window.__boxScheduleRefreshDays) window.__boxScheduleRefreshDays();
        return;
      }

      const action = singleDayConflictAction;
      const newTypeName = scheduleTypes.find(t => t._id === typeId)?.title || 'new type';

      if (action === 'replace') {
        // Remove this date from the original block (block shrinks by 1 day)
        await boxScheduleService.removeDates([{ id: editingDay._id, dates: [singleDate] }]);
        // Create new block with the new type
        await boxScheduleService.createDay({
          title, typeId, dateRangeType: 'by_dates',
          startDate: singleDate, endDate: singleDate,
          numberOfDays: 1, calendarDays: [singleDate],
          conflictAction: 'replace',
        });
        toast.success(`${dayjs(singleDate).format('MMM D')} changed from ${editingDay.typeName} to ${newTypeName}`);

      } else if (action === 'extend') {
        // Step 1: Remove this date from the original block
        await boxScheduleService.removeDates([{ id: editingDay._id, dates: [singleDate] }]);

        // Step 2: Fetch the UPDATED block (after removeDates) to get its current calendarDays
        let updatedBlock = null;
        try {
          const daysResp = await boxScheduleService.getDays();
          const allDays = daysResp.data || daysResp || [];
          updatedBlock = allDays.find(d => String(d._id) === String(editingDay._id));
        } catch (e) { console.error('Failed to fetch updated block:', e); }

        // Step 3: Add 1 day at the end to keep the same total count
        if (updatedBlock && updatedBlock.calendarDays && updatedBlock.calendarDays.length > 0) {
          const currentDates = updatedBlock.calendarDays.map(Number).sort((a, b) => a - b);
          const lastDate = Math.max(...currentDates);
          const extendedDate = dayjs(lastDate).add(1, 'day').startOf('day').valueOf();
          const newDates = [...currentDates, extendedDate].sort((a, b) => a - b);

          await boxScheduleService.updateDay(editingDay._id, {
            calendarDays: newDates,
            startDate: Math.min(...newDates),
            endDate: Math.max(...newDates),
            numberOfDays: newDates.length,
          });

          toast.success(
            `${dayjs(singleDate).format('MMM D')} changed to ${newTypeName}. ${editingDay.typeName} extended to ${dayjs(extendedDate).format('MMM D')} to keep the same number of days.`
          );
        } else {
          toast.success(`${dayjs(singleDate).format('MMM D')} changed to ${newTypeName}`);
        }

        // Step 4: Create new block with the new type on the removed date
        await boxScheduleService.createDay({
          title, typeId, dateRangeType: 'by_dates',
          startDate: singleDate, endDate: singleDate,
          numberOfDays: 1, calendarDays: [singleDate],
          conflictAction: 'overlap',
        });

      } else if (action === 'overlap') {
        // Don't touch original block — just add new type on the same date
        await boxScheduleService.createDay({
          title, typeId, dateRangeType: 'by_dates',
          startDate: singleDate, endDate: singleDate,
          numberOfDays: 1, calendarDays: [singleDate],
          conflictAction: 'overlap',
        });
        toast.success(`${newTypeName} added on ${dayjs(singleDate).format('MMM D')} (overlapping with ${editingDay.typeName})`);
      }

      onClose();
      if (window.__boxScheduleRefreshDays) window.__boxScheduleRefreshDays();
    } catch (err) {
      const apiMessage = err.response?.data?.message || err.message || 'Failed to update schedule';
      toast.error(apiMessage);
      console.error('Single day edit failed:', err);
    } finally { setSubmitting(false); }
  };

  const handleSubmit = async () => {
    if (isSingleDayEdit) {
      if (!typeId) return;
      await executeSingleDayEdit();
      return;
    }
    if (!typeId || calendarDays.length === 0) return;
    setSubmitting(true);
    try {
      const data = {
        title, typeId, dateRangeType: getDateRangeType(),
        startDate: Math.min(...calendarDays), endDate: Math.max(...calendarDays),
        numberOfDays: calendarDays.length, calendarDays,
      };
      if (editingDay && editingDay._id) {
        await onEdit(editingDay._id, data);
        toast.success('Schedule updated successfully');
        onClose();
      } else {
        await onSubmit(data);
        toast.success('Schedule created successfully');
      }
    } catch (err) {
      const apiMessage = err.response?.data?.message || err.message || 'Failed to save schedule';
      if (err.response?.status !== 409) toast.error(apiMessage); // Don't toast on conflict (handled by ConflictDialog)
    } finally { setSubmitting(false); }
  };

  const handlePickDate = useCallback((date) => {
    if (!date) return;
    const dateVal = date.startOf('day');
    // Don't allow removing the locked start date
    if (isLockedStartDate && editStartDate && dateVal.isSame(editStartDate, 'day')) return;
    const exists = pickedDates.some((d) => d.isSame(dateVal, 'day'));
    if (exists) setPickedDates((prev) => prev.filter((d) => !d.isSame(dateVal, 'day')));
    else setPickedDates((prev) => [...prev, dateVal]);
  }, [pickedDates, isLockedStartDate, editStartDate]);

  const removePickedDate = useCallback((dateToRemove) => {
    // Don't allow removing the locked start date
    if (isLockedStartDate && editStartDate && dateToRemove.isSame(editStartDate, 'day')) return;
    setPickedDates((prev) => prev.filter((d) => !d.isSame(dateToRemove, 'day')));
  }, [isLockedStartDate, editStartDate]);

  const toggleWeekDay = useCallback((dayIndex) => {
    setSelectedWeekDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  }, []);

  const typeOptions = useMemo(() => {
    return scheduleTypes.map((t) => ({
      value: t._id,
      label: (
        <div className="flex items-center gap-2">
          <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: t.color, borderRadius: '2px', border: '1px solid #ccc' }} />
          {t.title}
        </div>
      ),
    }));
  }, [scheduleTypes]);

  const presetColors = ['#E74C3C', '#F39C12', '#27AE60', '#3498DB', '#9B59B6', '#1ABC9C', '#E67E22', '#95A5A6', '#2C3E50', '#D35400'];

  // Disable past dates in all date pickers
  const disabledPastDate = useCallback((current) => {
    return current && current.isBefore(dayjs().startOf('day'));
  }, []);

  const tabDescriptions = {
    date_range: 'Set a start date and specify the number of consecutive days, or choose a start and end date.',
    calendar: 'Pick individual dates from the calendar. Useful for non-consecutive days like Apr 1, 5, 8, 12.',
    day_wise: 'Choose specific weekdays (e.g. Mon, Wed, Fri) within a date range.',
  };

  // ── Date Tab Content ──
  const dateTabItems = [
    {
      key: 'date_range',
      label: 'Date Range',
      children: (
        <div>
          <div style={tabDescStyle}>{tabDescriptions.date_range}</div>
          <div className="flex items-center gap-4" style={{ marginBottom: '12px' }}>
            <Checkbox checked={rangeSubMode === 'by_days'} onChange={() => setRangeSubMode('by_days')}>
              Set by Days
            </Checkbox>
            <Checkbox checked={rangeSubMode === 'by_end_date'} onChange={() => setRangeSubMode('by_end_date')}>
              Set by End Date
            </Checkbox>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <DatePicker value={startDate} onChange={setStartDate} style={{ width: '100%' }} size="large" format="MMMM D, YYYY" disabledDate={disabledPastDate} allowClear={!isLockedStartDate} disabled={isLockedStartDate} className="schedule-datepicker-clear" />
            </div>
            {rangeSubMode === 'by_days' ? (
              <div>
                <label style={labelStyle}>Number of Days</label>
                <InputNumber min={1} max={365} value={numberOfDays} onChange={setNumberOfDays} style={{ width: '100%' }} size="large" />
              </div>
            ) : (
              <div>
                <label style={labelStyle}>End Date</label>
                <DatePicker value={endDate} onChange={setEndDate} style={{ width: '100%' }} size="large" format="MMMM D, YYYY"
                  disabledDate={(d) => disabledPastDate(d) || (startDate && d.isBefore(startDate, 'day'))} allowClear className="schedule-datepicker-clear" />
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'calendar',
      label: 'Calendar',
      children: (
        <div>
          <div style={tabDescStyle}>{tabDescriptions.calendar}</div>
          <label style={labelStyle}>Click dates to select/deselect</label>
          <div style={{ marginBottom: '10px' }}>
            <DatePicker
              open={calendarOpen}
              onOpenChange={() => {}} // Prevent auto-close — only Done button closes
              onClick={() => setCalendarOpen(true)}
              onChange={(date) => { handlePickDate(date); }}
              value={null}
              style={{ width: '100%' }}
              size="large"
              disabledDate={disabledPastDate}
              placeholder={pickedDates.length > 0 ? `${pickedDates.length} date(s) selected` : 'Click to pick dates'}
              format={() => pickedDates.length > 0 ? `${pickedDates.length} date(s) selected` : ''}
              allowClear={false}
              dateRender={(current) => {
                const isSelected = pickedDates.some((d) => d.isSame(current, 'day'));
                const isLocked = isLockedStartDate && editStartDate && current.isSame(editStartDate, 'day');
                return (
                  <div className="ant-picker-cell-inner" style={{
                    backgroundColor: isLocked ? '#e67e22' : isSelected ? '#1a1a1a' : 'transparent',
                    color: (isSelected || isLocked) ? '#fff' : undefined,
                    borderRadius: '4px', fontWeight: (isSelected || isLocked) ? '700' : '400',
                  }}>
                    {current.date()}
                  </div>
                );
              }}
              renderExtraFooter={() => (
                <div style={{ padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    {pickedDates.length > 0 ? `${pickedDates.length} date(s) selected` : 'No dates selected'}
                  </span>
                  <button
                    onClick={() => { setCalendarOpen(false); setCalendarDone(true); }}
                    disabled={pickedDates.length === 0}
                    style={{
                      padding: '5px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600',
                      background: pickedDates.length > 0 ? '#1a1a1a' : '#e0ddd8',
                      color: pickedDates.length > 0 ? '#fff' : '#aaa',
                      border: 'none', cursor: pickedDates.length > 0 ? 'pointer' : 'not-allowed',
                    }}>
                    Done
                  </button>
                </div>
              )}
            />
          </div>
          {calendarDone && pickedDates.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {[...pickedDates].sort((a, b) => a.valueOf() - b.valueOf()).map((d) => {
                const isLocked = isLockedStartDate && editStartDate && d.isSame(editStartDate, 'day');
                return (
                  <Tag key={d.valueOf()} closable={!isLocked} onClose={() => removePickedDate(d)}
                    style={{ borderRadius: '4px', fontSize: '12px', margin: '2px', fontWeight: isLocked ? '700' : '400' }}>
                    {d.format('ddd, MMM D')}{isLocked ? ' (fixed)' : ''}
                  </Tag>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'day_wise',
      label: 'Day Wise',
      children: (
        <div>
          <div style={tabDescStyle}>{tabDescriptions.day_wise}</div>
          <label style={labelStyle}>Select Date Range</label>
          <div style={{ display: 'flex', gap: '12px', flexDirection: 'column', marginBottom: '14px' }}>
            <div>
              <DatePicker value={isLockedStartDate ? startDate : dayWiseStart} onChange={setDayWiseStart} placeholder="Start date"
                style={{ width: '100%' }} size="large" format="MMM D, YYYY" disabledDate={disabledPastDate} allowClear={!isLockedStartDate} disabled={isLockedStartDate} className="schedule-datepicker-clear" />
            </div>
            <div>
              <DatePicker value={dayWiseEnd} onChange={setDayWiseEnd} placeholder="End date"
                style={{ width: '100%' }} size="large" format="MMM D, YYYY"
                disabledDate={(d) => disabledPastDate(d) || (dayWiseStart && d.isBefore(dayWiseStart, 'day'))} allowClear className="schedule-datepicker-clear" />
            </div>
          </div>
          <label style={labelStyle}>Select Days</label>
          {(() => {
            const availableDays = new Set();
            if (dayWiseStart && dayWiseEnd) {
              let cur = dayWiseStart.startOf('day');
              const end = dayWiseEnd.startOf('day');
              while (cur.isBefore(end) || cur.isSame(end, 'day')) { availableDays.add(cur.day()); cur = cur.add(1, 'day'); }
            }
            const hasRange = dayWiseStart && dayWiseEnd;
            return (
              <div className="flex gap-2 flex-wrap">
                {weekDayLabels.map((label, index) => {
                  const isAvailable = !hasRange || availableDays.has(index);
                  const isSelected = selectedWeekDays.includes(index);
                  return (
                    <button key={index}
                      onClick={() => isAvailable && toggleWeekDay(index)}
                      disabled={!isAvailable}
                      style={{
                        padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600',
                        transition: 'all 0.15s',
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                        opacity: isAvailable ? 1 : 0.35,
                        background: isSelected && isAvailable ? '#1a1a1a' : '#f5f4f1',
                        color: isSelected && isAvailable ? '#fff' : '#555',
                        border: isSelected && isAvailable ? '1px solid #1a1a1a' : '1px solid #d0ccc5',
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            );
          })()}
          {dayWiseStart && dayWiseEnd && selectedWeekDays.length > 0 && calendarDays.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
              {calendarDays.length} matching day(s) in range
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={420}
      title={
        <span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {isSingleDayEdit ? 'Edit Day' : (editingDay && editingDay._id) ? 'Edit Schedule' : 'Add New Schedule'}
        </span>
      }
      footer={
        <div className="flex justify-end gap-2" style={{ padding: '4px 0' }}>
          <Button onClick={onClose} size="large" style={{ borderRadius: '6px' }}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting}
            disabled={!typeId || (!isSingleDayEdit && calendarDays.length === 0)} size="large"
            style={{ background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff', borderRadius: '6px', fontWeight: '600' }}>
            {(editingDay && editingDay._id) ? 'Save Changes' : 'Save Schedule'}
          </Button>
        </div>
      }
      styles={{ body: { padding: '16px 20px' }, footer: { borderTop: '1px solid #e0ddd8' } }}
    >
      {/* ── Type ── */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Type</label>
        <div className="flex gap-2">
          <Select placeholder="Select schedule type" value={typeId || undefined} onChange={setTypeId}
            options={typeOptions} style={{ flex: 1 }} size="large" />
          <Button icon={<FiPlus size={14} />} onClick={() => setShowNewType(!showNewType)} size="large"
            style={{ borderRadius: '6px', borderColor: '#d0ccc5' }}
            title="Add new type" />
        </div>

        {/* Inline New Type Form */}
        {showNewType && (
          <div style={{
            marginTop: '10px', padding: '12px', background: '#fafaf8', border: '1px solid #e0ddd8',
            borderRadius: '8px',
          }}>
            <label style={{ ...labelStyle, marginBottom: '6px' }}>New Type Name</label>
            <Input placeholder="e.g., Rehearsal" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)}
              size="middle" style={{ marginBottom: '10px' }} />
            <label style={{ ...labelStyle, marginBottom: '6px' }}>Color</label>
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '10px' }}>
              {presetColors.map((c) => (
                <button key={c} onClick={() => setNewTypeColor(c)}
                  style={{
                    width: '24px', height: '24px', borderRadius: '4px', backgroundColor: c,
                    border: newTypeColor === c ? '2px solid #1a1a1a' : '1px solid #ccc',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }} />
              ))}
              <input type="color" value={newTypeColor} onChange={(e) => setNewTypeColor(e.target.value)}
                style={{ width: '24px', height: '24px', border: 'none', cursor: 'pointer', padding: 0 }} />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="small" onClick={() => { setShowNewType(false); setNewTypeName(''); }}
                style={{ borderRadius: '5px', fontSize: '12px' }}>Cancel</Button>
              <Button size="small" loading={creatingType} disabled={!newTypeName.trim()}
                onClick={async () => {
                  setCreatingType(true);
                  try {
                    const boxScheduleService = (await import('../../services/boxScheduleService')).default;
                    const res = await boxScheduleService.createType({ title: newTypeName.trim(), color: newTypeColor });
                    const newId = res?.data?._id || res?.data?.data?._id;
                    if (window.__boxScheduleRefreshTypes) await window.__boxScheduleRefreshTypes();
                    if (newId) setTimeout(() => setTypeId(newId), 300);
                    setNewTypeName(''); setNewTypeColor('#3498DB'); setShowNewType(false);
                  } catch (err) {
                    console.error('Failed to create type', err);
                  } finally { setCreatingType(false); }
                }}
                style={{ borderRadius: '5px', fontSize: '12px', background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff' }}>
                Add Type
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Single Day Edit: Show locked date + action choice ── */}
      {isSingleDayEdit && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            padding: '12px 14px', background: '#f9f9f0',
            border: '1px solid #e0ddd8', borderRadius: '8px', marginBottom: '16px',
          }}>
            <label style={labelStyle}>Date</label>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>
              {dayjs(editingDay.singleDate).format('dddd, MMMM D, YYYY')}
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              Date cannot be changed when editing a single day
            </div>
          </div>

          {/* Show action choice when type is changed */}
          {typeId && typeId !== String(editingDay?.typeId?._id || editingDay?.typeId) && (
            <div>
              <label style={labelStyle}>How should this change be applied?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>

                <button onClick={() => setSingleDayConflictAction('replace')}
                  style={{
                    ...conflictOptionStyle,
                    border: singleDayConflictAction === 'replace' ? '2px solid #1a1a1a' : '1px solid #e0ddd8',
                    background: singleDayConflictAction === 'replace' ? '#f8f8f4' : '#fff',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                      border: singleDayConflictAction === 'replace' ? '6px solid #1a1a1a' : '2px solid #ccc',
                      background: '#fff',
                    }} />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#1a1a1a' }}>Replace</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', lineHeight: '1.4' }}>
                        Remove <strong>{dayjs(editingDay.singleDate).format('MMM D')}</strong> from the current <strong>{editingDay.typeName}</strong> block and assign it to the new type. The {editingDay.typeName} block will shrink from {editingDay.calendarDays?.length || 0} to {(editingDay.calendarDays?.length || 1) - 1} day(s).
                      </div>
                    </div>
                  </div>
                </button>

                <button onClick={() => setSingleDayConflictAction('extend')}
                  style={{
                    ...conflictOptionStyle,
                    border: singleDayConflictAction === 'extend' ? '2px solid #1a1a1a' : '1px solid #e0ddd8',
                    background: singleDayConflictAction === 'extend' ? '#f8f8f4' : '#fff',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                      border: singleDayConflictAction === 'extend' ? '6px solid #1a1a1a' : '2px solid #ccc',
                      background: '#fff',
                    }} />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#1a1a1a' }}>Extend</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', lineHeight: '1.4' }}>
                        Remove <strong>{dayjs(editingDay.singleDate).format('MMM D')}</strong> from <strong>{editingDay.typeName}</strong> and assign it to the new type. The <strong>{editingDay.typeName}</strong> block will extend by 1 day at the end to keep the same total ({editingDay.calendarDays?.length || 0} days).
                        {editingDay.calendarDays?.length > 1 && (() => {
                          const sorted = [...(editingDay.calendarDays || [])].map(Number).sort((a, b) => a - b);
                          const remaining = sorted.filter(d => d !== Number(editingDay.singleDate));
                          const lastDate = remaining.length > 0 ? Math.max(...remaining) : null;
                          const extendedDate = lastDate ? dayjs(lastDate).add(1, 'day') : null;
                          return extendedDate ? <><br /><em style={{ color: '#666' }}>{editingDay.typeName} will now end on {extendedDate.format('MMM D')} instead of {dayjs(Math.max(...sorted)).format('MMM D')}.</em></> : null;
                        })()}
                      </div>
                    </div>
                  </div>
                </button>

                <button onClick={() => setSingleDayConflictAction('overlap')}
                  style={{
                    ...conflictOptionStyle,
                    border: singleDayConflictAction === 'overlap' ? '2px solid #1a1a1a' : '1px solid #e0ddd8',
                    background: singleDayConflictAction === 'overlap' ? '#f8f8f4' : '#fff',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                      border: singleDayConflictAction === 'overlap' ? '6px solid #1a1a1a' : '2px solid #ccc',
                      background: '#fff',
                    }} />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#1a1a1a' }}>Overlap</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', lineHeight: '1.4' }}>
                        Keep the existing <strong>{editingDay.typeName}</strong> on this date and also add the new type. Both will appear on <strong>{dayjs(editingDay.singleDate).format('MMM D')}</strong>.
                      </div>
                    </div>
                  </div>
                </button>

              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Date Mode Tabs (hidden in single day edit) ── */}
      {!isSingleDayEdit && (
        <div style={{ marginBottom: '8px' }}>
          <label style={labelStyle}>How to set dates</label>
          <Tabs activeKey={dateTab} onChange={setDateTab} items={dateTabItems}
            size="small" style={{ marginTop: '4px' }} />
        </div>
      )}

      {/* ── Summary ── */}
      {!isSingleDayEdit && calendarDays.length > 0 && (
        <div style={{
          background: '#f9f9f0', border: '1px solid #ddd', padding: '10px 14px',
          fontSize: '13px', color: '#555', borderRadius: '6px',
        }}>
          {calendarDays.length} day(s): {dayjs(calendarDays[0]).format('MMM D')} – {dayjs(calendarDays[calendarDays.length - 1]).format('MMM D, YYYY')}
        </div>
      )}
    </Drawer>
  );
};

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' };

const conflictOptionStyle = {
  width: '100%', padding: '12px 14px', borderRadius: '8px',
  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
};

const tabDescStyle = {
  fontSize: '12px', color: '#999', marginBottom: '14px', lineHeight: '1.5',
  padding: '8px 10px', background: '#fafaf8', borderRadius: '6px',
  border: '1px solid #f0efec', fontStyle: 'italic',
};

export default CreateScheduleModal;
