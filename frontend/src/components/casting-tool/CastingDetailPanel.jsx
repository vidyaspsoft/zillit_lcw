import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Tabs, Tooltip, Tag, Input, Timeline, Rate } from 'antd';
import {
  CloseOutlined, EditOutlined, DeleteOutlined, ArrowRightOutlined,
  SendOutlined, PictureOutlined, LinkOutlined, UserOutlined,
  PhoneOutlined, MailOutlined, EnvironmentOutlined, LeftOutlined,
  RightOutlined, MoreOutlined, EnterOutlined, CheckOutlined,
  PaperClipOutlined, FileTextOutlined, VideoCameraOutlined,
  NumberOutlined, PlaySquareOutlined, HomeOutlined,
  CalendarOutlined, TeamOutlined, TagOutlined,
} from '@ant-design/icons';
import {
  FiX, FiEdit2, FiTrash2, FiArrowRight, FiSend, FiImage,
  FiLink, FiUser, FiPhone, FiMail, FiMapPin,
  FiChevronLeft, FiChevronRight, FiSun, FiMoon, FiHome,
  FiNavigation, FiFileText, FiHash, FiFilm, FiPaperclip,
  FiMoreVertical, FiCornerUpLeft, FiCheck,
} from 'react-icons/fi';
import castingToolService from '../../services/castingToolService';
import { CASTING_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage, isVideo, isDocument, getAttachmentName } from '../../utils/attachmentHelpers';

const JOB_FREQUENCY_LABELS = {
  day_player: 'Day Player',
  weekly: 'Weekly',
  recurring: 'Recurring',
};

const CAST_TYPE_LABELS = {
  lead: 'Lead',
  supporting: 'Supporting',
  guestStar: 'Guest Star',
  recurring: 'Recurring',
  dayPlayer: 'Day Player',
  extra: 'Extra / Background',
  cameo: 'Cameo',
  voiceOver: 'Voice Over',
  stunt: 'Stunt',
  main: 'Main Cast',
  featuredExtra: 'Featured Extra',
  generalBackground: 'General Background',
  standIn: 'Stand-In',
  photoDouble: 'Photo Double',
  specialAbility: 'Special Ability',
  utilityStunts: 'Utility Stunts',
  silentBits: 'Silent Bits',
};

const AUDITION_TYPE_LABELS = {
  inPerson: 'In-Person',
  selfTape: 'Self-Tape',
  videoCall: 'Video Call',
  chemistryRead: 'Chemistry Read',
  tableRead: 'Table Read',
};

