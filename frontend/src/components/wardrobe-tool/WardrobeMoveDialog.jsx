import React, { useState, useMemo, useRef } from 'react';
import { Button, Input, Select, Tag, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  ArrowRightOutlined, CloseOutlined, PictureOutlined,
  DownOutlined, UpOutlined, WarningOutlined,
} from '@ant-design/icons';

const STATUS_DESCRIPTIONS = {
  shortlist: 'Costumes reviewed and approved by designer',
  final: 'Locked costumes, ready for production',
};

const DEFAULT_STATUS_LABELS = {
  select: 'Selects',
  shortlist: 'Shortlisted',
  final: 'Finalized',
};

const DEFAULT_STATUS_ORDER = ['select', 'shortlist', 'final'];

const COSTUME_STATE_OPTIONS = [
  { value: 'hero', label: 'Hero' },
  { value: 'stunt', label: 'Stunt Double' },
  { value: 'background', label: 'Background' },
  { value: 'multiples', label: 'Multiples' },
  { value: 'aged', label: 'Aged/Distressed' },
  { value: 'clean', label: 'Clean' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'bloody', label: 'Bloody' },
  { value: 'wet', label: 'Wet' },
];

/** Inline episode add widget */
const EpisodeAdder = ({ onAdd }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  if (!editing) {
    return (
      <Tag
        className="!m-0 !border-dashed cursor-pointer"
        onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <PlusOutlined style={{ fontSize: 10 }} /> Add
      </Tag>
    );
  }

  return (
    <Input
      ref={inputRef}
      size="small"
      className="!w-20"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onPressEnter={() => {
        if (value.trim()) { onAdd(value.trim()); setValue(''); }
      }}
      onBlur={() => {
        if (value.trim()) onAdd(value.trim());
        setValue('');
        setEditing(false);
      }}
      placeholder="EP..."
    />
  );
};

/**
 * WardrobeMoveDialog -- Always shows a form when moving wardrobes.
 *
 * Step 1: Pick target status (with descriptions)
 * Step 2: Form with:
 *   - Common details (sceneNumber, costumeState)
 *   - Per-item table: each wardrobe with characterName, talentName, sceneNumber, episodes
 *   - TEMPORARY CAST VALIDATION when target is "final"
 *
 * Props:
 *  - existingWardrobes: array of wardrobe objects being moved
 */
