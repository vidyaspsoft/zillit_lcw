import React from 'react';

const MAX_VISIBLE = 5;

const ScheduleLegend = ({ types = [], onManageTypes }) => {
  if (types.length === 0) return null;

  const visibleTypes = types.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, types.length - MAX_VISIBLE);

  return (
    <div className="flex items-center gap-5 flex-wrap">
      {visibleTypes.map((type) => (
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

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={onManageTypes}
          title="Manage all schedule types"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: '12px',
            border: '1px solid #d0ccc5',
            background: '#fafaf8',
            color: '#555',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            letterSpacing: '0.3px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1a1a1a';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = '#1a1a1a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fafaf8';
            e.currentTarget.style.color = '#555';
            e.currentTarget.style.borderColor = '#d0ccc5';
          }}
        >
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
};

export default ScheduleLegend;
