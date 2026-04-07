import React, { useState } from 'react';
import { Modal, Input, Button, ColorPicker } from 'antd';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

/**
 * ScheduleTypeManager — Manage schedule types (add/edit/delete custom types).
 * System types can have their color changed but cannot be renamed or deleted.
 */
const ScheduleTypeManager = ({
  open,
  onClose,
  types = [],
  onCreateType,
  onUpdateType,
  onDeleteType,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#9B59B6');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await onCreateType({ title: newTitle.trim(), color: newColor });
      setNewTitle('');
      setNewColor('#9B59B6');
    } catch {
      // Already toasted
    } finally {
      setCreating(false);
    }
  };

  const handleColorChange = async (typeId, color) => {
    try {
      await onUpdateType(typeId, { color });
    } catch {
      // Already toasted
    }
  };

  const handleDelete = async (typeId) => {
    try {
      await onDeleteType(typeId);
    } catch {
      // Already toasted
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{
          fontSize: '16px',
          fontWeight: '700',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          Schedule Types
        </span>
      }
      footer={
        <Button onClick={onClose}>Done</Button>
      }
      width={420}
      centered
    >
      <div style={{ padding: '8px 0' }}>
        {/* Existing types */}
        <div style={{ marginBottom: '16px' }}>
          {types.map((type) => (
            <div
              key={type._id}
              className="flex items-center justify-between"
              style={{
                padding: '8px 0',
                borderBottom: '1px solid #eee',
              }}
            >
              <div className="flex items-center gap-3">
                <ColorPicker
                  value={type.color}
                  onChange={(_, hex) => handleColorChange(type._id, hex)}
                  size="small"
                />
                <span style={{ fontSize: '14px', fontWeight: type.systemDefined ? '600' : '400' }}>
                  {type.title}
                </span>
                {type.systemDefined && (
                  <span style={{
                    fontSize: '10px',
                    color: '#999',
                    border: '1px solid #ddd',
                    padding: '1px 4px',
                    borderRadius: '2px',
                  }}>
                    SYSTEM
                  </span>
                )}
              </div>
              {!type.systemDefined && (
                <button
                  onClick={() => handleDelete(type._id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#999',
                    padding: '4px',
                  }}
                  title="Delete type"
                >
                  <FiTrash2 />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add new type */}
        <div style={{
          borderTop: '1px solid #ddd',
          paddingTop: '12px',
        }}>
          <label style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#555',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom: '6px',
            display: 'block',
          }}>
            Add Custom Type
          </label>
          <div className="flex gap-2 items-center">
            <ColorPicker
              value={newColor}
              onChange={(_, hex) => setNewColor(hex)}
              size="small"
            />
            <Input
              placeholder="Type name"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onPressEnter={handleCreate}
              style={{ flex: 1 }}
            />
            <Button
              icon={<FiPlus />}
              onClick={handleCreate}
              loading={creating}
              disabled={!newTitle.trim()}
              style={{ borderColor: '#000' }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ScheduleTypeManager;