const WardrobeMoveDialog = ({
  currentStatus, moveTarget, onMoveWardrobes, onMoveFolder,
  onComplete, onClose, existingWardrobes = [], units = [],
}) => {
  const [step, setStep] = useState('pick'); // 'pick' | 'form'
  const [targetStatus, setTargetStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [chooseCastIdx, setChooseCastIdx] = useState(null); // index of item showing ChooseCast inline

  // Build dynamic status order and labels from units prop
  const STATUS_ORDER = units.length > 0
    ? units.map((u) => u.key || u.identifier)
    : DEFAULT_STATUS_ORDER;
  const STATUS_LABELS = units.length > 0
    ? units.reduce((acc, u) => { acc[u.key || u.identifier] = u.label; return acc; }, {})
    : DEFAULT_STATUS_LABELS;

  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const availableTargets = STATUS_ORDER.slice(currentIndex + 1);

  // ── Auto-fill common details from existing data ──
  const bestWardrobe = useMemo(() => {
    if (existingWardrobes.length === 0) return {};
    const scored = existingWardrobes.map((c) => {
      let score = 0;
      if (c.sceneNumber) score++;
      if (c.costumeState) score++;
      if (c.notes) score++;
      return { c, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].c;
  }, [existingWardrobes]);

  // Common details (shared)
  const [common, setCommon] = useState({
    sceneNumber: bestWardrobe.sceneNumber || '',
    costumeState: bestWardrobe.costumeState || '',
    notes: bestWardrobe.notes || '',
  });

  // Per-item details -- group by character+talent, merge episodes from separate docs
  const [perItem, setPerItem] = useState(() => {
    const grouped = {};
    existingWardrobes.forEach((c) => {
      const key = `${c.characterName || ''}||${c.talentName || ''}`;
      if (!grouped[key]) {
        grouped[key] = {
          _ids: [c._id],
          talentName: c.talentName || '',
          characterName: c.characterName || '',
          sceneNumber: c.sceneNumber || '',
          isTemporary: c.isTemporary || false,
          episodes: c.episode ? [c.episode] : [],
        };
      } else {
        grouped[key]._ids.push(c._id);
        if (c.episode && !grouped[key].episodes.includes(c.episode)) {
          grouped[key].episodes.push(c.episode);
        }
        // If any item in the group is temporary, mark the group as temporary
        if (c.isTemporary) {
          grouped[key].isTemporary = true;
        }
      }
    });
    return Object.values(grouped);
  });

  // Check if any items have temporary cast
  const hasTemporaryCast = perItem.some((item) => item.isTemporary);
  const isFinalTarget = targetStatus === 'final';
  const blockSubmit = isFinalTarget && hasTemporaryCast;

  const updateCommon = (field, value) => {
    setCommon((prev) => ({ ...prev, [field]: value }));
  };

  const updatePerItem = (idx, field, value) => {
    setPerItem((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const addEpisodeToItem = (idx, ep) => {
    if (!ep.trim()) return;
    setPerItem((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      if (item.episodes.includes(ep.trim())) return item;
      return { ...item, episodes: [...item.episodes, ep.trim()] };
    }));
  };

  const removeEpisodeFromItem = (idx, ep) => {
    setPerItem((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, episodes: item.episodes.filter((e) => e !== ep) };
    }));
  };

  // Replace temporary cast for an item
  const handleReplaceCast = (idx, castData) => {
    setPerItem((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        talentName: castData.talentName || item.talentName,
        characterName: castData.characterName || item.characterName,
        isTemporary: false,
      };
    }));
    setChooseCastIdx(null);
  };

  // ── Pick target -> go to form ──
  const handlePickTarget = (status) => {
    setTargetStatus(status);
    setStep('form');
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (blockSubmit) return;
    setSubmitting(true);

    // Build commonDetails -- remove empty values
    const commonDetails = { ...common };
    Object.keys(commonDetails).forEach((k) => {
      if (!commonDetails[k] && commonDetails[k] !== 0) delete commonDetails[k];
    });

    // Build perItemDetails -- expand grouped items back to per-doc entries
    const perItemDetails = [];
    perItem.forEach((item) => {
      item._ids.forEach((id, i) => {
        perItemDetails.push({
          _id: id,
          talentName: item.talentName,
          characterName: item.characterName,
          sceneNumber: item.sceneNumber,
          episode: item.episodes[i] || item.episodes[0] || '',
          episodes: i === 0 ? item.episodes : undefined,
        });
      });
      // If user added more episodes than original docs, include them on the first doc
      if (item.episodes.length > item._ids.length && item._ids.length > 0) {
        perItemDetails[perItemDetails.length - item._ids.length].episodes = item.episodes;
      }
    });

    let result;
    if (moveTarget?.type === 'folder') {
      result = await onMoveFolder(
        moveTarget.folderField, moveTarget.folderValue,
        currentStatus, targetStatus,
        { commonDetails, perItemDetails }
      );
    } else {
      result = await onMoveWardrobes(
        moveTarget.ids, targetStatus,
        { commonDetails, perItemDetails }
      );
    }

    setSubmitting(false);
    if (result?.success) {
      onComplete();
    }
  };

  // ═══════════════════════════════════════════════════
  // STEP: Form -- common details + per-item table
  // ═══════════════════════════════════════════════════
  if (step === 'form') {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Move to {STATUS_LABELS[targetStatus]}</h3>
            <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* ── Temporary Cast Warning ── */}
            {isFinalTarget && hasTemporaryCast && (
              <Alert
                type="error"
                showIcon
                icon={<WarningOutlined />}
                message="Cannot move to Finalized with temporary cast"
                description="Replace all temporary cast members before moving to Finalized status."
                className="!mb-0"
              />
            )}

            {/* ── Per-Item Table (characterName, talentName, sceneNumber, episodes per wardrobe) ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Wardrobe Items ({perItem.length})</h4>
                <span className="text-xs text-gray-400">Set character, talent, scene & episodes for each</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 text-xs font-semibold text-gray-500 px-3 py-2 border-b border-gray-200">
                  Character / Talent / Scene / Episodes
                </div>
                {perItem.map((item, idx) => (
                  <div key={idx} className="px-3 py-3 border-b border-gray-100 last:border-0 space-y-2">
                    {perItem.length > 1 && (
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          Item {idx + 1}
                        </div>
                        {item.isTemporary && (
                          <Tag color="gold" className="!m-0 !text-[10px]">Temporary Cast</Tag>
                        )}
                      </div>
                    )}
                    {perItem.length === 1 && item.isTemporary && (
                      <div className="flex items-center gap-2 mb-1">
                        <Tag color="gold" className="!m-0 !text-[10px]">Temporary Cast</Tag>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 mb-0.5 block">Character</label>
                        <Input
                          size="small"
                          value={item.characterName}
                          onChange={(e) => updatePerItem(idx, 'characterName', e.target.value)}
                          placeholder="Character name"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 mb-0.5 block">Talent</label>
                        <Input
                          size="small"
                          value={item.talentName}
                          onChange={(e) => updatePerItem(idx, 'talentName', e.target.value)}
                          placeholder="Talent name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-0.5 block">Scene Number</label>
                      <Input
                        size="small"
                        value={item.sceneNumber}
                        onChange={(e) => updatePerItem(idx, 'sceneNumber', e.target.value)}
                        placeholder="Scene #"
                        className="!w-32"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-0.5 block">Episodes</label>
                      <div className="flex flex-wrap items-center gap-1">
                        {item.episodes.map((ep) => (
                          <Tag
                            key={ep}
                            closable
                            onClose={() => removeEpisodeFromItem(idx, ep)}
                            color="blue"
                            className="!m-0"
                          >
                            EP {ep}
                          </Tag>
                        ))}
                        <EpisodeAdder onAdd={(ep) => addEpisodeToItem(idx, ep)} />
                      </div>
                    </div>

                    {/* Replace button for temporary cast when moving to final */}
                    {isFinalTarget && item.isTemporary && (
                      <div className="mt-2">
                        {chooseCastIdx === idx ? (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                            <div className="text-xs font-semibold text-gray-600">Replace Temporary Cast</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-gray-400 mb-0.5 block">New Character Name</label>
                                <Input
                                  size="small"
                                  placeholder="Character name"
                                  onPressEnter={(e) => {
                                    if (e.target.value.trim()) {
                                      handleReplaceCast(idx, {
                                        characterName: e.target.value.trim(),
                                        talentName: item.talentName,
                                      });
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-400 mb-0.5 block">New Talent Name</label>
                                <Input
                                  size="small"
                                  placeholder="Talent name"
                                  onPressEnter={(e) => {
                                    if (e.target.value.trim()) {
                                      handleReplaceCast(idx, {
                                        characterName: item.characterName,
                                        talentName: e.target.value.trim(),
                                      });
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="small"
                                type="primary"
                                onClick={() => {
                                  // Mark as non-temporary with current values
                                  handleReplaceCast(idx, {
                                    characterName: item.characterName,
                                    talentName: item.talentName,
                                  });
                                }}
                              >
                                Confirm
                              </Button>
                              <Button size="small" onClick={() => setChooseCastIdx(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="small"
                            danger
                            onClick={() => setChooseCastIdx(idx)}
                            className="!text-xs"
                          >
                            Replace Temporary Cast
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Common Details (shared across all items) ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Wardrobe Details</h4>
                <span className="text-xs text-gray-400">Applied to all items</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Costume State</label>
                  <Select
                    value={common.costumeState || undefined}
                    onChange={(val) => updateCommon('costumeState', val)}
                    placeholder="Select costume state"
                    allowClear
                    className="w-full"
                    options={COSTUME_STATE_OPTIONS}
                  />
                </div>
              </div>
            </div>

            {/* ── Notes (collapsible) ── */}
            <div>
              <Button
                type="link"
                className="!px-0 !text-blue-600 !font-semibold"
                onClick={() => setShowMoreFields(!showMoreFields)}
              >
                {showMoreFields ? '\u25BC' : '\u25B6'} Additional Notes
                {common.notes && !showMoreFields && (
                  <span className="ml-2 text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Has notes</span>
                )}
              </Button>

              {showMoreFields && (
                <div className="mt-2">
                  <Input.TextArea
                    value={common.notes}
                    onChange={(e) => updateCommon('notes', e.target.value)}
                    placeholder="Additional wardrobe notes..."
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* ── Actions ── */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                disabled={blockSubmit}
              >
                {submitting ? 'Moving...' : `Move ${perItem.length} item${perItem.length > 1 ? 's' : ''} to ${STATUS_LABELS[targetStatus]}`}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // STEP: Pick -- choose target status (with descriptions)
  // ═══════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2">Move Wardrobe{moveTarget?.type === 'folder' ? ' Folder' : '(s)'}</h3>
        <p className="text-sm text-gray-500 mb-1">Current: <strong>{STATUS_LABELS[currentStatus]}</strong></p>
        <p className="text-sm text-gray-500 mb-4">Select target:</p>
        <div className="space-y-2 mb-4">
          {availableTargets.map((status) => (
            <Button
              key={status}
              block
              icon={<ArrowRightOutlined />}
              onClick={() => handlePickTarget(status)}
              className="text-left h-auto py-2"
            >
              <div className="flex flex-col items-start">
                <span>Move to {STATUS_LABELS[status]}</span>
                {STATUS_DESCRIPTIONS[status] && (
                  <span className="text-xs text-gray-400 font-normal">{STATUS_DESCRIPTIONS[status]}</span>
                )}
              </div>
            </Button>
          ))}
        </div>
        <Button block onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
};

export default WardrobeMoveDialog;
