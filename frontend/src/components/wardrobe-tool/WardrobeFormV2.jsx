import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import { Button, Input, Select, Upload, Tag, DatePicker, Checkbox } from 'antd';
import {
  CloseOutlined, DeleteOutlined, LinkOutlined,
  LoadingOutlined, PlusOutlined, FileOutlined, VideoCameraOutlined,
  EyeOutlined, WarningOutlined, InboxOutlined, UserOutlined,
} from '@ant-design/icons';
import { WARDROBE_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage as isImageAtt, isVideo as isVideoAtt, getAttachmentName } from '../../utils/attachmentHelpers';
import wardrobeToolService from '../../services/wardrobeToolService';
import { toast } from 'react-toastify';
import ChooseCastModal from './ChooseCastModal';

/* -- Platform logos (SVG data URIs for zero-dependency) -- */
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

/* -- Costume state options -- */
const COSTUME_STATE_OPTIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'torn', label: 'Torn' },
  { value: 'bloodStained', label: 'Blood-stained' },
  { value: 'wet', label: 'Wet' },
  { value: 'aged', label: 'Aged' },
];

/* -- Fitting type options -- */
const FITTING_TYPE_OPTIONS = [
  { value: '1st', label: '1st Fitting' },
  { value: '2nd', label: '2nd Fitting' },
  { value: 'final', label: 'Final Fitting' },
];

/* -- Fitting status options -- */
const FITTING_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'approved', label: 'Approved' },
  { value: 'needsChanges', label: 'Needs Changes' },
];

/* -- Empty fitting entry -- */
const EMPTY_FITTING = {
  fittingType: '',
  date: null,
  time: '',
  location: '',
  status: '',
  alterations: '',
  designerNotes: '',
};

/* -- Section definitions -- */
const DEFAULT_SECTION_ORDER = [
  { id: 'media', label: 'Media & Links', icon: '\uD83D\uDCF7' },
  { id: 'cast', label: 'Choose Cast', icon: '\uD83D\uDC64' },
  { id: 'scene', label: 'Scene & Episode', icon: '\uD83C\uDFAC' },
  { id: 'continuity', label: 'Continuity', icon: '\uD83D\uDD04' },
  { id: 'fittings', label: 'Fittings', icon: '\u2702\uFE0F' },
  { id: 'notes', label: 'Notes', icon: '\uD83D\uDCDD' },
];

const STORAGE_KEY = 'zillit-wardrobe-form-section-order';

