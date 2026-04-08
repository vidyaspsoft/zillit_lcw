import React, { useState, useMemo, useCallback } from 'react';
import { Drawer, Input, Select, DatePicker, TimePicker, Checkbox, Button, Segmented, ColorPicker } from 'antd';
import { FiInfo } from 'react-icons/fi';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import PlacePicker from '../location-tool/PlacePicker';

const { TextArea } = Input;

const COLOR_PRESETS = [
  { value: '#3498DB', label: 'Blue' },
  { value: '#E74C3C', label: 'Red' },
  { value: '#27AE60', label: 'Green' },
  { value: '#F39C12', label: 'Orange' },
  { value: '#8E44AD', label: 'Purple' },
  { value: '#95A5A6', label: 'Gray' },
];

const REMINDER_OPTIONS = [
  { value: 'none', label: 'No reminder' },
  { value: 'at_time', label: 'At the time of event' },
  { value: '5min', label: '5 minutes before' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hr', label: '1 hour before' },
  { value: '1day', label: '1 day before' },
];

const REPEAT_OPTIONS = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const CALL_TYPE_OPTIONS = [
  { value: '', label: 'Select Call Type' },
  { value: 'meet_in_person', label: 'Meet In Person' },
  { value: 'audio', label: 'Audio Call' },
  { value: 'video', label: 'Video Call' },
];

const TIMEZONE_OPTIONS = [
  'Asia/Calcutta', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Sao_Paulo',
  'Australia/Sydney', 'Australia/Melbourne',
  'Pacific/Auckland', 'Africa/Cairo', 'Africa/Johannesburg',
  'UTC',
].map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }));

const DISTRIBUTE_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'self', label: 'Only Me' },
  { value: 'users', label: 'Specific Users' },
  { value: 'departments', label: 'Specific Departments' },
  { value: 'all_departments', label: 'All Departments' },
];

