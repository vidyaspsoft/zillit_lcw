import React, { useState, useMemo } from 'react';
import { Modal, Input, Select, Radio, DatePicker, InputNumber, Button } from 'antd';
import dayjs from 'dayjs';

/**
 * CreateScheduleModal — Single-step form for creating/editing a schedule block.
 * Pick type, title, and dates. No scene assignment.
 */
const CreateScheduleModal = ({ open, onClose, onSubmit, scheduleTypes = [], editingDay = null, onEdit }) => {
  const editTypeId = editingDay?.typeId?._id || editingDay?.typeId || '';
  const editCalendarDays = editingDay?.calendarDays || [];
  const editStartDate = editCalendarDays.length > 0
    ? dayjs(Math.min(...editCalendarDays))
    : editingDay?.startDate ? dayjs(editingDay.startDate) : null;

  const [title, setTitle] = useState(editingDay?.title || '');
  const [typeId, setTypeId] = useState(String(editTypeId));
  const [dateMode, setDateMode] = useState(editingDay?.dateRangeType || 'by_days');
  const [startDate, setStartDate] = useState(editStartDate);
  const [numberOfDays, setNumberOfDays] = useState(editCalendarDays.length || editingDay?.numberOfDays || 5);
  const [selectedDates, setSelectedDates] = useState(
    editCalendarDays.length > 0 ? editCalendarDays.map((d) => dayjs(d)) : []
  );
  const [submitting, setSubmitting] = useState(false);

  const calendarDays = useMemo(() => {
    if (dateMode === 'by_days' && startDate && numberOfDays > 0) {
      const days = [];
      let current = startDate.startOf('day');
      for (let i = 0; i < numberOfDays; i++) { days.push(current.valueOf()); current = current.add(1, 'day'); }
      return days;
    }
    if (dateMode === 'by_dates' && selectedDates.length > 0) {
      return selectedDates.map((d) => d.startOf('day').valueOf());
    }
    return [];
  }, [dateMode, startDate, numberOfDays, selectedDates]);

  const handleSubmit = async () => {
    if (!typeId || calendarDays.length === 0) return;
    setSubmitting(true);
    try {
      const data = {
        title, typeId, dateRangeType: dateMode,
        startDate: Math.min(...calendarDays), endDate: Math.max(...calendarDays),
        numberOfDays: calendarDays.length, calendarDays,
      };
      if (editingDay) { await onEdit(editingDay._id, data); onClose(); }
      else { await onSubmit(data); }
    } catch {} finally { setSubmitting(false); }
  };

  const typeOptions = scheduleTypes.map((t) => ({
    value: t._id,
    label: (
      <div className="flex items-center gap-2">
        <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: t.color, borderRadius: '2px', border: '1px solid #ccc' }} />
        {t.title}
      </div>
    ),
  }));

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={480} centered
      title={<span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {editingDay ? 'Edit Schedule' : 'Add New Schedule'}
      </span>}>
      <div style={{ padding: '8px 0' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Schedule Name</label>
          <Input placeholder="e.g., Main Unit Shoot Week 1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Type</label>
          <Select placeholder="Select schedule type" value={typeId || undefined} onChange={setTypeId} options={typeOptions} style={{ width: '100%' }} size="large" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>How to set dates</label>
          <Radio.Group value={dateMode} onChange={(e) => setDateMode(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Radio value="by_days">Enter start date and number of days</Radio>
            <Radio value="by_dates">Pick specific dates on calendar</Radio>
          </Radio.Group>
        </div>

        {dateMode === 'by_days' ? (
          <div className="flex gap-4 mb-4">
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start Date</label>
              <DatePicker value={startDate} onChange={setStartDate} style={{ width: '100%' }} size="large" format="MMMM D, YYYY" />
            </div>
            <div style={{ width: '120px' }}>
              <label style={labelStyle}>Number of Days</label>
              <InputNumber min={1} max={365} value={numberOfDays} onChange={setNumberOfDays} style={{ width: '100%' }} size="large" />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Select Dates</label>
            <DatePicker.RangePicker
              value={selectedDates.length >= 2 ? [selectedDates[0], selectedDates[selectedDates.length - 1]] : []}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  const days = []; let current = dates[0].startOf('day'); const end = dates[1].startOf('day');
                  while (current.isBefore(end) || current.isSame(end, 'day')) { days.push(current); current = current.add(1, 'day'); }
                  setSelectedDates(days);
                } else { setSelectedDates([]); }
              }}
              style={{ width: '100%' }} size="large" format="MMM D, YYYY"
            />
          </div>
        )}

        {calendarDays.length > 0 && (
          <div style={{ background: '#f9f9f0', border: '1px solid #ddd', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#555', borderRadius: '6px' }}>
            {calendarDays.length} day(s): {dayjs(calendarDays[0]).format('MMM D')} – {dayjs(calendarDays[calendarDays.length - 1]).format('MMM D, YYYY')}
          </div>
        )}

        <div className="flex justify-end gap-2" style={{ marginTop: '8px' }}>
          <Button onClick={onClose} size="large" style={{ borderRadius: '6px' }}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting} disabled={!typeId || calendarDays.length === 0} size="large"
            style={{ background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff', borderRadius: '6px', fontWeight: '600' }}>
            {editingDay ? 'Save Changes' : 'Save Schedule'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' };

export default CreateScheduleModal;
