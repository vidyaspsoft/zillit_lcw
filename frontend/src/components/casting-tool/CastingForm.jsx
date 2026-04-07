import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import { Modal, Button, Input, Select, Upload, Divider, AutoComplete, Radio, Calendar, Tag, Typography, Alert, Space, Row, Col, Rate, DatePicker } from 'antd';
import {
  CloseOutlined, UploadOutlined, DeleteOutlined, LinkOutlined,
  LoadingOutlined, PlusOutlined, FileOutlined, VideoCameraOutlined,
  EyeOutlined, EditOutlined, WarningOutlined, InboxOutlined,
} from '@ant-design/icons';
import { CASTING_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage as isImageAtt, isVideo as isVideoAtt, getAttachmentName } from '../../utils/attachmentHelpers';
import castingToolService from '../../services/castingToolService';
import { toast } from 'react-toastify';

const { Text } = Typography;

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

const EMPTY_CONTACT = {
  type: '',
  name: '',
  email: '',
  countryCode: '+91',
  phone: '',
  company: '',
};

const CONTACT_TYPE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'manager', label: 'Manager' },
  { value: 'talent', label: 'Talent (Direct)' },
  { value: 'other', label: 'Other' },
];

const JOB_FREQUENCY_OPTIONS = [
  { value: 'dayPlayer', label: 'Day Player', description: '1-2 shoot days' },
  { value: 'weekly', label: 'Weekly', description: 'Hired per week' },
  { value: 'recurring', label: 'Recurring', description: 'Multiple episodes or full season' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'nonBinary', label: 'Non-Binary' },
  { value: 'transgender', label: 'Transgender' },
  { value: 'other', label: 'Other' },
];

const BUILD_OPTIONS = [
  { value: 'athletic', label: 'Athletic' },
  { value: 'slim', label: 'Slim' },
  { value: 'average', label: 'Average' },
  { value: 'heavyset', label: 'Heavy-set' },
  { value: 'muscular', label: 'Muscular' },
];

const UNION_STATUS_OPTIONS = [
  { value: 'sag-aftra', label: 'SAG-AFTRA' },
  { value: 'non-union', label: 'Non-Union' },
  { value: 'fi-core', label: 'Fi-Core' },
  { value: 'actra', label: 'ACTRA' },
  { value: 'equity', label: 'Equity' },
];

const AUDITION_TYPE_OPTIONS = [
  { value: 'inPerson', label: 'In-Person' },
  { value: 'selfTape', label: 'Self-Tape' },
  { value: 'videoCall', label: 'Video Call' },
  { value: 'chemistryRead', label: 'Chemistry Read' },
  { value: 'tableRead', label: 'Table Read' },
];

const CALLBACK_OPTIONS = [
  { value: 0, label: 'No Callback' },
  { value: 1, label: '1st Callback' },
  { value: 2, label: '2nd Callback' },
  { value: 3, label: '3rd Callback' },
];

const MAIN_CAST_TYPE_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'guestStar', label: 'Guest Star' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'dayPlayer', label: 'Day Player' },
  { value: 'cameo', label: 'Cameo' },
  { value: 'voiceOver', label: 'Voice Over' },
  { value: 'stunt', label: 'Stunt' },
];

const BG_CAST_TYPE_OPTIONS = [
  { value: 'featuredExtra', label: 'Featured Extra' },
  { value: 'generalBackground', label: 'General Background' },
  { value: 'standIn', label: 'Stand-In' },
  { value: 'photoDouble', label: 'Photo Double' },
  { value: 'specialAbility', label: 'Special Ability' },
  { value: 'utilityStunts', label: 'Utility Stunts' },
  { value: 'silentBits', label: 'Silent Bits' },
];

