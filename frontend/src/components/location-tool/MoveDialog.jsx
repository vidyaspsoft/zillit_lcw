import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Select, Tag, Spin } from 'antd';
import {
  ArrowRightOutlined, CloseOutlined, PictureOutlined,
  DownOutlined, UpOutlined, FileTextOutlined,
} from '@ant-design/icons';
import locationToolService from '../../services/locationToolService';
import { FiChevronDown, FiChevronUp, FiImage } from 'react-icons/fi';
import PlacePicker from './PlacePicker';
import { LOCATION_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl } from '../../utils/attachmentHelpers';

const DEFAULT_STATUS_LABELS = {
  select: 'Selects',
  shortlist: 'Shortlisted',
  final: 'Final',
};

const DEFAULT_STATUS_ORDER = ['select', 'shortlist', 'final'];

const COUNTRY_CODES = [
  { code: '+91', country: 'India' },
  { code: '+1', country: 'USA/Canada' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'Australia' },
  { code: '+971', country: 'UAE' },
  { code: '+65', country: 'Singapore' },
];

const baseUrl = LOCATION_API_BASE_URL.replace('/api/v2/location', '');

const CONFIGURABLE_FIELDS = [
  { key: 'fileName', label: 'Location Name' },
  { key: 'sceneNumber', label: 'Scene Number' },
  { key: 'episode', label: 'Episode' },
  { key: 'city', label: 'City' },
  { key: 'address', label: 'Address' },
  { key: 'description', label: 'Description' },
  { key: 'subLocation', label: 'Sub-Location / Area' },
  { key: 'interiorExterior', label: 'Interior / Exterior' },
  { key: 'dayNight', label: 'Day / Night' },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'parking', label: 'Parking' },
  { key: 'permits', label: 'Permits / Permissions' },
  { key: 'notes', label: 'Notes' },
];

/**
 * MoveDialog — Always shows a form when moving.
 *
 * Step 1: Pick target status
 * Step 2: Form with:
 *   - Common details (shared across all items): location name, address, contact, etc.
 *   - Per-item table: each image with its own episode + scene number
 *
 * Props:
 *  - existingLocations: array of location objects being moved
 */
