import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Modal, Button, Input, Select, Upload, Divider, Collapse, Image, Spin, Tag, Checkbox, Switch } from 'antd';
import {
  CloseOutlined, UploadOutlined, DeleteOutlined, LinkOutlined,
  LoadingOutlined, PlusOutlined, FileOutlined, VideoCameraOutlined,
  EyeOutlined, SettingOutlined,
} from '@ant-design/icons';
import { FiX, FiUpload, FiTrash2, FiLink, FiLoader, FiPlus, FiFile, FiVideo, FiEye } from 'react-icons/fi';
import { LOCATION_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage as isImageAtt, isVideo as isVideoAtt, getAttachmentName } from '../../utils/attachmentHelpers';
import locationToolService from '../../services/locationToolService';
import PlacePicker from './PlacePicker';

/* ── Platform logos (SVG data URIs for zero-dependency) ── */
const PLATFORM_LOGOS = {
  youtube: 'https://www.youtube.com/s/desktop/6ed817e0/img/favicon_144x144.png',
  instagram: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsNE-OHk_8a.png',
  facebook: 'https://static.xx.fbcdn.net/rsrc.php/yo/r/iRmz9lCMBD2.ico',
  twitter: 'https://abs.twimg.com/favicons/twitter.3.ico',
  x: 'https://abs.twimg.com/favicons/twitter.3.ico',
  pinterest: 'https://s.pinimg.com/webapp/favicon-56d498a1.png',
  tiktok: 'https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop/8152caf0c8e8de1fa498.png',
  vimeo: 'https://f.vimeocdn.com/images_v6/favicon.ico',
  linkedin: 'https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7aqj8e1x2rzsrca',
  google: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
  dribbble: 'https://cdn.dribbble.com/assets/favicon-b38525134603b9513174ec887944bde1a869eb6cd414f4d640ee48ab2a15a26b.ico',
  behance: 'https://a5.behance.net/favicon.ico',
  flickr: 'https://combo.staticflickr.com/pw/favicon.ico',
  unsplash: 'https://unsplash.com/favicon-32x32.png',
  pexels: 'https://www.pexels.com/assets/icons/pexels-icon-644533b609157fd990b1a43e6b9b3297add5de41c58aa9223856b5e22a2ef704.png',
};

const getPlatformFromUrl = (url) => {
  if (!url) return null;
  const hostname = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
  for (const [platform, logo] of Object.entries(PLATFORM_LOGOS)) {
    if (hostname.includes(platform)) return { name: platform, logo };
  }
  return null;
};

const COUNTRY_CODES = [
  { code: '+91', country: 'India' },
  { code: '+1', country: 'USA/Canada' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'Australia' },
  { code: '+971', country: 'UAE' },
  { code: '+65', country: 'Singapore' },
  { code: '+81', country: 'Japan' },
  { code: '+49', country: 'Germany' },
  { code: '+33', country: 'France' },
  { code: '+86', country: 'China' },
  { code: '+82', country: 'South Korea' },
  { code: '+39', country: 'Italy' },
  { code: '+34', country: 'Spain' },
  { code: '+7', country: 'Russia' },
  { code: '+55', country: 'Brazil' },
  { code: '+27', country: 'South Africa' },
  { code: '+62', country: 'Indonesia' },
  { code: '+66', country: 'Thailand' },
  { code: '+60', country: 'Malaysia' },
  { code: '+63', country: 'Philippines' },
];