const CastingForm = ({ casting, onSubmit, onClose, activeTab, toolType = 'main' }) => {
  const isShortlistOrFinal = activeTab === 'shortlist' || activeTab === 'final';
  const isFinal = activeTab === 'final';
  const req = (field) => {
    // Character name always required
    if (field === 'characterName') return true;
    // These are required in shortlist and final
    if (['talentName', 'gender', 'episode', 'castType', 'jobFrequency'].includes(field)) return isShortlistOrFinal;
    // Character number required only in final
    if (field === 'characterNumber') return isFinal;
    return false;
  };

  // ── CHARACTER INFO ──
  const [characterName, setCharacterName] = useState(casting?.characterName || '');
  const [episodes, setEpisodes] = useState(
    casting?.episodes?.length ? casting.episodes
    : casting?.episode ? [casting.episode]
    : ['']
  );
  const [castType, setCastType] = useState(casting?.castType || '');
  const [characterNumber, setCharacterNumber] = useState(casting?.characterNumber || '');
  const [characterNumberWarning, setCharacterNumberWarning] = useState('');

  // ── TALENT INFO ──
  const [talentName, setTalentName] = useState(casting?.talentName || '');
  const [gender, setGender] = useState(casting?.gender || '');
  const [jobFrequency, setJobFrequency] = useState(casting?.jobFrequency || '');

  // ── TALENT PROFILE ──
  const [age, setAge] = useState(casting?.age || '');
  const [ethnicity, setEthnicity] = useState(casting?.ethnicity || '');
  const [talentHeight, setTalentHeight] = useState(casting?.height || '');
  const [build, setBuild] = useState(casting?.build || '');
  const [hairColor, setHairColor] = useState(casting?.hairColor || '');
  const [eyeColor, setEyeColor] = useState(casting?.eyeColor || '');
  const [specialSkills, setSpecialSkills] = useState(casting?.specialSkills || '');
  const [unionStatus, setUnionStatus] = useState(casting?.unionStatus || '');

  // ── AUDITION ──
  const [auditionType, setAuditionType] = useState(casting?.auditionType || '');
  const [auditionDate, setAuditionDate] = useState(casting?.auditionDate || null);
  const [auditionTime, setAuditionTime] = useState(casting?.auditionTime || '');
  const [auditionLocation, setAuditionLocation] = useState(casting?.auditionLocation || '');
  const [auditionStatus, setAuditionStatus] = useState(casting?.auditionStatus || '');
  const [auditionRating, setAuditionRating] = useState(casting?.auditionRating || 0);
  const [auditionNotes, setAuditionNotes] = useState(casting?.auditionNotes || '');
  const [callbackRound, setCallbackRound] = useState(casting?.callbackRound || 0);
  const [sides, setSides] = useState(casting?.sides || '');

  // ── AVAILABILITY (stored as epoch ms) ──
  const [availabilityDates, setAvailabilityDates] = useState(
    casting?.availabilityDates || []
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ── CHARACTER BREAKDOWN ──
  const [breakdown, setBreakdown] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownChanged, setBreakdownChanged] = useState(false);
  const [characterDescription, setCharacterDescription] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [characterArc, setCharacterArc] = useState('');
  const [sceneCount, setSceneCount] = useState('');
  const [relationships, setRelationships] = useState('');

  // ── CONTACT INFO ──
  const [contacts, setContacts] = useState(
    casting?.contactInfo?.length ? casting.contactInfo : [{ ...EMPTY_CONTACT }]
  );

  // ── MEDIA & LINKS ──
  const [newFiles, setNewFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState(casting?.attachments || []);
  const [link, setLink] = useState(casting?.link || '');
  const [linkPreview, setLinkPreview] = useState(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);

  // ── NOTES ──
  const [description, setDescription] = useState(casting?.description || '');

  // ── UI STATE ──
  const [submitting, setSubmitting] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const charNumTimerRef = useRef(null);

  // ── AUTOCOMPLETE SUGGESTIONS ──
  const [charSuggestions, setCharSuggestions] = useState([]);
  const [talentSuggestions, setTalentSuggestions] = useState([]);
  const suggestTimerRef = useRef(null);

  const baseUrl = CASTING_API_BASE_URL.replace('/api/v2/casting', '');

  // Generate preview URLs for new files
  const newFilePreviews = useMemo(() => {
    return newFiles.map((file) => {
      if (file.type?.startsWith('image/')) return URL.createObjectURL(file);
      if (file.type?.startsWith('video/')) return 'video';
      return null;
    });
  }, [newFiles]);

  // ── Episodes management (same pattern as location) ──
  const addEpisode = () => setEpisodes((prev) => [...prev, '']);
  const removeEpisode = (idx) => setEpisodes((prev) => prev.filter((_, i) => i !== idx));
  const updateEpisode = (idx, val) => {
    setEpisodes((prev) => prev.map((ep, i) => (i === idx ? val : ep)));
  };

  // ── Character number validation (debounced) ──
  const handleCharacterNumberBlur = useCallback(async () => {
    const num = parseInt(characterNumber, 10);
    if (!num) {
      setCharacterNumberWarning('');
      return;
    }
    if (charNumTimerRef.current) clearTimeout(charNumTimerRef.current);
    charNumTimerRef.current = setTimeout(async () => {
      try {
        const result = await castingToolService.validateCharacterNumber(num, characterName);
        if (result?.conflict) {
          setCharacterNumberWarning(
            `#${num} is already assigned to ${result.existingCharacter || 'another character'}`
          );
        } else {
          setCharacterNumberWarning('');
        }
      } catch {
        setCharacterNumberWarning('');
      }
    }, 300);
  }, [characterNumber, characterName]);

  // ── Fetch character breakdown when character name changes ──
  useEffect(() => {
    if (!characterName || characterName.length < 2) {
      setBreakdown(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setBreakdownLoading(true);
        const res = await castingToolService.getCharacterBreakdown(characterName);
        const data = res.data?.[0] || null;
        setBreakdown(data);
        if (data) {
          setCharacterDescription(data.characterDescription || '');
          setAgeRange(data.ageRange || '');
          setCharacterArc(data.characterArc || '');
          setSceneCount(data.sceneCount || '');
          setRelationships(data.relationships || '');
        }
      } catch {} finally {
        setBreakdownLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [characterName]);

  // ── Autocomplete: search existing castings and auto-fill ──
  const handleSuggestSearch = useCallback((value, field) => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    if (!value || value.length < 2) {
      if (field === 'characterName') setCharSuggestions([]);
      else setTalentSuggestions([]);
      return;
    }
    suggestTimerRef.current = setTimeout(async () => {
      try {
        const res = await castingToolService.suggestCastings(value, field);
        const items = (res.data || []).map((s) => ({
          value: s.value,
          label: (
            <div className="flex flex-col py-0.5">
              <span className="font-medium text-sm">{s.value}</span>
              {field === 'characterName' && s.casting?.talentName && (
                <span className="text-xs text-gray-400">Talent: {s.casting.talentName} | {s.casting.castType || ''} | {s.casting.gender || ''}</span>
              )}
              {field === 'talentName' && s.casting?.characterName && (
                <span className="text-xs text-gray-400">Character: {s.casting.characterName} | {s.casting.castType || ''} | {s.casting.gender || ''}</span>
              )}
            </div>
          ),
          casting: s.casting,
        }));
        if (field === 'characterName') setCharSuggestions(items);
        else setTalentSuggestions(items);
      } catch {
        // Silently fail suggestions
      }
    }, 300);
  }, []);

  const handleSuggestionSelect = useCallback((value, option, field) => {
    const c = option.casting;
    if (!c) return;

    // Auto-fill all empty fields from the selected suggestion
    const fillAll = () => {
      if (c.castType && !castType) setCastType(c.castType);
      if (c.characterNumber && !characterNumber) setCharacterNumber(c.characterNumber);
      if (c.jobFrequency && !jobFrequency) setJobFrequency(c.jobFrequency);
      if (c.gender && !gender) setGender(c.gender);
      if (c.description && !description) setDescription(c.description);
      if (c.link && !link) setLink(c.link);
      if (c.availabilityDates?.length > 0 && availabilityDates.length === 0) {
        setAvailabilityDates(c.availabilityDates);
      }
      if (c.contactInfo?.length > 0 && contacts.length === 1 && !contacts[0].name) {
        setContacts(c.contactInfo);
      }
      if (c.age && !age) setAge(c.age);
      if (c.ethnicity && !ethnicity) setEthnicity(c.ethnicity);
      if (c.height && !talentHeight) setTalentHeight(c.height);
      if (c.build && !build) setBuild(c.build);
      if (c.hairColor && !hairColor) setHairColor(c.hairColor);
      if (c.eyeColor && !eyeColor) setEyeColor(c.eyeColor);
      if (c.specialSkills && !specialSkills) setSpecialSkills(c.specialSkills);
      if (c.unionStatus && !unionStatus) setUnionStatus(c.unionStatus);
      if (c.auditionType && !auditionType) setAuditionType(c.auditionType);
      if (c.auditionRating && !auditionRating) setAuditionRating(c.auditionRating);
    };

    if (field === 'characterName') {
      setCharacterName(value);
      if (c.talentName && !talentName) setTalentName(c.talentName);
      fillAll();
      setCharSuggestions([]);
    } else {
      setTalentName(value);
      if (c.characterName && !characterName) setCharacterName(c.characterName);
      fillAll();
      setTalentSuggestions([]);
    }
  }, [castType, characterNumber, jobFrequency, gender, characterName, talentName, description, link, contacts, availabilityDates, age, ethnicity, talentHeight, build, hairColor, eyeColor, specialSkills, unionStatus, auditionType, auditionRating]);

  // ── Availability dates management (epoch ms) ──
  const toggleDate = (dayjsDate) => {
    // Normalize to start of day epoch
    const epoch = dayjsDate.startOf('day').valueOf();
    setAvailabilityDates((prev) =>
      prev.includes(epoch) ? prev.filter((d) => d !== epoch) : [...prev, epoch].sort()
    );
  };
  const handleRemoveDate = (epoch) => {
    setAvailabilityDates((prev) => prev.filter((d) => d !== epoch));
  };
  const formatEpoch = (epoch) => dayjs(epoch).format('MMM D, YYYY');
  const isDateSelected = (current) => {
    const epoch = current.startOf('day').valueOf();
    return availabilityDates.includes(epoch);
  };

  // ── Contact management ──
  const addContact = () => setContacts((prev) => [...prev, { ...EMPTY_CONTACT }]);
  const removeContact = (idx) => setContacts((prev) => prev.filter((_, i) => i !== idx));
  const updateContact = (idx, field, value) => {
    setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  // ── File handling ──
  const handleFileChange = (info) => {
    // Ant Design Upload passes file objects — extract the raw File from originFileObj
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

  // ── Link preview ──
  const handleFetchLinkPreview = async (url) => {
    const targetUrl = typeof url === 'string' ? url : link;
    if (!targetUrl || !targetUrl.startsWith('http')) return;
    setFetchingPreview(true);
    try {
      const resp = await castingToolService.getLinkPreview(targetUrl);
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

  // ── Form submission ──
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ── Frontend validation based on status ──
    if (!characterName.trim()) {
      toast.error('Character Name is required');
      return;
    }
    const validEps = episodes.filter((ep) => ep.trim());
    if (isShortlistOrFinal) {
      const missing = [];
      if (!talentName.trim()) missing.push('Talent Name');
      if (!gender) missing.push('Gender');
      if (validEps.length === 0) missing.push('Episode');
      if (!castType) missing.push('Cast Type');
      if (!jobFrequency) missing.push('Job Frequency');
      if (isFinal && !characterNumber) missing.push('Character Number');
      if (missing.length > 0) {
        toast.error(`Required for ${activeTab}: ${missing.join(', ')}`);
        return;
      }
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append('characterName', characterName);
    formData.append('talentName', talentName);
    formData.append('gender', gender);
    formData.append('castType', castType);
    formData.append('jobFrequency', jobFrequency);
    if (characterNumber) formData.append('characterNumber', characterNumber);
    formData.append('description', description);
    formData.append('link', link);
    // Talent Profile
    if (age) formData.append('age', age);
    formData.append('ethnicity', ethnicity);
    formData.append('height', talentHeight);
    formData.append('build', build);
    formData.append('hairColor', hairColor);
    formData.append('eyeColor', eyeColor);
    formData.append('specialSkills', specialSkills);
    formData.append('unionStatus', unionStatus);
    // Audition
    formData.append('auditionType', auditionType);
    if (auditionDate) formData.append('auditionDate', auditionDate);
    formData.append('auditionTime', auditionTime);
    formData.append('auditionLocation', auditionLocation);
    formData.append('auditionStatus', auditionStatus);
    formData.append('auditionRating', auditionRating);
    formData.append('auditionNotes', auditionNotes);
    formData.append('callbackRound', callbackRound);
    formData.append('sides', sides);

    const validEpisodes = episodes.filter((ep) => ep.trim());
    formData.append('episodes', JSON.stringify(validEpisodes));
    formData.append('availabilityDates', JSON.stringify(availabilityDates));

    // Filter out empty contacts
    const validContacts = contacts.filter(
      (c) => c.name || c.email || c.phone
    );
    formData.append('contactInfo', JSON.stringify(validContacts));

    if (casting) {
      formData.append('existingAttachments', JSON.stringify(existingAttachments));
    }
    newFiles.forEach((file) => formData.append('files', file));

    await onSubmit(formData);

    // Save character breakdown if changed
    if (breakdownChanged && characterName) {
      try {
        await castingToolService.saveCharacterBreakdown({
          characterName,
          characterDescription,
          ageRange,
          characterArc,
          sceneCount: sceneCount || 0,
          relationships,
        });
      } catch {}
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{casting ? 'Edit Casting' : 'Add New Casting'}</h2>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ══════════════ CHOOSE EXISTING ══════════════ */}
          {!casting && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-blue-700">Quick Fill from Existing</h4>
                  <p className="text-xs text-blue-500">Choose an existing character to auto-fill all details</p>
                </div>
                <Select
                  showSearch
                  placeholder="Search character or talent..."
                  className="!w-64"
                  allowClear
                  filterOption={false}
                  onSearch={(val) => handleSuggestSearch(val, 'characterName')}
                  onSelect={(val, opt) => handleSuggestionSelect(val, opt, 'characterName')}
                  options={charSuggestions}
                  notFoundContent={null}
                />
              </div>
            </div>
          )}

          {/* ══════════════ 1. MEDIA & LINKS ══════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">1</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 leading-none">Media & Links</h4>
                <p className="text-[11px] text-gray-400">Headshots, audition tapes, and reference links</p>
              </div>
            </div>
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
                  <p className="ant-upload-hint">Headshots, audition tapes, self-tapes, resumes</p>
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

          {/* ══════════════ 2. CHARACTER INFO ══════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">2</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 leading-none">Character Info</h4>
                <p className="text-[11px] text-gray-400">Details about the character being cast</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Character Name */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Character Name {req('characterName') && <span className="text-red-500">*</span>}
                </label>
                <Input
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="e.g., Detective Ray, Nurse #2"
                />
              </div>

              {/* Episodes */}
              <div className="col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-gray-600">Episode(s) {req('episode') && <span className="text-red-500">*</span>}</label>
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

              {/* Cast Type */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Cast Type {req('castType') && <span className="text-red-500">*</span>}
                </label>
                <Select
                  value={castType || undefined}
                  onChange={(val) => setCastType(val)}
                  placeholder="Select cast type..."
                  className="w-full"
                  options={toolType === 'background' ? BG_CAST_TYPE_OPTIONS : MAIN_CAST_TYPE_OPTIONS}
                />
              </div>

              {/* Character Number */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Character Number {req('characterNumber') && <span className="text-red-500">*</span>}</label>
                <Input
                  type="number"
                  value={characterNumber}
                  onChange={(e) => { setCharacterNumber(e.target.value); setCharacterNumberWarning(''); }}
                  onBlur={handleCharacterNumberBlur}
                  placeholder="e.g., 1, 2, 3"
                  min={1}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Production ranking -- #1 is lead, #2 is second lead
                </p>
                {characterNumberWarning && (
                  <div className="flex items-center gap-1 mt-1 text-amber-600 text-xs">
                    <WarningOutlined />
                    <span>{characterNumberWarning}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════ 2b. CHARACTER BREAKDOWN ══════════════ */}
          {characterName && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <Button
                type="link"
                className="!px-5 !py-3 !text-blue-600 !font-semibold !w-full !text-left !flex !items-center !gap-2"
                onClick={() => setShowBreakdown(!showBreakdown)}
                loading={breakdownLoading}
              >
                {showBreakdown ? '\u25BC' : '\u25B6'} Character Details
                {breakdown && !showBreakdown && (
                  <span className="ml-2 text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Saved</span>
                )}
              </Button>

              {showBreakdown && (
                <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Character Description</label>
                    <Input.TextArea
                      value={characterDescription}
                      onChange={(e) => { setCharacterDescription(e.target.value); setBreakdownChanged(true); }}
                      placeholder="e.g., Tough detective, haunted by past, mid-40s"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Age Range</label>
                    <Input
                      value={ageRange}
                      onChange={(e) => { setAgeRange(e.target.value); setBreakdownChanged(true); }}
                      placeholder="e.g., 30-45"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Scene Count</label>
                    <Input
                      type="number"
                      value={sceneCount}
                      onChange={(e) => { setSceneCount(e.target.value); setBreakdownChanged(true); }}
                      placeholder="e.g., 25"
                      min={0}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Character Arc</label>
                    <Input.TextArea
                      value={characterArc}
                      onChange={(e) => { setCharacterArc(e.target.value); setBreakdownChanged(true); }}
                      placeholder="Brief story summary for this character"
                      rows={2}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Relationships</label>
                    <Input
                      value={relationships}
                      onChange={(e) => { setRelationships(e.target.value); setBreakdownChanged(true); }}
                      placeholder="e.g., Father of Sarah, partner of Detective Kim"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ 3. TALENT INFO ══════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">3</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 leading-none">Talent Info</h4>
                <p className="text-[11px] text-gray-400">Information about the actor or performer</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Talent Name */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Talent Name {req('talentName') && <span className="text-red-500">*</span>}
                </label>
                <Input
                  value={talentName}
                  onChange={(e) => setTalentName(e.target.value)}
                  placeholder="Actor / performer name"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Gender {req('gender') && <span className="text-red-500">*</span>}
                </label>
                <Select
                  value={gender || undefined}
                  onChange={(val) => setGender(val)}
                  placeholder="Select..."
                  className="w-full"
                  options={GENDER_OPTIONS}
                />
              </div>

              {/* Job Frequency */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Job Frequency {req('jobFrequency') && <span className="text-red-500">*</span>}
                </label>
                <Select
                  value={jobFrequency || undefined}
                  onChange={(val) => setJobFrequency(val)}
                  placeholder="Select..."
                  className="w-full"
                >
                  {JOB_FREQUENCY_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      <div>
                        <span>{opt.label}</span>
                        <span className="text-gray-400 text-xs ml-2">-- {opt.description}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* ══════════════ 4. TALENT PROFILE ══════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">4</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 leading-none">Talent Profile</h4>
                <p className="text-[11px] text-gray-400">Physical characteristics and professional details</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Age</label>
                <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g., 35" min={1} max={100} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Ethnicity / Appearance</label>
                <Input value={ethnicity} onChange={(e) => setEthnicity(e.target.value)} placeholder="e.g., South Asian, Caucasian" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Height</label>
                <Input value={talentHeight} onChange={(e) => setTalentHeight(e.target.value)} placeholder="e.g., 5'11&quot; or 180cm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Build</label>
                <Select value={build || undefined} onChange={(val) => setBuild(val)} placeholder="Select..." className="w-full" allowClear options={BUILD_OPTIONS} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Hair Color</label>
                <Input value={hairColor} onChange={(e) => setHairColor(e.target.value)} placeholder="e.g., Black, Blonde" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Eye Color</label>
                <Input value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} placeholder="e.g., Brown, Blue" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Special Skills</label>
                <Input value={specialSkills} onChange={(e) => setSpecialSkills(e.target.value)} placeholder="e.g., Martial arts, horseback riding, fluent Spanish" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Union Status</label>
                <Select value={unionStatus || undefined} onChange={(val) => setUnionStatus(val)} placeholder="Select..." className="w-full" allowClear options={UNION_STATUS_OPTIONS} />
              </div>
            </div>
          </div>

          {/* ══════════════ 5. AUDITION ══════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">5</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 leading-none">Audition</h4>
                <p className="text-[11px] text-gray-400">Audition details and rating</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Audition Type</label>
                <Select value={auditionType || undefined} onChange={(val) => setAuditionType(val)} placeholder="Select type..." className="w-full" allowClear options={AUDITION_TYPE_OPTIONS} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Audition Date</label>
                <DatePicker
                  value={auditionDate ? dayjs(auditionDate) : null}
                  onChange={(d) => setAuditionDate(d ? d.startOf('day').valueOf() : null)}
                  className="w-full"
                  placeholder="Select date"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Time</label>
                <Input value={auditionTime} onChange={(e) => setAuditionTime(e.target.value)} placeholder="e.g., 10:00 AM" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Location / Room</label>
                <Input value={auditionLocation} onChange={(e) => setAuditionLocation(e.target.value)} placeholder="e.g., Studio B, Room 3" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                <Select
                  value={auditionStatus || undefined}
                  onChange={(val) => setAuditionStatus(val)}
                  placeholder="Select status..."
                  className="w-full"
                  allowClear
                  options={[
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'confirmed', label: 'Confirmed' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' },
                    { value: 'noShow', label: 'No Show' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Callback Round</label>
                <Select value={callbackRound} onChange={(val) => setCallbackRound(val)} className="w-full" options={CALLBACK_OPTIONS} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Rating</label>
                <Rate value={auditionRating} onChange={(val) => setAuditionRating(val)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Sides / Script</label>
                <Input value={sides} onChange={(e) => setSides(e.target.value)} placeholder="e.g., Scene 12" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Audition Notes</label>
                <Input.TextArea value={auditionNotes} onChange={(e) => setAuditionNotes(e.target.value)} placeholder="How did the audition go?" rows={2} />
              </div>
            </div>
          </div>

          {/* ══════════════ 6. AVAILABILITY ══════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">6</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 leading-none">Availability</h4>
                <p className="text-[11px] text-gray-400">When is this talent free to shoot?</p>
              </div>
            </div>

            {/* Selected dates as tags */}
            {availabilityDates.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {availabilityDates.map((epoch) => (
                  <Tag
                    key={epoch}
                    closable
                    onClose={() => handleRemoveDate(epoch)}
                    color="blue"
                    className="!m-0"
                  >
                    {formatEpoch(epoch)}
                  </Tag>
                ))}
              </div>
            )}

            {/* Calendar toggle */}
            {!showCalendar ? (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setShowCalendar(true)}
                block
              >
                {availabilityDates.length > 0 ? 'Add More Dates' : 'Select Available Dates'}
              </Button>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <Calendar
                  fullscreen={false}
                  onSelect={(date) => toggleDate(date)}
                  fullCellRender={(current) => {
                    const selected = isDateSelected(current);
                    const isToday = current.isSame(dayjs(), 'day');
                    const isCurrentMonth = current.isSame(dayjs(), 'month');
                    return (
                      <div
                        className={`
                          flex items-center justify-center w-full h-full rounded-lg text-sm transition-all cursor-pointer
                          ${selected
                            ? 'bg-blue-500 text-white font-semibold'
                            : isToday
                              ? 'bg-orange-50 text-orange-600 font-medium'
                              : 'hover:bg-gray-100'
                          }
                          ${!isCurrentMonth && !selected ? 'text-gray-300' : ''}
                        `}
                        style={{ height: 28, lineHeight: '28px' }}
                      >
                        {current.date()}
                      </div>
                    );
                  }}
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                  <span className="text-xs text-gray-500">
                    {availabilityDates.length} date{availabilityDates.length !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    type="primary"
                    size="small"
                    className="btn-success"
                    onClick={() => setShowCalendar(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ══════════════ 7. CONTACT INFO ══════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">7</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 leading-none">Contact Info</h4>
                <p className="text-[11px] text-gray-400">Add agent, manager, or talent's direct contact</p>
              </div>
            </div>
            <div className="space-y-4">
              {contacts.map((contact, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 relative">
                  {/* Contact card header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">Contact {idx + 1}</span>
                    <div className="flex gap-1">
                      {contacts.length > 1 && (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                          onClick={() => removeContact(idx)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Type */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                      <Select
                        value={contact.type || undefined}
                        onChange={(val) => updateContact(idx, 'type', val)}
                        placeholder="Select type..."
                        className="w-full"
                        options={CONTACT_TYPE_OPTIONS}
                      />
                    </div>
                    {/* Name */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Name</label>
                      <Input
                        value={contact.name}
                        onChange={(e) => updateContact(idx, 'name', e.target.value)}
                        placeholder="Contact name"
                      />
                    </div>
                    {/* Email */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                      <Input
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateContact(idx, 'email', e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    {/* Phone with country code */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
                      <div className="flex gap-2">
                        <Select
                          value={contact.countryCode}
                          onChange={(val) => updateContact(idx, 'countryCode', val)}
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
                          value={contact.phone}
                          onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                          placeholder="Phone number"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    {/* Company */}
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Company</label>
                      <Input
                        value={contact.company}
                        onChange={(e) => updateContact(idx, 'company', e.target.value)}
                        placeholder="Agency / management company"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addContact}
                className="w-full"
                size="small"
              >
                Add Another Contact
              </Button>
            </div>
          </div>

          {/* ══════════════ 8. NOTES ══════════════ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">8</span>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 leading-none">Notes</h4>
                <p className="text-[11px] text-gray-400">Audition notes, director feedback, deal terms</p>
              </div>
            </div>
            <Input.TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes about this casting..."
              rows={3}
            />
          </div>

          {/* ── Submit ── */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {submitting ? 'Saving...' : casting ? 'Update Casting' : 'Add Casting'}
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

export default CastingForm;
