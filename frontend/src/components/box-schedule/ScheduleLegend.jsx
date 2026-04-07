import React from 'react';

const ScheduleLegend = ({ types = [] }) => {
  if (types.length === 0) return null;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      {types.map((type) => (
        <div key={type._id} className="flex items-center gap-1.5">
          <span
            style={{
              display: 'inline-block',
              width: '11px',
              height: '11px',
              backgroundColor: type.color,
              borderRadius: '2px',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
            }}
          />
          <span style={{
            fontSize: '12px',
            color: '#666',
            fontWeight: '500',
            letterSpacing: '0.3px',
          }}>
            {type.title}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ScheduleLegend;
