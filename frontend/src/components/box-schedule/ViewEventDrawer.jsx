import React from 'react';
import { Drawer, Button } from 'antd';
import { FiClock, FiMapPin, FiCalendar, FiRepeat, FiUsers, FiEdit2 } from 'react-icons/fi';
import dayjs from 'dayjs';
import { useTheme } from '../../context/ThemeContext';

/**
 * ViewEventDrawer — Read-only detail view for an event/note.
 * Shows ALL filled fields in a clean paper-like layout.
 */
const ViewEventDrawer = ({ open, onClose, event, onEdit }) => {
  const { colors } = useTheme();
  if (!event) return null;

  const isEvent = event.eventType === 'event';
  const formatTime = () => {
    if (!isEvent) return null;
    if (event.fullDay) return 'Full Day';
    const start = event.startDateTime ? dayjs(event.startDateTime).format('h:mm A') : '';
    const end = event.endDateTime ? dayjs(event.endDateTime).format('h:mm A') : '';
    if (start && end) return `${start} \u2013 ${end}`;
    if (start) return start;
    return null;
  };

  const formatDate = () => {
    if (!isEvent) return null;
    const start = event.startDateTime ? dayjs(event.startDateTime).format('dddd, MMMM D, YYYY') : '';
    const end = event.endDateTime ? dayjs(event.endDateTime).format('dddd, MMMM D, YYYY') : '';
    if (start && end && start !== end) return `${start} \u2192 ${end}`;
    return start;
  };

  const openMap = () => {
    if (event.locationLat && event.locationLng) {
      window.open(`https://www.google.com/maps?q=${event.locationLat},${event.locationLng}`, '_blank');
    } else if (event.location) {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(event.location)}`, '_blank');
    }
  };

  const callTypeLabel = { meet_in_person: 'Meet In Person', audio: 'Audio Call', video: 'Video Call' };
  const reminderLabel = { none: '', at_time: 'At the time of event', '5min': '5 minutes before', '15min': '15 minutes before', '30min': '30 minutes before', '1hr': '1 hour before', '1day': '1 day before' };
  const distributeLabel = { self: 'Only Me', users: 'Specific Users', departments: 'Specific Departments', all_departments: 'All Departments' };

  const DetailRow = ({ icon: Icon, label, value, onClick, linkStyle }) => {
    if (!value) return null;
    return (
      <div style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: `1px solid ${colors.surfaceAlt2}` }}>
        <div style={{ width: '24px', display: 'flex', justifyContent: 'center', paddingTop: '2px' }}>
          <Icon size={15} style={{ color: colors.textFaint }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: colors.textFaint, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
          <div onClick={onClick} style={{
            fontSize: '14px', color: linkStyle ? colors.textLink : colors.textBody,
            cursor: onClick ? 'pointer' : 'default',
            textDecoration: onClick ? 'underline' : 'none',
          }}>{value}</div>
        </div>
      </div>
    );
  };

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={480}
      styles={{
        header: { borderBottom: `1px solid ${colors.border}`, background: colors.drawerHeaderBg },
        body: { padding: 0, background: colors.drawerBodyBg },
      }}
      title={<span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {isEvent ? 'Event Details' : 'Note Details'}
      </span>}>

      {/* Header with color and title */}
      <div style={{
        padding: '20px 24px', borderBottom: `1px solid ${colors.borderLight}`,
        borderLeft: `4px solid ${event.color || '#3498DB'}`,
        background: colors.surfaceAlt,
      }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: event.textColor || colors.textPrimary, fontFamily: "'Georgia', serif" }}>
          {event.title}
        </div>
        {isEvent && formatTime() && (
          <div style={{ fontSize: '14px', color: colors.textMuted, marginTop: '4px', fontWeight: '500' }}>
            {formatTime()}
          </div>
        )}
        {isEvent && formatDate() && (
          <div style={{ fontSize: '13px', color: colors.textFaint, marginTop: '2px' }}>
            {formatDate()}
          </div>
        )}
      </div>

      {/* Detail rows */}
      <div style={{ padding: '4px 24px 20px' }}>
        {/* Description / Notes */}
        {(event.description || event.notes) && (
          <DetailRow icon={FiEdit2} label={isEvent ? 'Description' : 'Notes'} value={event.description || event.notes} />
        )}

        {/* Location */}
        {event.location && (
          <DetailRow icon={FiMapPin} label="Location" value={event.location} onClick={openMap} linkStyle />
        )}

        {/* Call Type */}
        {event.callType && (
          <DetailRow icon={FiUsers} label="Call Type" value={callTypeLabel[event.callType] || event.callType} />
        )}

        {/* Timezone */}
        {event.timezone && (
          <DetailRow icon={FiClock} label="Timezone" value={event.timezone.replace(/_/g, ' ')} />
        )}

        {/* Reminder */}
        {event.reminder && event.reminder !== 'none' && (
          <DetailRow icon={FiClock} label="Reminder" value={reminderLabel[event.reminder] || event.reminder} />
        )}

        {/* Repeat */}
        {event.repeatStatus && event.repeatStatus !== 'none' && (
          <DetailRow icon={FiRepeat} label="Repeat" value={`${event.repeatStatus.charAt(0).toUpperCase() + event.repeatStatus.slice(1)}${event.repeatEndDate ? ` until ${dayjs(event.repeatEndDate).format('MMM D, YYYY')}` : ''}`} />
        )}

        {/* Distribute To */}
        {event.distributeTo && (
          <DetailRow icon={FiUsers} label="Distribute To" value={distributeLabel[event.distributeTo] || event.distributeTo} />
        )}

        {/* Full Day */}
        {event.fullDay && (
          <DetailRow icon={FiCalendar} label="Duration" value="Full Day Event" />
        )}

        {/* Organizer */}
        {event.organizerExcluded && (
          <DetailRow icon={FiUsers} label="Organizer" value="The organizer will not be a part of this event" />
        )}

        {/* Created by */}
        {event.createdBy?.name && (
          <DetailRow icon={FiUsers} label="Created By" value={`${event.createdBy.name}${event.createdAt ? ` \u2014 ${dayjs(event.createdAt).format('MMM D, YYYY h:mm A')}` : ''}`} />
        )}
      </div>

      {/* Edit button */}
      {onEdit && (
        <div style={{ padding: '0 24px 20px', borderTop: `1px solid ${colors.borderLight}`, paddingTop: '16px' }}>
          <Button icon={<FiEdit2 size={13} />} onClick={() => { onClose(); onEdit(event); }} block size="large"
            style={{ borderRadius: '6px', borderColor: colors.solidDark, color: colors.solidDark, fontWeight: '600' }}>
            Edit This {isEvent ? 'Event' : 'Note'}
          </Button>
        </div>
      )}
    </Drawer>
  );
};

export default ViewEventDrawer;