const CastingDetailPanel = ({ casting, onClose, onEdit }) => {
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('details');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [commentFiles, setCommentFiles] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const fileInputRef = useRef(null);
  const commentInputRef = useRef(null);
  const menuRef = useRef(null);

  // ── @mention helpers ──
  const getMentionableUsers = () => {
    const names = new Set();
    comments.forEach((c) => { if (c.userName) names.add(c.userName); });
    // Add current user
    try {
      const stored = localStorage.getItem('zillit-auth');
      if (stored) {
        const { user } = JSON.parse(stored);
        if (user?.name) names.add(user.name);
      }
    } catch {}
    return Array.from(names);
  };

  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionResults, setMentionResults] = useState([]);

  const handleCommentChange = (e) => {
    const val = e.target.value;
    setCommentText(val);
    // Detect @mention
    const cursorPos = e.target.selectionStart;
    const textBefore = val.substring(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      const users = getMentionableUsers().filter((u) => u.toLowerCase().includes(query));
      setMentionResults(users);
      setShowMentions(users.length > 0);
      setMentionQuery(atMatch[0]);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (userName) => {
    const input = commentInputRef.current?.resizableTextArea?.textArea || commentInputRef.current;
    if (!input) return;
    const cursorPos = input.selectionStart;
    const textBefore = commentText.substring(0, cursorPos);
    const textAfter = commentText.substring(cursorPos);
    const newBefore = textBefore.replace(/@\w*$/, `@${userName} `);
    setCommentText(newBefore + textAfter);
    setShowMentions(false);
    setTimeout(() => input.focus(), 50);
  };

  const renderCommentText = (text) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="text-blue-600 font-medium bg-blue-50 px-0.5 rounded">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const baseUrl = CASTING_API_BASE_URL.replace('/api/v2/casting', '');
  const attachments = casting.attachments || [];

  useEffect(() => {
    if (casting?._id) {
      loadDetails();
      setCurrentSlide(0);
    }
    // Fetch character breakdown
    if (casting?.characterName) {
      castingToolService.getCharacterBreakdown(casting.characterName)
        .then((res) => setBreakdown(res.data?.[0] || null))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casting?._id]);

  const loadDetails = async () => {
    try {
      const data = await castingToolService.getCastingById(casting._id);
      const result = data.data || data;
      setComments(result.comments || []);
      setActivities(result.activities || []);
    } catch {
      // silent
    }
  };

  const visibleComments = comments;

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() && commentFiles.length === 0) return;
    const formData = new FormData();
    formData.append('text', commentText.trim() || '(image)');
    if (replyTo) {
      formData.append('replyToId', replyTo._id);
      formData.append('replyToUserName', replyTo.userName || '');
      formData.append('replyToText', replyTo.text || '');
    }
    commentFiles.forEach((f) => formData.append('attachments', f));
    try {
      await castingToolService.createComment(casting._id, formData);
      setCommentText('');
      setCommentFiles([]);
      setReplyTo(null);
      loadDetails();
    } catch {
      // handled
    }
  };

  const handleReply = (comment) => {
    setReplyTo({ _id: comment._id, userName: comment.userName, text: comment.text });
    commentInputRef.current?.focus();
  };

  const handleSendImage = async () => {
    const att = attachments[currentSlide];
    if (!att?.media) return;
    try {
      const imgUrl = getAttachmentUrl(att, baseUrl);
      const resp = await fetch(imgUrl);
      const blob = await resp.blob();
      const file = new File([blob], getAttachmentName(att), { type: att.content_type ? `${att.content_type}/${att.content_subtype}` : (att.mimetype || 'image/jpeg') });
      const formData = new FormData();
      formData.append('text', '(image)');
      formData.append('attachments', file);
      await castingToolService.createComment(casting._id, formData);
      loadDetails();
      setActiveDetailTab('discussion');
    } catch {
      // handled
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setCommentFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeCommentFile = (index) => {
    setCommentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await castingToolService.deleteComment(commentId);
      setMenuOpenId(null);
      loadDetails();
    } catch {
      // handled
    }
  };

  const handleEditComment = (comment) => {
    setEditingComment({ _id: comment._id, text: comment.text || '' });
    setMenuOpenId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingComment || !editingComment.text.trim()) return;
    try {
      await castingToolService.updateComment(editingComment._id, editingComment.text.trim());
      setEditingComment(null);
      loadDetails();
    } catch {
      // handled
    }
  };

  const handleCancelEdit = () => setEditingComment(null);

  const handleDocClick = useCallback((e) => {
    if (menuRef.current && !menuRef.current.contains(e.target)) {
      setMenuOpenId(null);
    }
  }, []);

  useEffect(() => {
    if (menuOpenId) {
      document.addEventListener('mousedown', handleDocClick);
    }
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [menuOpenId, handleDocClick]);

  const prevSlide = () => setCurrentSlide((p) => Math.max(0, p - 1));
  const nextSlide = () => setCurrentSlide((p) => Math.min(attachments.length - 1, p + 1));

  const getAttUrl = (att) => getAttachmentUrl(att, baseUrl);

  const renderMainMedia = (att) => {
    if (!att?.media) return null;
    const url = getAttUrl(att);
    if (isVideo(att)) {
      return <video src={url} controls className="w-full h-full object-contain" />;
    }
    return <img src={url} alt="" className="w-full h-full object-contain" />;
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (val) => {
    if (!val) return '';
    return new Date(val).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };
  const availDates = casting.availabilityDates || [];

  const contacts = casting.contacts || [];
  const episodes = casting.episodes || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={handleOverlayClick}>
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold truncate">
            {casting.characterName || casting.talentName || 'Casting Detail'}
          </h2>
          <div className="flex items-center gap-1">
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(casting)} />
            </Tooltip>
            <Tooltip title="Close">
              <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
            </Tooltip>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Gallery */}
          <div className="flex flex-col border-b border-gray-200 bg-gray-50">
            {attachments.length > 0 ? (
              <>
                <div className="relative flex items-center justify-center bg-black/5 min-h-[200px] max-h-[300px]">
                  {renderMainMedia(attachments[currentSlide])}
                  {attachments.length > 1 && (
                    <>
                      <Button
                        shape="circle"
                        icon={<LeftOutlined />}
                        className="!absolute left-2 top-1/2 -translate-y-1/2 bg-white/80"
                        onClick={prevSlide}
                        disabled={currentSlide === 0}
                        size="small"
                      />
                      <Button
                        shape="circle"
                        icon={<RightOutlined />}
                        className="!absolute right-2 top-1/2 -translate-y-1/2 bg-white/80"
                        onClick={nextSlide}
                        disabled={currentSlide === attachments.length - 1}
                        size="small"
                      />
                    </>
                  )}
                  <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                    {currentSlide + 1} / {attachments.length}
                  </span>
                  <Button
                    size="small"
                    icon={<SendOutlined />}
                    className="!absolute bottom-2 right-2"
                    onClick={handleSendImage}
                  >
                    Reply
                  </Button>
                </div>
                {/* Thumbnail strip */}
                {attachments.length > 1 && (
                  <div className="flex gap-1 p-2 overflow-x-auto">
                    {attachments.map((att, idx) => (
                      <button
                        key={idx}
                        className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${
                          idx === currentSlide ? 'border-blue-500' : 'border-transparent'
                        }`}
                        onClick={() => setCurrentSlide(idx)}
                      >
                        {isVideo(att) ? (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <PlaySquareOutlined style={{ fontSize: 16, color: '#999' }} />
                          </div>
                        ) : (
                          <img src={getAttUrl(att)} alt="" className="w-full h-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-8">
                <PictureOutlined style={{ fontSize: 48 }} />
                <p className="mt-2">No attachments</p>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Detail sub-tabs */}
            <div className="flex border-b border-gray-200">
              {[
                { key: 'details', label: 'Details' },
                { key: 'discussion', label: `Discussion (${visibleComments.length})` },
                { key: 'activity', label: 'Activity' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
                    activeDetailTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveDetailTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeDetailTab === 'details' && (
                <div className="p-4 space-y-5 bg-white">
                  {/* CHARACTER Section */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Character</h4>

                    {/* Character Breakdown (shared details) */}
                    {breakdown && (
                      <div className="p-3 mb-3 bg-blue-50 border border-blue-100 rounded-lg space-y-1">
                        {breakdown.characterDescription && (
                          <p className="text-sm text-gray-700">{breakdown.characterDescription}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {breakdown.ageRange && <span>Age: <strong>{breakdown.ageRange}</strong></span>}
                          {breakdown.sceneCount > 0 && <span>Scenes: <strong>{breakdown.sceneCount}</strong></span>}
                          {breakdown.relationships && <span>Relationships: <strong>{breakdown.relationships}</strong></span>}
                        </div>
                        {breakdown.characterArc && (
                          <p className="text-xs text-gray-500 italic">{breakdown.characterArc}</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {casting.characterName && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <UserOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Character Name</label>
                            <p className="text-sm">{casting.characterName}</p>
                          </div>
                        </div>
                      )}

                      {casting.characterNumber && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <NumberOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Character Number</label>
                            <p className="text-sm">#{casting.characterNumber}</p>
                          </div>
                        </div>
                      )}

                      {casting.castType && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <TagOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Cast Type</label>
                            <div className="mt-0.5">
                              <Tag color="blue">{CAST_TYPE_LABELS[casting.castType] || casting.castType}</Tag>
                            </div>
                          </div>
                        </div>
                      )}

                      {casting.jobFrequency && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <TagOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Job Frequency</label>
                            <div className="mt-0.5">
                              <Tag color="green">{JOB_FREQUENCY_LABELS[casting.jobFrequency] || casting.jobFrequency}</Tag>
                            </div>
                          </div>
                        </div>
                      )}

                      {casting.gender && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <UserOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Gender</label>
                            <div className="mt-0.5">
                              <Tag>{casting.gender}</Tag>
                            </div>
                          </div>
                        </div>
                      )}

                      {episodes.length > 0 && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                          <PlaySquareOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Episodes</label>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {episodes.map((ep, idx) => (
                                <Tag key={idx} color="default">{ep}</Tag>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TALENT Section */}
                  {(casting.talentName || casting.availabilityStart || casting.availabilityEnd) && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Talent</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {casting.talentName && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <TeamOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Talent Name</label>
                              <p className="text-sm">{casting.talentName}</p>
                            </div>
                          </div>
                        )}

                        {availDates.length > 0 && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <CalendarOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Availability</label>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {availDates.map((epoch) => (
                                  <Tag key={epoch} color="blue" className="!m-0">
                                    {formatDate(epoch)}
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Talent Profile */}
                      {(casting.age || casting.ethnicity || casting.height || casting.build || casting.specialSkills || casting.unionStatus) && (
                        <div className="flex flex-wrap gap-x-6 gap-y-2 p-3 bg-gray-50 rounded-lg">
                          {casting.age && (
                            <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Age</span><span className="text-sm">{casting.age}</span></div>
                          )}
                          {casting.ethnicity && (
                            <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Ethnicity</span><span className="text-sm">{casting.ethnicity}</span></div>
                          )}
                          {casting.height && (
                            <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Height</span><span className="text-sm">{casting.height}</span></div>
                          )}
                          {casting.build && (
                            <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Build</span><span className="text-sm capitalize">{casting.build}</span></div>
                          )}
                          {casting.hairColor && (
                            <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Hair</span><span className="text-sm">{casting.hairColor}</span></div>
                          )}
                          {casting.eyeColor && (
                            <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Eyes</span><span className="text-sm">{casting.eyeColor}</span></div>
                          )}
                          {casting.unionStatus && (
                            <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Union</span><Tag color="purple">{casting.unionStatus}</Tag></div>
                          )}
                          {casting.specialSkills && (
                            <div className="w-full"><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Special Skills</span><span className="text-sm">{casting.specialSkills}</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AUDITION Section */}
                  {(casting.auditionType || casting.auditionRating > 0 || casting.callbackRound > 0 || casting.auditionNotes || casting.sides || casting.auditionDate || casting.auditionTime || casting.auditionLocation) && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold border-b border-gray-100 pb-1">Audition</h4>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 p-3 bg-gray-50 rounded-lg">
                        {casting.auditionType && (
                          <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Type</span><Tag color="cyan">{AUDITION_TYPE_LABELS[casting.auditionType] || casting.auditionType}</Tag></div>
                        )}
                        {casting.auditionDate && (
                          <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Date</span><span className="text-sm">{formatDate(casting.auditionDate)}</span></div>
                        )}
                        {casting.auditionTime && (
                          <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Time</span><span className="text-sm">{casting.auditionTime}</span></div>
                        )}
                        {casting.auditionLocation && (
                          <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Location</span><span className="text-sm">{casting.auditionLocation}</span></div>
                        )}
                        {casting.auditionStatus && (
                          <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Status</span><Tag color={
                            casting.auditionStatus === 'confirmed' ? 'green' :
                            casting.auditionStatus === 'completed' ? 'blue' :
                            casting.auditionStatus === 'cancelled' ? 'red' :
                            casting.auditionStatus === 'noShow' ? 'red' : 'default'
                          }>{casting.auditionStatus === 'noShow' ? 'No Show' : casting.auditionStatus?.charAt(0).toUpperCase() + casting.auditionStatus?.slice(1)}</Tag></div>
                        )}
                        {casting.auditionRating > 0 && (
                          <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Rating</span><Rate disabled value={casting.auditionRating} style={{ fontSize: 14 }} /></div>
                        )}
                        {casting.callbackRound > 0 && (
                          <div><span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block">Callback</span><Tag color="orange">Round {casting.callbackRound}</Tag></div>
                        )}
                      </div>
                      {casting.sides && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">Sides / Script</span>
                          <span className="text-sm">{casting.sides}</span>
                        </div>
                      )}
                      {casting.auditionNotes && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">Audition Notes</span>
                          <span className="text-sm text-gray-700">{casting.auditionNotes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONTACTS Section */}
                  {contacts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contacts</h4>
                      <div className="space-y-2">
                        {contacts.map((contact, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-1.5">
                            <div className="flex items-center gap-2">
                              {contact.type && (
                                <Tag color="purple" className="!text-[10px] !px-1.5 !py-0 !leading-5">{contact.type}</Tag>
                              )}
                              {contact.name && <span className="text-sm font-medium">{contact.name}</span>}
                            </div>
                            {contact.company && (
                              <p className="text-xs text-gray-500">{contact.company}</p>
                            )}
                            <div className="flex flex-wrap gap-3">
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                                  <MailOutlined style={{ fontSize: 12 }} />
                                  {contact.email}
                                </a>
                              )}
                              {contact.phone && (
                                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                                  <PhoneOutlined style={{ fontSize: 12 }} />
                                  {contact.phone}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NOTES Section */}
                  {casting.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                      <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <FileTextOutlined className="text-gray-400 mt-0.5" />
                        <p className="text-sm">{casting.description}</p>
                      </div>
                    </div>
                  )}

                  {/* LINK Section */}
                  {casting.link && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Link</h4>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                        <LinkOutlined className="text-gray-400" />
                        <a href={casting.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 truncate hover:underline">
                          {casting.link}
                        </a>
                      </div>
                      {casting.linkPreview && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          {casting.linkPreview.image && (
                            <img src={casting.linkPreview.image} alt="" className="w-full h-32 object-cover rounded mb-2" />
                          )}
                          {casting.linkPreview.title && (
                            <p className="text-sm font-medium">{casting.linkPreview.title}</p>
                          )}
                          {casting.linkPreview.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{casting.linkPreview.description}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ATTACHMENTS Section (file grid for non-image/video files) */}
                  {attachments.filter((a) => isDocument(a)).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Attachments</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {attachments
                          .filter((a) => isDocument(a))
                          .map((att, idx) => (
                            <a
                              key={idx}
                              href={getAttUrl(att)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center gap-1 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                            >
                              <FileTextOutlined style={{ fontSize: 24, color: '#999' }} />
                              <span className="text-[10px] text-gray-500 truncate max-w-full text-center">
                                {getAttachmentName(att)}
                              </span>
                            </a>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Uploaded By */}
                  {casting.createdBy?.name && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <UserOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Uploaded By</label>
                        <p className="text-sm">{casting.createdBy.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'discussion' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {visibleComments.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-8">
                        No discussion yet.<br />Start the conversation.
                      </p>
                    )}
                    {visibleComments.map((c) => (
                      <div key={c._id} className="space-y-1">
                        {/* Reply-to bubble */}
                        {c.replyTo?.commentId && (
                          <div className="ml-2 px-3 py-1 bg-gray-100 border-l-2 border-gray-300 rounded text-xs text-gray-500">
                            <span className="font-semibold">{c.replyTo.userName || 'User'}</span>{' '}
                            <span>{c.replyTo.text || '(image)'}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-800">{c.userName || 'User'}</span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(c.createdAt).toLocaleDateString()}
                              </span>
                              {/* Three-dot menu */}
                              <div className="relative ml-auto" ref={menuOpenId === c._id ? menuRef : null}>
                                <button
                                  className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                                  onClick={() => setMenuOpenId(menuOpenId === c._id ? null : c._id)}
                                >
                                  <FiMoreVertical size={14} className="text-gray-400" />
                                </button>
                                {menuOpenId === c._id && (
                                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-28">
                                    <button
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50"
                                      onClick={() => { handleReply(c); setMenuOpenId(null); }}
                                    >
                                      <FiCornerUpLeft size={13} /> Reply
                                    </button>
                                    <button
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50"
                                      onClick={() => handleEditComment(c)}
                                    >
                                      <FiEdit2 size={13} /> Edit
                                    </button>
                                    <button
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                                      onClick={() => handleDeleteComment(c._id)}
                                    >
                                      <FiTrash2 size={13} /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Editable text or normal text */}
                            {editingComment && editingComment._id === c._id ? (
                              <div className="flex items-center gap-1 mt-1">
                                <input
                                  type="text"
                                  value={editingComment.text}
                                  onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-400"
                                  autoFocus
                                />
                                <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleSaveEdit} className="btn-success" />
                                <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleCancelEdit} />
                              </div>
                            ) : (
                              c.text && c.text !== '(image)' && (
                                <p className="text-sm text-gray-700 mt-0.5">{renderCommentText(c.text)}</p>
                              )
                            )}
                            {/* Comment attachments */}
                            {c.attachments && c.attachments.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {c.attachments.map((att, i) => (
                                  <div
                                    key={i}
                                    className="w-16 h-16 rounded-md overflow-hidden cursor-pointer border border-gray-200"
                                    onClick={() => setLightboxSrc(getAttachmentUrl(att, baseUrl))}
                                  >
                                    {isImage(att) ? (
                                      <img src={getAttachmentUrl(att, baseUrl)} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-0.5">
                                        <FileTextOutlined style={{ fontSize: 16, color: '#999' }} />
                                        <span className="text-[8px] text-gray-400 truncate max-w-full px-1">{getAttachmentName(att)}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* File previews before sending */}
                  {commentFiles.length > 0 && (
                    <div className="flex gap-2 px-4 py-2 border-t border-gray-100">
                      {commentFiles.map((f, i) => (
                        <div key={i} className="relative w-12 h-12 rounded overflow-hidden border border-gray-200">
                          {f.type.startsWith('image') ? (
                            <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <FileTextOutlined style={{ fontSize: 14, color: '#999' }} />
                            </div>
                          )}
                          <button
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px]"
                            onClick={() => removeCommentFile(i)}
                          >
                            <CloseOutlined style={{ fontSize: 8 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply indicator */}
                  {replyTo && (
                    <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-t border-blue-100">
                      <div className="text-xs text-blue-600">
                        <span>Replying to <strong>{replyTo.userName || 'User'}</strong></span>
                        <span className="text-blue-400 ml-2">{replyTo.text?.substring(0, 60) || '(image)'}</span>
                      </div>
                      <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setReplyTo(null)} />
                    </div>
                  )}

                  {/* Comment input with attach button */}
                  <form className="relative flex items-center gap-2 px-4 py-3 border-t border-gray-200" onSubmit={handleAddComment}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*,video/*,.pdf"
                      multiple
                      hidden
                    />
                    <Button
                      type="text"
                      icon={<PaperClipOutlined />}
                      onClick={() => fileInputRef.current?.click()}
                    />
                    <input
                      ref={commentInputRef}
                      type="text"
                      placeholder={replyTo ? `Reply to ${replyTo.userName}...` : 'Add a comment...'}
                      value={commentText}
                      onChange={handleCommentChange}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                    />
                    {showMentions && (
                      <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto w-48">
                        {mentionResults.map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 border-none bg-transparent cursor-pointer"
                            onClick={() => insertMention(name)}
                          >
                            @{name}
                          </button>
                        ))}
                      </div>
                    )}
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SendOutlined />}
                      disabled={!commentText.trim() && commentFiles.length === 0}
                      size="small"
                    />
                  </form>
                </div>
              )}

              {activeDetailTab === 'activity' && (() => {
                const filteredActivities = activities.filter(
                  (a) => a.action !== 'commented'
                );

                const actionLabels = {
                  created: 'Created',
                  edited: 'Updated details',
                  moved: 'Moved to another status',
                  status_changed: 'Changed status',
                  deleted: 'Deleted',
                  restored: 'Restored',
                  attachment_added: 'Added attachments',
                  generated_pdf: 'Generated PDF',
                  shared: 'Shared',
                };

                const actionColors = {
                  created: 'bg-green-400',
                  edited: 'bg-blue-400',
                  moved: 'bg-orange-400',
                  deleted: 'bg-red-400',
                  restored: 'bg-green-400',
                  shared: 'bg-purple-400',
                  generated_pdf: 'bg-purple-400',
                };

                return (
                  <div className="p-4">
                    {filteredActivities.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>}
                    <div className="space-y-3">
                      {filteredActivities.map((a) => (
                        <div key={a._id} className="flex gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${actionColors[a.action] || 'bg-gray-400'}`} />
                          <div>
                            <span className="text-xs font-semibold text-gray-800">{a.userName || 'User'}</span>{' '}
                            <span className="text-xs text-gray-500">
                              {actionLabels[a.action] || a.action}
                            </span>
                            {a.details && <p className="text-xs text-gray-400 mt-0.5">{a.details}</p>}
                            <span className="text-[10px] text-gray-400">
                              {new Date(a.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for comment images */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" onClick={() => setLightboxSrc(null)}>
          <Button
            type="text"
            icon={<CloseOutlined />}
            className="!absolute top-4 right-4 !text-white"
            onClick={() => setLightboxSrc(null)}
          />
          <img src={lightboxSrc} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default CastingDetailPanel;