const CreateEventModal = ({ open, onClose, onSubmit, scheduleDayId, date, scheduleDays = [], defaultTab = null, editingEvent = null }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || 'Event');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Schedule day picker
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const resolvedDayId = scheduleDayId || (selectedDayKey ? selectedDayKey.split('|')[0] : null);
  const resolvedDate = date || (selectedDayKey ? Number(selectedDayKey.split('|')[1]) : null);

  const dayOptions = useMemo(() => {
    if (scheduleDayId) return [];
    const allDays = [];
    scheduleDays.forEach((day) => {
      [...(day.calendarDays || [])].sort((a, b) => a - b).forEach((cd) => allDays.push({ ...day, singleDate: cd }));
    });
    allDays.sort((a, b) => a.singleDate - b.singleDate);
    return allDays.map((d) => ({
      value: `${d._id}|${d.singleDate}`,
      label: `${dayjs(d.singleDate).format('ddd, MMM D')} — ${d.typeName}${d.title ? ` (${d.title})` : ''}`,
    }));
  }, [scheduleDays, scheduleDayId]);

  const isEditing = !!editingEvent;

  // ── Advanced fields toggle ──
  // Auto-enable advanced if any advanced field has data
  const [advancedEnabled, setAdvancedEnabled] = useState(
    editingEvent?.advancedEnabled ||
    !!(editingEvent?.timezone || editingEvent?.reminder && editingEvent.reminder !== 'none' ||
       editingEvent?.callType || editingEvent?.location || editingEvent?.repeatStatus && editingEvent.repeatStatus !== 'none' ||
       editingEvent?.textColor || editingEvent?.distributeTo || editingEvent?.organizerExcluded) ||
    false
  );

  // ── Event fields (pre-fill from editingEvent) ──
  const [title, setTitle] = useState(editingEvent?.title || '');
  const [description, setDescription] = useState(editingEvent?.description || '');
  const [startDate, setStartDate] = useState(
    editingEvent?.startDateTime ? dayjs(editingEvent.startDateTime) : date ? dayjs(date) : dayjs()
  );
  const [startTime, setStartTime] = useState(
    editingEvent?.startDateTime && !editingEvent?.fullDay ? dayjs(editingEvent.startDateTime) : null
  );
  const [endDate, setEndDate] = useState(
    editingEvent?.endDateTime ? dayjs(editingEvent.endDateTime) : date ? dayjs(date) : dayjs()
  );
  const [endTime, setEndTime] = useState(
    editingEvent?.endDateTime && !editingEvent?.fullDay ? dayjs(editingEvent.endDateTime) : null
  );
  const [fullDay, setFullDay] = useState(editingEvent?.fullDay || false);
  const [location, setLocation] = useState(editingEvent?.location || '');
  const [locationLat, setLocationLat] = useState(editingEvent?.locationLat || null);
  const [locationLng, setLocationLng] = useState(editingEvent?.locationLng || null);
  const [reminder, setReminder] = useState(editingEvent?.reminder || 'none');
  const [repeatStatus, setRepeatStatus] = useState(editingEvent?.repeatStatus || 'none');
  const [repeatEndDate, setRepeatEndDate] = useState(editingEvent?.repeatEndDate || null);
  const [color, setColor] = useState(editingEvent?.color || '#3498DB');
  const [timezone, setTimezone] = useState(editingEvent?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [callType, setCallType] = useState(editingEvent?.callType || '');
  const [textColor, setTextColor] = useState(editingEvent?.textColor || '');
  const [distributeTo, setDistributeTo] = useState(editingEvent?.distributeTo || '');
  const [organizerExcluded, setOrganizerExcluded] = useState(editingEvent?.organizerExcluded || false);

  // ── Note fields (pre-fill from editingEvent) ──
  const [noteTitle, setNoteTitle] = useState(editingEvent?.title || '');
  const [noteText, setNoteText] = useState(editingEvent?.notes || '');
  const [noteColor, setNoteColor] = useState(editingEvent?.color || '#3498DB');

  // ── Validation ──
  const validateEvent = useCallback(() => {
    const errs = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!fullDay && startTime && endTime && startDate && endDate) {
      const startDT = startDate.hour(startTime.hour()).minute(startTime.minute());
      const endDT = endDate.hour(endTime.hour()).minute(endTime.minute());
      if (endDT.isBefore(startDT)) errs.endTime = 'End must be after start';
    }
    if (endDate && startDate && endDate.isBefore(startDate, 'day')) errs.endDate = 'End date must be after start';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [resolvedDayId, scheduleDayId, title, fullDay, startDate, startTime, endDate, endTime]);

  const validateNote = useCallback(() => {
    const errs = {};
    if (!noteTitle.trim()) errs.noteTitle = 'Title is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [resolvedDayId, scheduleDayId, noteTitle]);

  const handlePlaceSelect = useCallback((place) => {
    setLocation(place.formattedAddress || place.name || '');
    setLocationLat(place.lat || null);
    setLocationLng(place.lng || null);
  }, []);

  // ── Submit ──
  const handleSubmit = async () => {
    if (activeTab === 'Event' ? !validateEvent() : !validateNote()) return;
    setSubmitting(true);
    try {
      if (activeTab === 'Event') {
        const startDT = fullDay ? startDate.startOf('day').toISOString()
          : startTime ? startDate.hour(startTime.hour()).minute(startTime.minute()).toISOString()
          : startDate.startOf('day').toISOString();
        const endDT = fullDay ? endDate.endOf('day').toISOString()
          : endTime ? endDate.hour(endTime.hour()).minute(endTime.minute()).toISOString()
          : startDT;

        await onSubmit({
          scheduleDayId: resolvedDayId, date: Number(resolvedDate), eventType: 'event',
          title: title.trim(), description, startDateTime: startDT, endDateTime: endDT,
          fullDay, location, locationLat, locationLng, reminder, repeatStatus, color,
          repeatEndDate: advancedEnabled ? repeatEndDate : null,
          timezone,
          callType, textColor,
          distributeTo, organizerExcluded, advancedEnabled,
        });
      } else {
        await onSubmit({
          scheduleDayId: resolvedDayId, date: Number(resolvedDate), eventType: 'note',
          title: noteTitle.trim(), notes: noteText, color: noteColor,
        });
      }
      onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSubmitting(false); }
  };

  const BgColorPalette = ({ value, onChange }) => (
    <div className="flex gap-2">
      {COLOR_PRESETS.map((c) => (
        <button key={c.value} onClick={() => onChange(c.value)} title={c.label}
          style={{
            width: '28px', height: '28px', borderRadius: '6px', backgroundColor: c.value,
            border: value === c.value ? '3px solid #1a1a1a' : '2px solid #ddd',
            cursor: 'pointer', transition: 'all 0.15s',
            boxShadow: value === c.value ? '0 0 0 2px #fff, 0 0 0 4px #1a1a1a' : 'none',
          }} />
      ))}
    </div>
  );

  const FieldError = ({ field }) => errors[field] ? <p style={{ color: '#e74c3c', fontSize: '12px', margin: '4px 0 0' }}>{errors[field]}</p> : null;

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={750}
      styles={{ header: { borderBottom: '1px solid #e0ddd8', background: '#fafaf8' }, body: { padding: '20px 24px', background: '#fff' } }}
      title={<span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {isEditing ? (activeTab === 'Event' ? 'Edit Event' : 'Edit Note') : (activeTab === 'Event' ? 'Add Event' : 'Add Note')}
      </span>}>
      <div>
        {/* Tab switcher */}
        {!defaultTab && (
          <Segmented options={['Event', 'Note']} value={activeTab} onChange={(v) => { setActiveTab(v); setErrors({}); }} block
            style={{ marginBottom: '20px', background: '#f0efec', borderRadius: '8px' }} />
        )}

        {/* Schedule Day picker */}
        {!scheduleDayId && (
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#fafaf8', border: '1px solid #e0ddd8', borderRadius: '8px' }}>
            <label style={labelStyle}>Link to a schedule day <span style={{ fontWeight: '400', color: '#aaa' }}>(optional)</span></label>
            <Select placeholder="Select a schedule day..." showSearch allowClear value={selectedDayKey || undefined}
              onChange={(val) => {
                setSelectedDayKey(val || null); setErrors((p) => ({ ...p, day: undefined }));
                if (val) { const d = dayjs(Number(val.split('|')[1])); setStartDate(d); setEndDate(d); }
                else { setStartDate(dayjs()); setEndDate(dayjs()); }
              }}
              options={dayOptions} style={{ width: '100%' }} size="large"
              filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
              notFoundContent={scheduleDays.length === 0 ? 'No schedule days yet. Create a schedule first.' : 'No matching days'} />
            <FieldError field="day" />
          </div>
        )}

        {activeTab === 'Event' ? (
          <div>
            {/* ═══ Info Banner — Advanced Fields Toggle ═══ */}
            <div style={{
              marginBottom: '16px', padding: '12px 14px',
              background: advancedEnabled ? '#fef9ee' : '#f8f8f6',
              border: `1px solid ${advancedEnabled ? '#f0d9a0' : '#e0ddd8'}`,
              borderRadius: '8px',
            }}>
              <Checkbox checked={advancedEnabled} onChange={(e) => setAdvancedEnabled(e.target.checked)}>
                <span style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}>Check this box for the following:</span>
              </Checkbox>
              <ul style={{ margin: '8px 0 0', paddingLeft: '28px', fontSize: '12px', color: '#666', lineHeight: '1.8' }}>
                <li>If you want this event to show up on the 'Calendar on Home Page' for the attendees</li>
                <li>If you want to set a time reminder, for the attendees</li>
                <li>If you want to set a location for the event for the attendees</li>
                <li>If you want to set a repeated event with reminder</li>
              </ul>
            </div>

            {/* Title + Full Day toggle on same row */}
            <div style={{ marginBottom: '14px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Title <span style={{ color: '#e74c3c' }}>*</span></label>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '12px', color: '#666' }}>Full Day</span>
                  <input type="checkbox" checked={fullDay}
                    onChange={(e) => { setFullDay(e.target.checked); setErrors((p) => ({ ...p, endTime: undefined, endDate: undefined })); }}
                    style={{ width: '34px', height: '18px', cursor: 'pointer', accentColor: '#1a1a1a' }} />
                </div>
              </div>
              <Input placeholder="Add Title *" value={title}
                onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: undefined })); }}
                size="large" status={errors.title ? 'error' : undefined} />
              <FieldError field="title" />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Event Description</label>
              <TextArea placeholder="Event Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            {/* Start Date/Time + End Time/Date — single row like existing web */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>Start Date</label>
                <DatePicker value={startDate} onChange={(v) => { setStartDate(v); setErrors((p) => ({ ...p, endDate: undefined, endTime: undefined })); }}
                  style={{ width: '100%' }} format="MMM D, YYYY"
                  disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))} />
              </div>
              {!fullDay && (
                <div style={{ width: '115px' }}>
                  <label style={labelStyle}>Start Time</label>
                  <TimePicker value={startTime} onChange={(v) => { setStartTime(v); setErrors((p) => ({ ...p, endTime: undefined })); }}
                    format="h:mm A" use12Hours style={{ width: '100%' }} />
                </div>
              )}
              {!fullDay && (
                <div style={{ width: '115px' }}>
                  <label style={labelStyle}>End Time</label>
                  <TimePicker value={endTime} onChange={(v) => { setEndTime(v); setErrors((p) => ({ ...p, endTime: undefined })); }}
                    format="h:mm A" use12Hours style={{ width: '100%' }}
                    status={errors.endTime ? 'error' : undefined} />
                  <FieldError field="endTime" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>End Date</label>
                <DatePicker value={endDate} onChange={(v) => { setEndDate(v); setErrors((p) => ({ ...p, endDate: undefined })); }}
                  style={{ width: '100%' }} format="MMM D, YYYY"
                  disabledDate={(current) => (current && current.isBefore(dayjs().startOf('day'))) || (startDate && current && current.isBefore(startDate, 'day'))}
                  status={errors.endDate ? 'error' : undefined} />
                <FieldError field="endDate" />
              </div>
            </div>

            {/* ═══ Repeat section — only shown when checkbox is checked ═══ */}
            {advancedEnabled && (
              <div style={{
                marginBottom: '14px', padding: '12px 14px',
                background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: '8px',
              }}>
                <div className="flex gap-3">
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Repeat</label>
                    <Select value={repeatStatus} onChange={setRepeatStatus} options={REPEAT_OPTIONS} style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Repeat End Date</label>
                    <DatePicker value={repeatEndDate ? dayjs(repeatEndDate) : null}
                      onChange={(v) => setRepeatEndDate(v ? v.toISOString() : null)}
                      placeholder="Repeat End Date"
                      disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
                      style={{ width: '100%' }} format="MMM D, YYYY" />
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Always visible fields ═══ */}

            {/* Timezone */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Select Timezone</label>
              <Select value={timezone} onChange={setTimezone} options={TIMEZONE_OPTIONS} showSearch
                style={{ width: '100%' }} size="large"
                filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())} />
            </div>

            {/* Reminder + Call Type */}
            <div className="flex gap-3 mb-3">
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Add Reminder/Alert</label>
                <Select value={reminder} onChange={setReminder} options={REMINDER_OPTIONS} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Call Type</label>
                <Select value={callType} onChange={setCallType} options={CALL_TYPE_OPTIONS} style={{ width: '100%' }} />
              </div>
            </div>

            {/* Text Color */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Select Text Color</label>
              <ColorPicker value={textColor || '#000000'} onChange={(_, hex) => setTextColor(hex)} size="middle" showText />
            </div>

            {/* Location — Google Places */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Add Location</label>
              <PlacePicker onPlaceSelect={handlePlaceSelect} initialLat={locationLat} initialLng={locationLng} initialSearch={location} />
            </div>

            {/* Distribute To */}
            <div style={{ marginBottom: '6px' }}>
              <label style={labelStyle}>Distribute To</label>
              <Select value={distributeTo} onChange={setDistributeTo} options={DISTRIBUTE_OPTIONS} style={{ width: '100%' }} size="large" />
              <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0', fontStyle: 'italic' }}>
                Select the department which you want to send the notification
              </p>
            </div>

            {/* Organizer excluded — only shown when checkbox is checked */}
            {advancedEnabled && (
              <div style={{
                marginTop: '12px', marginBottom: '14px', padding: '10px 14px',
                background: '#fef9ee', border: '1px solid #f0d9a0', borderRadius: '8px',
              }}>
                <Checkbox checked={organizerExcluded} onChange={(e) => setOrganizerExcluded(e.target.checked)}>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>The organizer will not be a part of this event.</span>
                </Checkbox>
              </div>
            )}

            {/* Background Color (always visible) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Color</label>
              <BgColorPalette value={color} onChange={setColor} />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2" style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
              <Button onClick={onClose} size="large" style={{ borderRadius: '6px' }}>Cancel</Button>
              <Button onClick={handleSubmit} loading={submitting} size="large"
                style={{ background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff', borderRadius: '6px', fontWeight: '600' }}>
                {isEditing ? 'Update Event' : 'Save Event'}
              </Button>
            </div>
          </div>
        ) : (
          /* ═══════ NOTE FORM ═══════ */
          <div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Title <span style={{ color: '#e74c3c' }}>*</span></label>
              <Input placeholder="e.g., Rain backup plan needed" value={noteTitle}
                onChange={(e) => { setNoteTitle(e.target.value); setErrors((p) => ({ ...p, noteTitle: undefined })); }}
                size="large" status={errors.noteTitle ? 'error' : undefined} />
              <FieldError field="noteTitle" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Notes</label>
              <TextArea placeholder="Details..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Color</label>
              <BgColorPalette value={noteColor} onChange={setNoteColor} />
            </div>
            <div className="flex justify-end gap-2" style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
              <Button onClick={onClose} size="large" style={{ borderRadius: '6px' }}>Cancel</Button>
              <Button onClick={handleSubmit} loading={submitting} size="large"
                style={{ background: '#1a1a1a', borderColor: '#1a1a1a', color: '#fff', borderRadius: '6px', fontWeight: '600' }}>
                {isEditing ? 'Update Note' : 'Save Note'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' };

export default CreateEventModal;
