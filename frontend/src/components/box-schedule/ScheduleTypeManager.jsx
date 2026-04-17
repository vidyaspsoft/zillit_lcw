import React, { useState } from 'react';
import { Modal, Input, Button, ColorPicker } from 'antd';
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';

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
  const { colors } = useTheme();
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#9B59B6');
  const [creating, setCreating] = useState(false);

  // Inline edit state (one row at a time)
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState('#9B59B6');
  const [savingEdit, setSavingEdit] = useState(false);

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

  const startEdit = (type) => {
    setEditingId(type._id);
    setEditTitle(type.title);
    setEditColor(type.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditColor('#9B59B6');
  };

  const saveEdit = async (type) => {
    const title = editTitle.trim();
    if (!title) return;
    const payload = {};
    if (title !== type.title) payload.title = title;
    if (editColor !== type.color) payload.color = editColor;
    if (Object.keys(payload).length === 0) {
      cancelEdit();
      return;
    }
    setSavingEdit(true);
    try {
      await onUpdateType(type._id, payload);
      cancelEdit();
    } catch {
      // Already toasted
    } finally {
      setSavingEdit(false);
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
      width={440}
      centered
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '60vh' }}>
        {/* Existing types — ONLY this section scrolls */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 24px 4px',
          minHeight: '80px',
        }}>
          {types.map((type) => {
            const isEditing = editingId === type._id;
            return (
              <div
                key={type._id}
                className="flex items-center justify-between"
                style={{
                  padding: '8px 0',
                  borderBottom: `1px solid ${colors.borderLight}`,
                  gap: '8px',
                }}
              >
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-2" style={{ flex: 1 }}>
                      <ColorPicker
                        value={editColor}
                        onChange={(_, hex) => setEditColor(hex)}
                        size="small"
                      />
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onPressEnter={() => saveEdit(type)}
                        autoFocus
                        size="small"
                        style={{ flex: 1 }}
                        disabled={type.systemDefined}
                        placeholder="Type name"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => saveEdit(type)}
                        disabled={savingEdit || !editTitle.trim()}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: savingEdit ? 'default' : 'pointer',
                          color: colors.successText,
                          padding: '4px',
                          opacity: !editTitle.trim() ? 0.4 : 1,
                        }}
                        title="Save"
                      >
                        <FiCheck size={16} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: colors.textSubtle,
                          padding: '4px',
                        }}
                        title="Cancel"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
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
                          color: colors.textSubtle,
                          border: `1px solid ${colors.borderInput}`,
                          padding: '1px 4px',
                          borderRadius: '2px',
                        }}>
                          SYSTEM
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!type.systemDefined && (
                        <button
                          onClick={() => startEdit(type)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: colors.textLink,
                            padding: '4px',
                          }}
                          title="Edit type"
                        >
                          <FiEdit2 size={15} />
                        </button>
                      )}
                      {!type.systemDefined && (
                        <button
                          onClick={() => handleDelete(type._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: colors.textSubtle,
                            padding: '4px',
                          }}
                          title="Delete type"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new type — stays pinned at the bottom, does NOT scroll */}
        <div style={{
          borderTop: `1px solid ${colors.border}`,
          padding: '14px 24px 16px',
          background: colors.surfaceAlt,
          flexShrink: 0,
        }}>
          <label style={{
            fontSize: '11px',
            fontWeight: '600',
            color: colors.textSecondary,
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
              style={{ borderColor: colors.solidDark }}
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
