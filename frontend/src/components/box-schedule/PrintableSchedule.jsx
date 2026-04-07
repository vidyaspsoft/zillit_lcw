import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
import dayjs from 'dayjs';

/**
 * PrintableSchedule — Full expanded schedule for printing.
 * Renders ALL days with their events and notes.
 */
const PrintableSchedule = ({ rows = [], scheduleTypes = [], fetchEvents, onReady }) => {
  const [allEvents, setAllEvents] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const eventsMap = {};
      for (const row of rows) {
        const key = `${row._id}-${row.singleDate}`;
        try {
          const result = await fetchEvents({ scheduleDayId: row._id });
          const all = Array.isArray(result) ? result : result?.data || [];
          eventsMap[key] = { events: all.filter((e) => e.eventType === 'event'), notes: all.filter((e) => e.eventType === 'note' || !e.eventType) };
        } catch { eventsMap[key] = { events: [], notes: [] }; }
      }
      setAllEvents(eventsMap);
      setLoading(false);
      if (onReady) setTimeout(() => onReady(), 300);
    };
    if (rows.length > 0) loadAll();
    else { setLoading(false); if (onReady) setTimeout(() => onReady(), 100); }
  }, [rows, fetchEvents, onReady]);

  if (loading) {
    return (
      <div className="print-loading" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, flexDirection: 'column', gap: '12px' }}>
        <Spin size="large" />
        <p style={{ fontSize: '14px', color: '#666' }}>Loading schedule data for print...</p>
      </div>
    );
  }

  const typeCounters = {};

  return (
    <div className="printable-schedule" style={{ background: '#fff' }}>
      <div style={{ textAlign: 'center', paddingBottom: '14px', marginBottom: '20px', borderBottom: '3px double #000' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '4px', textTransform: 'uppercase', margin: '0 0 4px', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
          Production Schedule
        </h1>
        <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Printed: {dayjs().format('MMMM D, YYYY — h:mm A')}</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', fontSize: '11px', color: '#555' }}>
        {scheduleTypes.map((t) => (
          <span key={t._id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: t.color, border: '1px solid #999' }} />
            {t.title}
          </span>
        ))}
      </div>

      {rows.map((row) => {
        if (!typeCounters[row.typeName]) typeCounters[row.typeName] = 0;
        typeCounters[row.typeName]++;
        const dayNumber = typeCounters[row.typeName];
        const key = `${row._id}-${row.singleDate}`;
        const dayData = allEvents[key] || { events: [], notes: [] };
        const dateStr = dayjs(row.singleDate).format('dddd, MMMM D, YYYY');
        const isDayOff = row.typeName === 'Day Off';

        return (
          <div key={key} className="print-day-block" style={{ marginBottom: '4px' }}>
            {row.isNewBlock && <div style={{ borderTop: '2px solid #000', marginTop: '12px', marginBottom: '8px' }} />}

            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '12px', padding: '8px 12px',
              background: isDayOff ? '#f5f5f5' : `${row.color}0A`,
              borderLeft: `4px solid ${row.color}`, borderBottom: '1px solid #ddd',
            }}>
              <span style={{ fontWeight: '800', fontSize: '16px', fontFamily: "'Georgia', serif", minWidth: '36px', color: isDayOff ? '#aaa' : '#333' }}>
                {isDayOff ? '—' : dayNumber}
              </span>
              <span style={{ fontWeight: '500', fontSize: '13px', color: '#555', minWidth: '180px' }}>{dateStr}</span>
              <span style={{ fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px', color: '#444' }}>
                {isDayOff ? 'DAY OFF' : row.typeName.toUpperCase()}
              </span>
              <span style={{ fontSize: '13px', color: '#666', flex: 1 }}>{row.title || ''}</span>
            </div>

            {/* Events + Notes */}
            {(dayData.events.length > 0 || dayData.notes.length > 0) && (
              <div style={{ padding: '8px 12px 8px 52px', fontSize: '12px', borderBottom: '1px solid #eee' }}>
                {dayData.events.length > 0 && (
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', color: '#888', textTransform: 'uppercase', marginBottom: '3px' }}>EVENTS</div>
                    {dayData.events.map((evt) => (
                      <div key={evt._id} style={{ marginBottom: '3px', paddingLeft: '8px', borderLeft: `2px solid ${evt.color || '#3498DB'}` }}>
                        <span style={{ fontWeight: '600' }}>
                          {evt.fullDay ? 'Full Day' : evt.startDateTime ? `${dayjs(evt.startDateTime).format('h:mm A')}${evt.endDateTime ? ` – ${dayjs(evt.endDateTime).format('h:mm A')}` : ''}` : ''}
                        </span>
                        {' '}{evt.title}
                        {evt.location && <span style={{ color: '#888' }}> — {evt.location}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {dayData.notes.length > 0 && (
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', color: '#888', textTransform: 'uppercase', marginBottom: '3px' }}>NOTES</div>
                    <ul style={{ margin: '0', paddingLeft: '16px', fontSize: '11px', color: '#444' }}>
                      {dayData.notes.map((note) => (
                        <li key={note._id} style={{ marginBottom: '2px' }}>
                          <strong>{note.title}</strong>
                          {note.notes && ` — ${note.notes}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: '24px', paddingTop: '8px', borderTop: '1px solid #ccc', fontSize: '10px', color: '#aaa', textAlign: 'center' }}>
        Generated by Zillit — {dayjs().format('MMMM D, YYYY')}
      </div>
    </div>
  );
};

export default PrintableSchedule;