const LocationForm = ({ location, onSubmit, onClose, activeTab, inline = false }) => {
  const [fileName, setFileName] = useState(location?.fileName || '');
  const [sceneNumber, setSceneNumber] = useState(location?.sceneNumber || '');
  const [episodes, setEpisodes] = useState(
    location?.episode ? [location.episode] : ['']
  );
  const [city, setCity] = useState(location?.city || '');
  const [address, setAddress] = useState(location?.address || '');
  const [description, setDescription] = useState(location?.description || '');
  const [contactName, setContactName] = useState(location?.contactName || '');
  const [phone, setPhone] = useState(location?.phone || '');
  const [countryCode, setCountryCode] = useState(location?.countryCode || '+91');
  const [email, setEmail] = useState(location?.email || '');
  const [link, setLink] = useState(location?.link || '');
  const [latitude, setLatitude] = useState(location?.latitude ?? '');
  const [longitude, setLongitude] = useState(location?.longitude ?? '');
  // New fields
  const [subLocation, setSubLocation] = useState(location?.subLocation || '');
  const [interiorExterior, setInteriorExterior] = useState(location?.interiorExterior || '');
  const [dayNight, setDayNight] = useState(location?.dayNight || '');
  const [parking, setParking] = useState(location?.parking || '');
  const [permits, setPermits] = useState(location?.permits || '');
  const [notes, setNotes] = useState(location?.notes || '');

  const [newFiles, setNewFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState(location?.attachments || []);
  const [linkPreview, setLinkPreview] = useState(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // ── Script Breakdown ──
  const [showScriptPicker, setShowScriptPicker] = useState(false);
  const [scriptEpisodes, setScriptEpisodes] = useState([]);
  const [scriptScenes, setScriptScenes] = useState([]);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [selectedScriptEp, setSelectedScriptEp] = useState('');
  const [selectedScene, setSelectedScene] = useState(null);

  // Fetch all script scenes when modal opens
  useEffect(() => {
    if (!showScriptPicker) return;
    setScriptLoading(true);
    locationToolService.getScriptScenes({})
      .then((res) => {
        const scenes = res.data || [];
        setScriptScenes(scenes);
        // Extract unique episodes
        const eps = [...new Set(scenes.map((s) => s.episode).filter(Boolean))].sort();
        setScriptEpisodes(eps);
      })
      .catch(() => { setScriptScenes([]); setScriptEpisodes([]); })
      .finally(() => setScriptLoading(false));
  }, [showScriptPicker]);

  const handleSceneSelect = (scene) => {
    setSelectedScene(scene);
    // Auto-fill ALL fields from script (overwrite existing)
    if (scene.episode) setEpisodes([scene.episode]);
    if (scene.sceneNumber) setSceneNumber(scene.sceneNumber);
    if (scene.locationName) setFileName(scene.locationName);
    if (scene.intExt) {
      const ie = scene.intExt.toLowerCase();
      if (ie === 'int') setInteriorExterior('interior');
      else if (ie === 'ext') setInteriorExterior('exterior');
      else if (ie.includes('int') && ie.includes('ext')) setInteriorExterior('both');
    }
    if (scene.dayNight) {
      const dn = scene.dayNight.toLowerCase();
      if (dn === 'day' || dn === 'dawn' || dn === 'morning') setDayNight('day');
      else if (dn === 'night' || dn === 'evening' || dn === 'dusk') setDayNight('night');
    }
    if (scene.sceneDescription) setDescription(scene.sceneDescription);
    setShowScriptPicker(false);
  };
  const countryRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // ── Field Configuration ──
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
    { key: 'attachment', label: 'Attachment (at least one)' },
    { key: 'link', label: 'Link' },
  ];

  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [requiredFields, setRequiredFields] = useState([]);
  const [configLoading, setConfigLoading] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    locationToolService.getFieldConfig()
      .then((res) => {
        const config = res.data || {};
        setRequiredFields(config.requiredFields || []);
      })
      .catch(() => {});
  }, []);

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      await locationToolService.saveFieldConfig(requiredFields);
      setShowFieldConfig(false);
    } catch {}
    finally { setConfigLoading(false); }
  };

  const isFieldRequired = (fieldKey) => requiredFields.includes(fieldKey);

  // Helper to render label with optional required indicator
  const fieldLabel = (key, label) => (
    <>
      {label}
      {isFieldRequired(key) && <span className="text-red-500 ml-0.5">*</span>}
    </>
  );

  const toggleRequiredField = (fieldKey) => {
    setRequiredFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey]
    );
  };
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const baseUrl = LOCATION_API_BASE_URL.replace('/api/v2/location', '');

  // Generate preview URLs for new files (images/videos)
  const newFilePreviews = useMemo(() => {
    return newFiles.map((file) => {
      if (file.type?.startsWith('image/')) {
        return URL.createObjectURL(file);
      }
      if (file.type?.startsWith('video/')) {
        return 'video';
      }
      return null;
    });
  }, [newFiles]);

  // ── Place picker handler ──
  const handlePlaceSelect = (place) => {
    if (place.name && !fileName) setFileName(place.name);
    if (place.city) setCity(place.city);
    if (place.address) setAddress(place.address);
    if (place.lat != null) setLatitude(place.lat);
    if (place.lng != null) setLongitude(place.lng);
  };

  // ── Episodes management ──
  const addEpisode = () => setEpisodes((prev) => [...prev, '']);
  const removeEpisode = (idx) => setEpisodes((prev) => prev.filter((_, i) => i !== idx));
  const updateEpisode = (idx, val) => {
    setEpisodes((prev) => prev.map((ep, i) => (i === idx ? val : ep)));
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setNewFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const handleRemoveNewFile = (idx) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveExisting = (idx) => {
    setExistingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFetchLinkPreview = async (url) => {
    const targetUrl = typeof url === 'string' ? url : link;
    if (!targetUrl || !targetUrl.startsWith('http')) return;
    setFetchingPreview(true);
    try {
      const resp = await locationToolService.getLinkPreview(targetUrl);
      const preview = resp?.data || resp;
      // If no OG image, try platform logo fallback
      if (!preview.image) {
        const platform = getPlatformFromUrl(targetUrl);
        if (platform) {
          preview.image = platform.logo;
          preview.isPlatformLogo = true;
          if (!preview.siteName) preview.siteName = platform.name.charAt(0).toUpperCase() + platform.name.slice(1);
        }
      }
      // Use favicon as last resort
      if (!preview.image && preview.favicon) {
        preview.image = preview.favicon;
        preview.isFavicon = true;
      }
      setLinkPreview(preview);
    } catch {
      // Still show platform logo even if fetch fails
      const platform = getPlatformFromUrl(targetUrl);
      if (platform) {
        setLinkPreview({
          url: targetUrl,
          title: '',
          description: '',
          image: platform.logo,
          isPlatformLogo: true,
          siteName: platform.name.charAt(0).toUpperCase() + platform.name.slice(1),
        });
      }
    }
    setFetchingPreview(false);
  };

  const handleLinkPaste = (e) => {
    const pasted = e.clipboardData?.getData('text') || '';
    if (pasted.startsWith('http')) {
      // small delay so state updates first
      setTimeout(() => handleFetchLinkPreview(pasted), 200);
    }
  };

  const filteredCountryCodes = COUNTRY_CODES.filter(
    (c) =>
      c.code.includes(countrySearch) ||
      c.country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ── Validate required fields from project config ──
    if (requiredFields.length > 0) {
      const validEps = episodes.filter((ep) => ep.trim());
      const fieldValues = {
        fileName, sceneNumber, city, address, description,
        subLocation, interiorExterior, dayNight, contactName,
        phone, email, parking, permits, notes, link,
        episode: validEps.length > 0 ? validEps[0] : '',
        attachment: (newFiles.length > 0 || existingAttachments.length > 0) ? 'yes' : '',
        latitude: latitude ? String(latitude) : '',
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
    const formData = new FormData();
    formData.append('fileName', fileName);
    formData.append('sceneNumber', sceneNumber);
    const validEpisodes = episodes.filter((ep) => ep.trim());
    formData.append('episodes', JSON.stringify(validEpisodes));
    formData.append('city', city);
    formData.append('address', address);
    formData.append('description', description);
    formData.append('contactName', contactName);
    formData.append('phone', phone);
    formData.append('countryCode', countryCode);
    formData.append('email', email);
    formData.append('link', link);
    if (latitude !== '' && latitude !== null) formData.append('latitude', latitude);
    if (longitude !== '' && longitude !== null) formData.append('longitude', longitude);
    // New fields
    formData.append('subLocation', subLocation);
    formData.append('interiorExterior', interiorExterior);
    formData.append('dayNight', dayNight);
    formData.append('parking', parking);
    formData.append('permits', permits);
    formData.append('notes', notes);

    if (location) {
      formData.append('existingAttachments', JSON.stringify(existingAttachments));
    }
    newFiles.forEach((file) => formData.append('files', file));

    await onSubmit(formData);
    setSubmitting(false);
  };

  const outerClass = inline
    ? "flex flex-col h-full bg-white"
    : "fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4";
  const innerClass = inline
    ? "flex flex-col h-full"
    : "bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col";

  return (
    <div className={outerClass} onClick={inline ? undefined : onClose}>
      <div
        className={innerClass}
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{location ? 'Edit Location' : 'Add New Location'}</h2>
          <div className="flex items-center gap-1">
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => setShowFieldConfig(true)}
              title="Configure required fields"
            />
            <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
          </div>
        </div>

        {/* ── Field Configuration Modal ── */}
        {showFieldConfig && (
          <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowFieldConfig(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-semibold">Required Fields</h3>
                  <p className="text-xs text-gray-400">Configure which fields are mandatory for this project</p>
                </div>
                <Button type="text" icon={<CloseOutlined />} onClick={() => setShowFieldConfig(false)} />
              </div>
              <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  {CONFIGURABLE_FIELDS.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-700">{field.label}</span>
                      <Switch
                        size="small"
                        checked={requiredFields.includes(field.key)}
                        onChange={() => toggleRequiredField(field.key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center px-5 py-3 border-t border-gray-200">
                <span className="text-xs text-gray-400">{requiredFields.length} field(s) required</span>
                <div className="flex gap-2">
                  <Button onClick={() => setShowFieldConfig(false)}>Cancel</Button>
                  <Button type="primary" onClick={handleSaveConfig} loading={configLoading}>
                    Save Configuration
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-3 space-y-3">

          {/* ── Choose from Script ── */}
          {!location && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-blue-700">Choose from Script</h4>
                  <p className="text-xs text-blue-500 mt-0.5">Select a scene to auto-fill episode, scene number, and location details</p>
                </div>
                <Button
                  type="primary"
                  className="btn-info"
                  onClick={() => setShowScriptPicker(true)}
                >
                  Browse Scenes
                </Button>
              </div>
              {selectedScene && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-100 flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Tag color="blue">EP {selectedScene.episode}</Tag>
                      <Tag>Scene {selectedScene.sceneNumber}</Tag>
                      <Tag color={selectedScene.intExt === 'INT' ? 'green' : selectedScene.intExt === 'EXT' ? 'orange' : 'cyan'}>{selectedScene.intExt}</Tag>
                      <Tag>{selectedScene.dayNight}</Tag>
                    </div>
                    <div className="text-sm font-medium text-gray-800">{selectedScene.sceneTitle}</div>
                    <div className="text-xs text-gray-500">{selectedScene.locationName}</div>
                    {selectedScene.characters?.length > 0 && (
                      <div className="text-[11px] text-gray-400 mt-1">Characters: {selectedScene.characters.join(', ')}</div>
                    )}
                  </div>
                  <Button type="text" size="small" onClick={() => setSelectedScene(null)} icon={<CloseOutlined />} />
                </div>
              )}
            </div>
          )}

          {/* ── Script Scene Picker Modal ── */}
          {showScriptPicker && (
            <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowScriptPicker(false)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                  <h3 className="text-base font-semibold">Choose Scene from Script</h3>
                  <Button type="text" icon={<CloseOutlined />} onClick={() => setShowScriptPicker(false)} />
                </div>

                {/* Episode filter */}
                <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-100 overflow-x-auto">
                  <span className="text-xs font-medium text-gray-400 whitespace-nowrap">Episode:</span>
                  <button
                    className={`cast-filter-chip ${!selectedScriptEp ? 'active' : ''}`}
                    onClick={() => setSelectedScriptEp('')}
                  >
                    All
                  </button>
                  {scriptEpisodes.map((ep) => (
                    <button
                      key={ep}
                      className={`cast-filter-chip ${selectedScriptEp === ep ? 'active' : ''}`}
                      onClick={() => setSelectedScriptEp(ep)}
                    >
                      EP {ep}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {scriptLoading && <div className="text-center py-8"><Spin /></div>}
                  {!scriptLoading && scriptScenes.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">No script scenes found for this project</p>
                  )}
                  <div className="space-y-2">
                    {(selectedScriptEp
                      ? scriptScenes.filter((s) => s.episode === selectedScriptEp)
                      : scriptScenes
                    ).map((scene) => (
                      <div
                        key={scene._id}
                        className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all"
                        onClick={() => handleSceneSelect(scene)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Tag color="blue" className="!text-[10px] !m-0">EP {scene.episode}</Tag>
                          <Tag color="orange" className="!text-[10px] !m-0">Scene {scene.sceneNumber}</Tag>
                          <Tag color={scene.intExt === 'INT' ? 'green' : scene.intExt === 'EXT' ? 'volcano' : 'cyan'} className="!text-[10px] !m-0">{scene.intExt}</Tag>
                          <Tag className="!text-[10px] !m-0">{scene.dayNight}</Tag>
                          {scene.pageCount && <span className="text-[10px] text-gray-400 ml-auto">{scene.pageCount} pg</span>}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">{scene.sceneTitle}</div>
                        <div className="text-xs text-gray-500">{scene.locationName}</div>
                        {scene.sceneDescription && (
                          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{scene.sceneDescription}</p>
                        )}
                        {scene.characters?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {scene.characters.map((ch) => (
                              <Tag key={ch} className="!text-[10px] !m-0" color="default">{ch}</Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Place Picker (Google Maps) ── */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Location</h4>
            <PlacePicker
              onPlaceSelect={handlePlaceSelect}
              initialLat={latitude || undefined}
              initialLng={longitude || undefined}
              initialSearch={address || fileName || ''}
            />
          </div>

          {/* ── File & Link Upload ── */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Attachments & Links</h4>
            <div className="space-y-3">
              <div>
                <Upload.Dragger
                  multiple
                  accept="image/*,video/*,.pdf"
                  beforeUpload={(file) => {
                    setNewFiles((prev) => [...prev, file]);
                    return false;
                  }}
                  onRemove={(file) => {
                    setNewFiles((prev) => prev.filter((f) => f !== file.originFileObj && f !== file));
                  }}
                  showUploadList={false}
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined />
                  </p>
                  <p className="ant-upload-text">Drop files here or click to upload</p>
                  <p className="ant-upload-hint">Images, videos, or PDFs</p>
                </Upload.Dragger>

                {existingAttachments.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Existing files:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {existingAttachments.map((att, idx) => {
                        const fileUrl = getAttachmentUrl(att, baseUrl);
                        const imgCheck = isImageAtt(att);
                        const vidCheck = isVideoAtt(att);
                        return (
                          <div key={`existing-${idx}`} className="relative group rounded-lg overflow-hidden border border-gray-200">
                            <div
                              className="h-20 bg-gray-50 flex items-center justify-center cursor-pointer"
                              onClick={() => imgCheck && setLightboxSrc(fileUrl)}
                            >
                              {imgCheck ? (
                                <img src={fileUrl} alt={getAttachmentName(att)} className="w-full h-full object-cover" />
                              ) : vidCheck ? (
                                <VideoCameraOutlined style={{ fontSize: 24, color: '#666' }} />
                              ) : (
                                <FileOutlined style={{ fontSize: 24, color: '#666' }} />
                              )}
                              {imgCheck && (
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                                  <EyeOutlined className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between px-1.5 py-1">
                              <span className="text-[10px] text-gray-500 truncate flex-1" title={getAttachmentName(att)}>
                                {getAttachmentName(att)}
                              </span>
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                                onClick={() => handleRemoveExisting(idx)}
                                className="!px-1"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {newFiles.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">New files:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {newFiles.map((file, idx) => {
                        const previewUrl = newFilePreviews[idx];
                        const isImage = file.type?.startsWith('image/');
                        const isVideo = file.type?.startsWith('video/');
                        return (
                          <div key={`new-${idx}`} className="relative group rounded-lg overflow-hidden border border-gray-200">
                            <div
                              className="h-20 bg-gray-50 flex items-center justify-center cursor-pointer"
                              onClick={() => isImage && previewUrl && setLightboxSrc(previewUrl)}
                            >
                              {isImage && previewUrl ? (
                                <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                              ) : isVideo ? (
                                <VideoCameraOutlined style={{ fontSize: 24, color: '#666' }} />
                              ) : (
                                <FileOutlined style={{ fontSize: 24, color: '#666' }} />
                              )}
                              {isImage && (
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                                  <EyeOutlined className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between px-1.5 py-1">
                              <span className="text-[10px] text-gray-500 truncate flex-1" title={file.name}>{file.name}</span>
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                                onClick={() => handleRemoveNewFile(idx)}
                                className="!px-1"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-medium text-gray-700">Link</label>
                  {link && link.startsWith('http') && (
                    <Button
                      type="link"
                      size="small"
                      icon={fetchingPreview ? <LoadingOutlined spin /> : <LinkOutlined />}
                      onClick={handleFetchLinkPreview}
                      disabled={fetchingPreview}
                      className="!px-1 text-xs"
                    >
                      {fetchingPreview ? 'Fetching...' : 'Preview'}
                    </Button>
                  )}
                </div>
                <Input
                  type="url"
                  value={link}
                  onChange={(e) => { setLink(e.target.value); setLinkPreview(null); }}
                  placeholder="Paste URL — images will be auto-fetched"
                  onPaste={handleLinkPaste}
                  onBlur={() => handleFetchLinkPreview()}
                />
                {fetchingPreview && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <LoadingOutlined spin />
                    <span>Fetching preview...</span>
                  </div>
                )}
                {linkPreview && !fetchingPreview && (
                  <div
                    className="mt-2 flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer"
                    onClick={() => linkPreview.image && !linkPreview.isPlatformLogo && !linkPreview.isFavicon && setLightboxSrc(linkPreview.image)}
                  >
                    {linkPreview.image && (
                      <div className={`flex-shrink-0 ${linkPreview.isPlatformLogo || linkPreview.isFavicon ? 'w-8 h-8' : 'w-24 h-16'} rounded overflow-hidden`}>
                        <img src={linkPreview.image} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {linkPreview.title && <strong className="text-sm block truncate">{linkPreview.title}</strong>}
                      {linkPreview.description && <p className="text-xs text-gray-500 line-clamp-2">{linkPreview.description}</p>}
                      {linkPreview.siteName && (
                        <span className="text-[10px] text-gray-400">{linkPreview.siteName}</span>
                      )}
                      <span className="text-[10px] text-gray-400 block truncate">{link}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Location Details ── */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('fileName', 'Location Name')}</label>
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Auto-filled from map or enter manually"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Sub-Location / Area</label>
                <Input
                  value={subLocation}
                  onChange={(e) => setSubLocation(e.target.value)}
                  placeholder="e.g., Terrace, Lobby, Garden"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {fieldLabel('sceneNumber', 'Scene Number')}
                  {selectedScene && <Tag color="blue" className="!ml-2 !text-[10px]">From Script</Tag>}
                </label>
                <Input
                  value={sceneNumber}
                  onChange={(e) => setSceneNumber(e.target.value)}
                  placeholder="e.g., 5A"
                  disabled={!!selectedScene}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('city', 'City')}</label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Auto-filled from map"
                />
              </div>

              {/* Multiple Episodes */}
              <div className="col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-gray-600">
                    Episodes
                    {selectedScene && <Tag color="blue" className="!ml-2 !text-[10px]">From Script</Tag>}
                  </label>
                  {!selectedScene && (
                    <Button type="link" size="small" icon={<PlusOutlined />} onClick={addEpisode} className="!px-1 text-xs">
                      Add Episode
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {episodes.map((ep, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={ep}
                        onChange={(e) => updateEpisode(idx, e.target.value)}
                        placeholder={`Episode ${idx + 1} (e.g., EP01)`}
                        disabled={!!selectedScene}
                      />
                      {episodes.length > 1 && !selectedScene && (
                        <Button
                          type="text"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => removeEpisode(idx)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Address</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Auto-filled from map"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">{fieldLabel('description', 'Description')}</label>
                <Input.TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description of the location"
                  rows={2}
                />
              </div>

              {/* Interior/Exterior + Day/Night */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Interior / Exterior</label>
                <Select
                  value={interiorExterior || undefined}
                  onChange={(val) => setInteriorExterior(val)}
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">Day / Night</label>
                <Select
                  value={dayNight || undefined}
                  onChange={(val) => setDayNight(val)}
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

          {/* ── More Details (collapsible) ── */}
          <div>
            <Button
              type="link"
              className="!px-0 !text-blue-600 !font-semibold"
              onClick={() => setShowMoreFields(!showMoreFields)}
            >
              {showMoreFields ? '\u25BC' : '\u25B6'} Contact & Additional Info
              {(contactName || phone || email) && !showMoreFields && (
                <span className="ml-2 text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Auto-filled</span>
              )}
            </Button>

            {showMoreFields && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Contact Name</label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Location owner name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
                  <div className="flex gap-2">
                    <Select
                      value={countryCode}
                      onChange={(val) => setCountryCode(val)}
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
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Parking</label>
                  <Input
                    value={parking}
                    onChange={(e) => setParking(e.target.value)}
                    placeholder="e.g., Street parking, Private lot"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Permits / Permissions</label>
                  <Input
                    value={permits}
                    onChange={(e) => setPermits(e.target.value)}
                    placeholder="e.g., City permit required, HOA approval"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
                  <Input.TextArea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>

                {(latitude || longitude) && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">GPS Coordinates (from map)</label>
                    <div className="px-3 py-2 bg-gray-50 rounded-[10px] text-sm text-gray-600 font-mono">
                      {latitude}, {longitude}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {submitting ? 'Saving...' : location ? 'Update Location' : 'Add Location'}
            </Button>
          </div>
        </form>

        {/* ── Image Lightbox ── */}
        {lightboxSrc && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" onClick={() => setLightboxSrc(null)}>
            <Button
              type="text"
              icon={<CloseOutlined />}
              className="!absolute top-4 right-4 !text-white"
              onClick={() => setLightboxSrc(null)}
            />
            <img
              src={lightboxSrc}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationForm;