const WardrobeFormV2 = ({ wardrobe, onSubmit, onClose, activeTab, toolType = 'main' }) => {
  const isShortlistOrFinal = activeTab === 'shortlist' || activeTab === 'final';
  const isFinal = activeTab === 'final';
  const req = (field) => {
    if (field === 'characterName') return true;
    if (field === 'sceneNumber') return isShortlistOrFinal;
    return false;
  };

  // -- CAST INFO --
  const [castId, setCastId] = useState(wardrobe?.castId || '');
  const [characterName, setCharacterName] = useState(wardrobe?.characterName || '');
  const [talentName, setTalentName] = useState(wardrobe?.talentName || '');
  const [gender, setGender] = useState(wardrobe?.gender || '');
  const [contactInfo, setContactInfo] = useState(wardrobe?.contactInfo || []);
  const [isTemporary, setIsTemporary] = useState(wardrobe?.isTemporary || false);

  // -- SCENE & EPISODE --
  const [episodes, setEpisodes] = useState(
    wardrobe?.episodes?.length ? wardrobe.episodes
    : wardrobe?.episode ? [wardrobe.episode]
    : ['']
  );
  const [sceneNumber, setSceneNumber] = useState(wardrobe?.sceneNumber || '');

  // -- CONTINUITY --
  const [costumeState, setCostumeState] = useState(wardrobe?.costumeState || '');
  const [accessories, setAccessories] = useState(wardrobe?.accessories || '');
  const [hairMakeupState, setHairMakeupState] = useState(wardrobe?.hairMakeupState || '');
  const [quickChange, setQuickChange] = useState(wardrobe?.quickChange || false);
  const [changeNotes, setChangeNotes] = useState(wardrobe?.changeNotes || '');
  const [continuityNotes, setContinuityNotes] = useState(wardrobe?.continuityNotes || '');

  // -- FITTINGS --
  const [fittings, setFittings] = useState(
    wardrobe?.fittings?.length ? wardrobe.fittings : [{ ...EMPTY_FITTING }]
  );

  // -- MEDIA & LINKS --
  const [newFiles, setNewFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState(wardrobe?.attachments || []);
  const [link, setLink] = useState(wardrobe?.link || '');
  const [linkPreview, setLinkPreview] = useState(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);

  // -- NOTES --
  const [description, setDescription] = useState(wardrobe?.description || '');

  // -- UI STATE --
  const [submitting, setSubmitting] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [showCastModal, setShowCastModal] = useState(false);
  const [castModalTab, setCastModalTab] = useState('finalized');

  // -- SECTION ORDER STATE (localStorage persisted) --
  const [sectionOrder, setSectionOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SECTION_ORDER.map((s) => s.id);
  });

  const [activeSection, setActiveSection] = useState(sectionOrder[0]);
  const [dragIdx, setDragIdx] = useState(null);

  const sectionRefs = useRef({});
  const formRef = useRef(null);

  // Save order to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  // Intersection Observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.dataset.section);
          }
        });
      },
      { threshold: 0.3, root: formRef.current }
    );

    Object.entries(sectionRefs.current).forEach(([id, el]) => {
      if (el) {
        el.dataset.section = id;
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [sectionOrder]);

  const baseUrl = WARDROBE_API_BASE_URL.replace('/api/v2/wardrobe', '');

  // Generate preview URLs for new files
  const newFilePreviews = useMemo(() => {
    return newFiles.map((file) => {
      if (file.type?.startsWith('image/')) return URL.createObjectURL(file);
      if (file.type?.startsWith('video/')) return 'video';
      return null;
    });
  }, [newFiles]);

  // -- Episodes management --
  const addEpisode = () => setEpisodes((prev) => [...prev, '']);
  const removeEpisode = (idx) => setEpisodes((prev) => prev.filter((_, i) => i !== idx));
  const updateEpisode = (idx, val) => {
    setEpisodes((prev) => prev.map((ep, i) => (i === idx ? val : ep)));
  };

  // -- Fittings management --
  const addFitting = () => setFittings((prev) => [...prev, { ...EMPTY_FITTING }]);
  const removeFitting = (idx) => setFittings((prev) => prev.filter((_, i) => i !== idx));
  const updateFitting = (idx, field, value) => {
    setFittings((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  // -- File handling --
  const handleFileChange = (info) => {
    const selected = info.fileList
      .map((f) => f.originFileObj || f)
      .filter((f) => f instanceof File);
    setNewFiles(selected);
  };
  const handleRemoveNewFile = (idx) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleRemoveExisting = (idx) => {
    setExistingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // -- Link preview --
  const handleFetchLinkPreview = async (url) => {
    const targetUrl = typeof url === 'string' ? url : link;
    if (!targetUrl || !targetUrl.startsWith('http')) return;
    setFetchingPreview(true);
    try {
      const resp = await wardrobeToolService.getLinkPreview(targetUrl);
      const preview = resp?.data || resp;
      if (!preview.image) {
        const platform = getPlatformFromUrl(targetUrl);
        if (platform) {
          preview.image = platform.logo;
          preview.isPlatformLogo = true;
          if (!preview.siteName) preview.siteName = platform.name.charAt(0).toUpperCase() + platform.name.slice(1);
        }
      }
      if (!preview.image && preview.favicon) {
        preview.image = preview.favicon;
        preview.isFavicon = true;
      }
      setLinkPreview(preview);
    } catch {
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
      setTimeout(() => handleFetchLinkPreview(pasted), 200);
    }
  };

  // -- Cast selection --
  const handleCastSelect = (castData) => {
    setCastId(castData.castId);
    setCharacterName(castData.characterName);
    setTalentName(castData.talentName);
    setGender(castData.gender);
    setContactInfo(castData.contactInfo);
    setIsTemporary(castData.isTemporary);
    setShowCastModal(false);
  };

  const openCastModal = (tab = 'finalized') => {
    setCastModalTab(tab);
    setShowCastModal(true);
  };

  // -- Reorder handler --
  const handleReorder = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setSectionOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  // -- Scroll to section --
  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // -- Form submission --
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // -- Frontend validation based on status --
    if (!characterName.trim()) {
      toast.error('Character Name is required');
      return;
    }
    if (isShortlistOrFinal) {
      const missing = [];
      if (!sceneNumber.trim()) missing.push('Scene Number');
      if (missing.length > 0) {
        toast.error(`Required for ${activeTab}: ${missing.join(', ')}`);
        return;
      }
    }
    if (isFinal && isTemporary) {
      toast.error('Cannot finalize with a temporary cast. Please assign a finalized cast first.');
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append('characterName', characterName);
    formData.append('talentName', talentName);
    formData.append('gender', gender);
    formData.append('castId', castId);
    formData.append('isTemporary', isTemporary);
    formData.append('sceneNumber', sceneNumber);
    formData.append('description', description);
    formData.append('link', link);

    // Continuity
    formData.append('costumeState', costumeState);
    formData.append('accessories', accessories);
    formData.append('hairMakeupState', hairMakeupState);
    formData.append('quickChange', quickChange);
    formData.append('changeNotes', changeNotes);
    formData.append('continuityNotes', continuityNotes);

    // Episodes
    const validEpisodes = episodes.filter((ep) => ep.trim());
    formData.append('episodes', JSON.stringify(validEpisodes));

    // Contact info
    const validContacts = contactInfo.filter(
      (c) => c.name || c.email || c.phone
    );
    formData.append('contactInfo', JSON.stringify(validContacts));

    // Fittings
    const validFittings = fittings.filter(
      (f) => f.fittingType || f.date || f.location || f.status
    );
    formData.append('fittings', JSON.stringify(validFittings));

    // toolType is appended by the hook — don't append here

    // Attachments
    if (wardrobe) {
      formData.append('existingAttachments', JSON.stringify(existingAttachments));
    }
    newFiles.forEach((file) => formData.append('files', file));

    await onSubmit(formData);

    setSubmitting(false);
  };

  // -- Section header renderer --
  const renderSectionHeader = (number, title, subtitle) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">{number}</span>
      <div>
        <h4 className="text-sm font-semibold text-gray-700 leading-none">{title}</h4>
        <p className="text-[11px] text-gray-400">{subtitle}</p>
      </div>
    </div>
  );

  // -- Section content renderer --
  const renderSection = (sectionId, number) => {
    switch (sectionId) {
      case 'media':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {renderSectionHeader(number, 'Media & Links', 'Costume photos, reference images, and links')}
            <div className="space-y-3">
              {/* File upload */}
              <div>
                <Upload.Dragger
                  multiple
                  accept="image/*,video/*,.pdf"
                  beforeUpload={() => false}
                  onChange={handleFileChange}
                  fileList={newFiles.map((file, idx) => ({
                    uid: `-${idx}`,
                    name: file.name,
                    status: 'done',
                    originFileObj: file,
                  }))}
                  showUploadList={false}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Drop files here or click to upload</p>
                  <p className="ant-upload-hint">Costume photos, fabric swatches, reference images</p>
                </Upload.Dragger>

                {/* Existing attachments */}
                {existingAttachments.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Existing files:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {existingAttachments.map((att, idx) => {
                        const fileUrl = getAttachmentUrl(att, baseUrl);
                        const attIsImage = isImageAtt(att);
                        const attIsVideo = isVideoAtt(att);
                        return (
                          <div key={`existing-${idx}`} className="relative group rounded-lg overflow-hidden border border-gray-200">
                            <div
                              className="h-20 bg-gray-50 flex items-center justify-center cursor-pointer"
                              onClick={() => attIsImage && setLightboxSrc(fileUrl)}
                            >
                              {attIsImage ? (
                                <img src={fileUrl} alt={getAttachmentName(att)} className="w-full h-full object-cover" />
                              ) : attIsVideo ? (
                                <VideoCameraOutlined style={{ fontSize: 24, color: '#666' }} />
                              ) : (
                                <FileOutlined style={{ fontSize: 24, color: '#666' }} />
                              )}
                              {attIsImage && (
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

                {/* New files */}
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

              {/* Link with OG preview */}
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
                  placeholder="Paste URL -- images will be auto-fetched"
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
        );

      case 'cast':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {renderSectionHeader(number, 'Choose Cast', 'Assign a finalized cast or create a temporary one')}
            <div className="space-y-3">
              {/* Current cast info */}
              {characterName && (
                <div className={`border rounded-lg p-4 ${isTemporary ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <UserOutlined className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800">{characterName}</div>
                      {talentName && <div className="text-xs text-gray-500">Talent: {talentName}</div>}
                      <div className="flex gap-1 mt-0.5">
                        {gender && <Tag className="!text-[10px] !m-0">{gender}</Tag>}
                        {isTemporary ? (
                          <Tag color="warning" className="!text-[10px] !m-0">Temporary</Tag>
                        ) : (
                          <Tag color="success" className="!text-[10px] !m-0">Finalized</Tag>
                        )}
                      </div>
                    </div>
                  </div>
                  {isTemporary && (
                    <div className="flex items-start gap-2 mt-3 p-2 bg-amber-100 rounded text-xs text-amber-700">
                      <WarningOutlined className="mt-0.5" />
                      <span>Temporary cast -- assign finalized cast before moving to Finalized</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  type="primary"
                  icon={<UserOutlined />}
                  onClick={() => openCastModal('finalized')}
                  className="flex-1"
                >
                  Choose Finalized Cast
                </Button>
                <Button
                  icon={<WarningOutlined />}
                  onClick={() => openCastModal('temporary')}
                  className="flex-1"
                >
                  Create Temporary Cast
                </Button>
              </div>

              {/* Manual character name override */}
              {!characterName && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Character Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="Select a cast above or type a character name"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 'scene':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {renderSectionHeader(number, 'Scene & Episode', 'Episode and scene details for this wardrobe')}
            <div className="space-y-3">
              {/* Episodes */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-gray-600">Episode(s)</label>
                  <Button type="link" size="small" icon={<PlusOutlined />} onClick={addEpisode} className="!px-1 text-xs">
                    Add Episode
                  </Button>
                </div>
                <div className="space-y-2">
                  {episodes.map((ep, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={ep}
                        onChange={(e) => updateEpisode(idx, e.target.value)}
                        placeholder={`Episode ${idx + 1} (e.g., EP01)`}
                      />
                      {episodes.length > 1 && (
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

              {/* Scene Number */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Scene Number {req('sceneNumber') && <span className="text-red-500">*</span>}
                </label>
                <Input
                  value={sceneNumber}
                  onChange={(e) => setSceneNumber(e.target.value)}
                  placeholder="e.g., Scene 12, Sc. 3A"
                />
              </div>
            </div>
          </div>
        );

      case 'continuity':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {renderSectionHeader(number, 'Continuity', 'Track costume state and continuity details')}
            <div className="grid grid-cols-2 gap-3">
              {/* Costume State */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Costume State</label>
                <Select
                  value={costumeState || undefined}
                  onChange={(val) => setCostumeState(val)}
                  placeholder="Select state..."
                  className="w-full"
                  allowClear
                  options={COSTUME_STATE_OPTIONS}
                />
              </div>

              {/* Quick Change */}
              <div className="flex items-end pb-1">
                <Checkbox
                  checked={quickChange}
                  onChange={(e) => setQuickChange(e.target.checked)}
                >
                  <span className="text-xs font-medium text-gray-600">Quick Change</span>
                </Checkbox>
              </div>

              {/* Accessories */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Accessories</label>
                <Input
                  value={accessories}
                  onChange={(e) => setAccessories(e.target.value)}
                  placeholder="e.g., Watch on left wrist, badge on belt"
                />
              </div>

              {/* Hair/Makeup State */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Hair/Makeup State</label>
                <Input
                  value={hairMakeupState}
                  onChange={(e) => setHairMakeupState(e.target.value)}
                  placeholder="e.g., Hair down, light bruise on cheek"
                />
              </div>

              {/* Change Notes */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Change Notes</label>
                <Input
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="e.g., Jacket removed in Scene 5"
                />
              </div>

              {/* Continuity Notes */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Continuity Notes</label>
                <Input.TextArea
                  value={continuityNotes}
                  onChange={(e) => setContinuityNotes(e.target.value)}
                  placeholder="Detailed continuity notes for this costume..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 'fittings':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {renderSectionHeader(number, 'Fittings', 'Track fitting sessions and alterations')}
            <div className="space-y-4">
              {fittings.map((fitting, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 relative">
                  {/* Fitting card header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">Fitting {idx + 1}</span>
                    <div className="flex gap-1">
                      {fittings.length > 1 && (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                          onClick={() => removeFitting(idx)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Fitting Type */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Fitting Type</label>
                      <Select
                        value={fitting.fittingType || undefined}
                        onChange={(val) => updateFitting(idx, 'fittingType', val)}
                        placeholder="Select type..."
                        className="w-full"
                        options={FITTING_TYPE_OPTIONS}
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                      <Select
                        value={fitting.status || undefined}
                        onChange={(val) => updateFitting(idx, 'status', val)}
                        placeholder="Select status..."
                        className="w-full"
                        options={FITTING_STATUS_OPTIONS}
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
                      <DatePicker
                        value={fitting.date ? dayjs(fitting.date) : null}
                        onChange={(d) => updateFitting(idx, 'date', d ? d.startOf('day').valueOf() : null)}
                        className="w-full"
                        placeholder="Select date"
                      />
                    </div>

                    {/* Time */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Time</label>
                      <Input
                        value={fitting.time}
                        onChange={(e) => updateFitting(idx, 'time', e.target.value)}
                        placeholder="e.g., 10:00 AM"
                      />
                    </div>

                    {/* Location */}
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
                      <Input
                        value={fitting.location}
                        onChange={(e) => updateFitting(idx, 'location', e.target.value)}
                        placeholder="e.g., Costume dept, Stage 4"
                      />
                    </div>

                    {/* Alterations */}
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Alterations</label>
                      <Input.TextArea
                        value={fitting.alterations}
                        onChange={(e) => updateFitting(idx, 'alterations', e.target.value)}
                        placeholder="e.g., Take in waist 1 inch, shorten sleeves"
                        rows={2}
                      />
                    </div>

                    {/* Designer Notes */}
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Designer Notes</label>
                      <Input.TextArea
                        value={fitting.designerNotes}
                        onChange={(e) => updateFitting(idx, 'designerNotes', e.target.value)}
                        placeholder="Notes from the costume designer..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addFitting}
                className="w-full"
                size="small"
              >
                Add Another Fitting
              </Button>
            </div>
          </div>
        );

      case 'notes':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {renderSectionHeader(number, 'Notes', 'Additional notes about this wardrobe')}
            <Input.TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes about this wardrobe..."
              rows={3}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* -- Header -- */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{wardrobe ? 'Edit Wardrobe' : 'Add New Wardrobe'}</h2>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>

        {/* -- Main content: sidebar + form -- */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Section Navigator */}
          <div className="w-48 border-r border-gray-200 bg-gray-50 overflow-y-auto py-2 flex-shrink-0">
            <div className="px-3 mb-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sections</span>
            </div>
            {sectionOrder.map((sectionId, idx) => {
              const section = DEFAULT_SECTION_ORDER.find((s) => s.id === sectionId);
              if (!section) return null;
              return (
                <div
                  key={sectionId}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(idx)); setDragIdx(idx); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleReorder(parseInt(e.dataTransfer.getData('text/plain')), idx); }}
                  className={`flex items-center gap-2 px-3 py-2 mx-2 rounded-lg cursor-pointer text-xs font-medium transition-all ${
                    activeSection === sectionId
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => scrollToSection(sectionId)}
                >
                  <span className="cursor-grab text-gray-400 hover:text-gray-600">{'\u2630'}</span>
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-800 text-white text-[10px] font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate">{section.label}</span>
                </div>
              );
            })}
          </div>

          {/* RIGHT: Form sections */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
          >
            {sectionOrder.map((sectionId, idx) => (
              <div key={sectionId} ref={(el) => { sectionRefs.current[sectionId] = el; }}>
                {renderSection(sectionId, idx + 1)}
              </div>
            ))}
          </form>
        </div>

        {/* -- Footer -- */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            {submitting ? 'Saving...' : wardrobe ? 'Update Wardrobe' : 'Add Wardrobe'}
          </Button>
        </div>
      </div>

      {/* -- Image Lightbox -- */}
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

      {/* -- Choose Cast Modal -- */}
      {showCastModal && (
        <ChooseCastModal
          onSelect={handleCastSelect}
          onClose={() => setShowCastModal(false)}
        />
      )}
    </div>
  );
};

export default WardrobeFormV2;