const MoveDialog = ({
  currentStatus, moveTarget, onMoveLocations, onMoveFolder,
  onComplete, onClose, existingLocations = [], units = [], inline = false,
}) => {
  const [step, setStep] = useState('pick'); // 'pick' | 'form'
  const [targetStatus, setTargetStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // ── Field Configuration (same as LocationForm) ──
  const [requiredFields, setRequiredFields] = useState([]);

  useEffect(() => {
    locationToolService.getFieldConfig()
      .then((res) => {
        const config = res.data || {};
        setRequiredFields(config.requiredFields || []);
      })
      .catch(() => {});
  }, []);

  const isFieldRequired = (fieldKey) => requiredFields.includes(fieldKey);

  const fieldLabel = (key, label) => (
    <>
      {label}
      {isFieldRequired(key) && <span className="text-red-500 ml-0.5">*</span>}
    </>
  );

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
  // Pick the "best" data: use the item with the most filled fields
  const bestLocation = useMemo(() => {
    if (existingLocations.length === 0) return {};
    // Score each location by how many fields it has
    const scored = existingLocations.map((loc) => {
      let score = 0;
      if (loc.fileName) score++;
      if (loc.address) score++;
      if (loc.city) score++;
      if (loc.description) score++;
      if (loc.contactName) score++;
      if (loc.phone) score++;
      return { loc, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].loc;
  }, [existingLocations]);

  // Common details (shared)
  const [common, setCommon] = useState({
    fileName: bestLocation.fileName || '',
    city: bestLocation.city || '',
    address: bestLocation.address || '',
    description: bestLocation.description || '',
    contactName: bestLocation.contactName || '',
    phone: bestLocation.phone || '',
    countryCode: bestLocation.countryCode || '+91',
    email: bestLocation.email || '',
    latitude: bestLocation.latitude || '',
    longitude: bestLocation.longitude || '',
    subLocation: bestLocation.subLocation || '',
    interiorExterior: bestLocation.interiorExterior || '',
    dayNight: bestLocation.dayNight || '',
    parking: bestLocation.parking || '',
    permits: bestLocation.permits || '',
    notes: bestLocation.notes || '',
  });

  // Script scenes for "Choose from Script"
  const [scriptScenes, setScriptScenes] = useState([]);
  const [scriptEpisodes, setScriptEpisodes] = useState([]);
  const [showScriptPicker, setShowScriptPicker] = useState(false);
  const [scriptFilterEp, setScriptFilterEp] = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);

  useEffect(() => {
    if (!showScriptPicker) return;
    setScriptLoading(true);
    locationToolService.getScriptScenes({})
      .then((res) => {
        const scenes = res.data || [];
        setScriptScenes(scenes);
        setScriptEpisodes([...new Set(scenes.map((s) => s.episode).filter(Boolean))].sort());
      })
      .catch(() => {})
      .finally(() => setScriptLoading(false));
  }, [showScriptPicker]);

  const handleScriptSelect = (scene) => {
    // Fill per-item episodes and scene numbers from script
    setPerItem((prev) => prev.map((item) => ({
      ...item,
      episodes: scene.episode ? [scene.episode] : item.episodes,
      sceneNumber: scene.sceneNumber || item.sceneNumber,
    })));
    // Fill common details
    if (scene.locationName) updateCommon('fileName', scene.locationName);
    if (scene.intExt) {
      const ie = scene.intExt.toLowerCase();
      if (ie === 'int') updateCommon('interiorExterior', 'interior');
      else if (ie === 'ext') updateCommon('interiorExterior', 'exterior');
      else updateCommon('interiorExterior', 'both');
    }
    if (scene.dayNight) {
      const dn = scene.dayNight.toLowerCase();
      if (dn.includes('night') || dn.includes('evening')) updateCommon('dayNight', 'night');
      else updateCommon('dayNight', 'day');
    }
    if (scene.sceneDescription) updateCommon('description', scene.sceneDescription);
    setShowScriptPicker(false);
  };

  // Per-item details (episode + scene per image)
  const [perItem, setPerItem] = useState(() =>
    existingLocations.map((loc) => ({
      _id: loc._id,
      name: loc.fileName || loc.sceneNumber || 'Untitled',
      thumbnail: loc.attachments?.[0] || null,
      episodes: loc.episode || '',
      sceneNumber: loc.sceneNumber || '',
    }))
  );

  const updateCommon = (field, value) => {
    setCommon((prev) => ({ ...prev, [field]: value }));
  };

  const updatePerItem = (idx, field, value) => {
    setPerItem((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  // ── Place picker handler ──
  const handlePlaceSelect = (place) => {
    setCommon((prev) => ({
      ...prev,
      fileName: prev.fileName || place.name || '',
      city: place.city || prev.city,
      address: place.address || prev.address,
      latitude: place.lat || prev.latitude,
      longitude: place.lng || prev.longitude,
    }));
  };

  // ── Pick target → go to form ──
  const handlePickTarget = (status) => {
    setTargetStatus(status);
    setStep('form');
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ── Validate required fields from project config ──
    if (requiredFields.length > 0) {
      const firstItem = perItem[0] || {};
      const fieldValues = {
        fileName: common.fileName,
        sceneNumber: firstItem.sceneNumber || '',
        episode: firstItem.episodes ? (Array.isArray(firstItem.episodes) ? firstItem.episodes[0] : firstItem.episodes) : '',
        city: common.city,
        address: common.address,
        description: common.description,
        subLocation: common.subLocation,
        interiorExterior: common.interiorExterior,
        dayNight: common.dayNight,
        contactName: common.contactName,
        phone: common.phone,
        email: common.email,
        parking: common.parking,
        permits: common.permits,
        notes: common.notes,
      };

      const missing = requiredFields
        .filter((key) => !fieldValues[key])
        .map((key) => {
          const field = CONFIGURABLE_FIELDS.find((f) => f.key === key);
          return field?.label || key;
        });

      if (missing.length > 0) {
        alert(`Required fields missing:\n${missing.join('\n')}`);
        return;
      }
    }

    setSubmitting(true);

    // Build commonDetails — remove empty values
    const commonDetails = { ...common };
    Object.keys(commonDetails).forEach((k) => {
      if (!commonDetails[k] && commonDetails[k] !== 0) delete commonDetails[k];
    });

    // Build perItemDetails
    const perItemDetails = perItem.map((item) => ({
      _id: item._id,
      episode: item.episodes,
      sceneNumber: item.sceneNumber,
    }));

    let result;
    if (moveTarget?.type === 'folder') {
      result = await onMoveFolder(
        moveTarget.folderField, moveTarget.folderValue,
        currentStatus, targetStatus,
        { commonDetails, perItemDetails }
      );
    } else {
      result = await onMoveLocations(
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
  // STEP: Form — common details + per-item table
  // ═══════════════════════════════════════════════════
  const outerClass = inline
    ? "flex flex-col h-full bg-white"
    : "fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4";
  const innerClassForm = inline
    ? "flex flex-col h-full"
    : "bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col";
  const innerClassPick = inline
    ? "flex flex-col h-full p-6"
    : "bg-white rounded-xl shadow-2xl w-full max-w-sm p-6";

  if (step === 'form') {
    return (
      <div className={outerClass} onClick={inline ? undefined : onClose}>
        <div
          className={innerClassForm}
          onClick={inline ? undefined : (e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Move to {STATUS_LABELS[targetStatus]}</h3>
            <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
            {/* ── Choose from Script (top) ── */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-blue-700">Choose from Script</h4>
                  <p className="text-xs text-blue-500 mt-0.5">Auto-fill episode, scene number, and location details</p>
                </div>
                <Button
                  className="btn-info"
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() => setShowScriptPicker(true)}
                >
                  Browse Scenes
                </Button>
              </div>
            </div>

            {/* Script Picker Modal */}
            {showScriptPicker && (
              <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowScriptPicker(false)}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3 border-b">
                    <h3 className="text-base font-semibold">Choose Scene</h3>
                    <Button type="text" icon={<CloseOutlined />} onClick={() => setShowScriptPicker(false)} />
                  </div>
                  <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-100 overflow-x-auto">
                    <span className="text-xs text-gray-400">Episode:</span>
                    <button type="button" className={`cast-filter-chip ${!scriptFilterEp ? 'active' : ''}`} onClick={() => setScriptFilterEp('')}>All</button>
                    {scriptEpisodes.map((ep) => (
                      <button type="button" key={ep} className={`cast-filter-chip ${scriptFilterEp === ep ? 'active' : ''}`} onClick={() => setScriptFilterEp(ep)}>EP {ep}</button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-2">
                    {scriptLoading && <div className="text-center py-4"><Spin /></div>}
                    {(scriptFilterEp ? scriptScenes.filter((s) => s.episode === scriptFilterEp) : scriptScenes).map((scene) => (
                      <div key={scene._id} className="p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all" onClick={() => handleScriptSelect(scene)}>
                        <div className="flex items-center gap-2 mb-1">
                          <Tag color="blue" className="!text-[10px] !m-0">EP {scene.episode}</Tag>
                          <Tag color="orange" className="!text-[10px] !m-0">Scene {scene.sceneNumber}</Tag>
                          <Tag className="!text-[10px] !m-0">{scene.intExt}</Tag>
                          <Tag className="!text-[10px] !m-0">{scene.dayNight}</Tag>
                        </div>
                        <div className="text-sm font-semibold">{scene.sceneTitle}</div>
                        <div className="text-xs text-gray-500">{scene.locationName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Per-Item Table (Episode + Scene per image) ── */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Items ({perItem.length})</h4>
                <span className="text-xs text-gray-400">Set episode & scene for each image</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[48px_1fr_1fr_1fr] bg-gray-50 text-xs font-semibold text-gray-500 px-3 py-2 border-b border-gray-200">
                  <span>Image</span>
                  <span>Name</span>
                  <span>{fieldLabel('episode', 'Episode(s)')}</span>
                  <span>{fieldLabel('sceneNumber', 'Scene #')}</span>
                </div>
                {perItem.map((item, idx) => (
                  <div key={item._id} className="grid grid-cols-[48px_1fr_1fr_1fr] items-center px-3 py-2 border-b border-gray-100 last:border-0">
                    <div>
                      {item.thumbnail?.media ? (
                        <img
                          src={getAttachmentUrl(item.thumbnail, baseUrl)}
                          alt="" className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                          <PictureOutlined style={{ fontSize: 14, color: '#bbb' }} />
                        </div>
                      )}
                    </div>
                    <div className="text-xs truncate pr-2" title={item.name}>
                      {item.name}
                    </div>
                    <div className="pr-2">
                      <Input
                        size="small"
                        value={item.episodes}
                        onChange={(e) => updatePerItem(idx, 'episodes', e.target.value)}
                        placeholder="EP01, EP02"
                      />
                    </div>
                    <div>
                      <Input
                        size="small"
                        value={item.sceneNumber}
                        onChange={(e) => updatePerItem(idx, 'sceneNumber', e.target.value)}
                        placeholder="5A"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Common Details (shared across all items) ── */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Location Details</h4>
                <span className="text-xs text-gray-400">Applied to all items</span>
              </div>

              {/* Place Picker */}
              <div className="mb-3">
                <PlacePicker
                  onPlaceSelect={handlePlaceSelect}
                  initialLat={common.latitude || undefined}
                  initialLng={common.longitude || undefined}
                  initialSearch={common.address || ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('fileName', 'Location Name')}</label>
                  <Input
                    value={common.fileName}
                    onChange={(e) => updateCommon('fileName', e.target.value)}
                    placeholder="Auto-filled from map"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('city', 'City')}</label>
                  <Input
                    value={common.city}
                    onChange={(e) => updateCommon('city', e.target.value)}
                    placeholder="Auto-filled from map"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('address', 'Address')}</label>
                  <Input
                    value={common.address}
                    onChange={(e) => updateCommon('address', e.target.value)}
                    placeholder="Full address"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('description', 'Description')}</label>
                  <Input.TextArea
                    value={common.description}
                    onChange={(e) => updateCommon('description', e.target.value)}
                    placeholder="Describe the location"
                    rows={2}
                  />
                </div>

                {/* Interior/Exterior + Day/Night */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('interiorExterior', 'Interior / Exterior')}</label>
                  <Select
                    value={common.interiorExterior || undefined}
                    onChange={(val) => updateCommon('interiorExterior', val)}
                    placeholder="Select..."
                    allowClear
                    className="w-full"
                    options={[
                      { value: 'interior', label: 'Interior' },
                      { value: 'exterior', label: 'Exterior' },
                      { value: 'both', label: 'Both' },
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('dayNight', 'Day / Night')}</label>
                  <Select
                    value={common.dayNight || undefined}
                    onChange={(val) => updateCommon('dayNight', val)}
                    placeholder="Select..."
                    allowClear
                    className="w-full"
                    options={[
                      { value: 'day', label: 'Day' },
                      { value: 'night', label: 'Night' },
                      { value: 'both', label: 'Both' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* ── Contact & Additional (collapsible) ── */}
            <div>
              <Button
                type="link"
                className="!px-0 !text-blue-600 !font-semibold"
                onClick={() => setShowMoreFields(!showMoreFields)}
              >
                {showMoreFields ? '\u25BC' : '\u25B6'} Contact & Additional Info
                {(common.contactName || common.phone) && !showMoreFields && (
                  <span className="ml-2 text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Auto-filled</span>
                )}
              </Button>

              {showMoreFields && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('contactName', 'Contact Name')}</label>
                    <Input
                      value={common.contactName}
                      onChange={(e) => updateCommon('contactName', e.target.value)}
                      placeholder="Location owner name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('phone', 'Phone')}</label>
                    <div className="flex gap-2">
                      <Select
                        value={common.countryCode}
                        onChange={(val) => updateCommon('countryCode', val)}
                        className="!w-28"
                        showSearch
                        filterOption={(input, option) =>
                          option.label.toLowerCase().includes(input.toLowerCase())
                        }
                        options={COUNTRY_CODES.map((c) => ({
                          value: c.code,
                          label: `${c.code} ${c.country}`,
                        }))}
                      />
                      <Input
                        value={common.phone}
                        onChange={(e) => updateCommon('phone', e.target.value)}
                        placeholder="Phone number"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('email', 'Email')}</label>
                    <Input
                      type="email"
                      value={common.email}
                      onChange={(e) => updateCommon('email', e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('subLocation', 'Sub-Location / Area')}</label>
                    <Input
                      value={common.subLocation}
                      onChange={(e) => updateCommon('subLocation', e.target.value)}
                      placeholder="e.g., Terrace, Lobby"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('parking', 'Parking')}</label>
                    <Input
                      value={common.parking}
                      onChange={(e) => updateCommon('parking', e.target.value)}
                      placeholder="Street, Private lot"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('permits', 'Permits')}</label>
                    <Input
                      value={common.permits}
                      onChange={(e) => updateCommon('permits', e.target.value)}
                      placeholder="Required permits"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('notes', 'Notes')}</label>
                    <Input.TextArea
                      value={common.notes}
                      onChange={(e) => updateCommon('notes', e.target.value)}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Actions ── */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button onClick={onClose}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {submitting ? 'Moving...' : `Move ${perItem.length} item${perItem.length > 1 ? 's' : ''} to ${STATUS_LABELS[targetStatus]}`}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // STEP: Pick — choose target status
  // ═══════════════════════════════════════════════════
  return (
    <div className={outerClass} onClick={inline ? undefined : onClose}>
      <div
        className={innerClassPick}
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2">Move Location{moveTarget?.type === 'folder' ? ' Folder' : '(s)'}</h3>
        <p className="text-sm text-gray-500 mb-1">Current: <strong>{STATUS_LABELS[currentStatus]}</strong></p>
        <p className="text-sm text-gray-500 mb-4">Select target:</p>
        <div className="space-y-2 mb-4">
          {availableTargets.map((status) => (
            <Button
              key={status}
              block
              icon={<ArrowRightOutlined />}
              onClick={() => handlePickTarget(status)}
              className="text-left"
            >
              Move to {STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
        <Button block onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
};

export default MoveDialog;
