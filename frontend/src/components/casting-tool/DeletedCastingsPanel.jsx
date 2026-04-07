import React from 'react';
import { Button, Empty } from 'antd';
import { CloseOutlined, UndoOutlined, UserOutlined } from '@ant-design/icons';

const DeletedCastingsPanel = ({ castings, onRestore, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Deleted Castings</h3>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {(!castings || castings.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <UserOutlined style={{ fontSize: 36 }} />
              <p className="mt-3">No deleted castings</p>
            </div>
          ) : (
            <div className="space-y-2">
              {castings.map((casting) => (
                <div key={casting._id} className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="min-w-0">
                    <strong className="text-sm block truncate">
                      {casting.characterName || casting.talentName || 'Unnamed'}
                    </strong>
                    <span className="text-xs text-gray-400">
                      {casting.talentName && casting.characterName && `${casting.talentName} · `}
                      {casting.episode && `EP ${casting.episode} · `}
                      {casting.status} · Deleted {new Date(casting.deleted).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    size="small"
                    icon={<UndoOutlined />}
                    onClick={() => onRestore(casting._id)}
                    className="btn-success"
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeletedCastingsPanel;
