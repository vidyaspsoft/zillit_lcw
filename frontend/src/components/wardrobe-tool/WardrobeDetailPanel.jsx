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
  ScissorOutlined, SkinOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import {
  FiX, FiEdit2, FiTrash2, FiArrowRight, FiSend, FiImage,
  FiLink, FiUser, FiPhone, FiMail, FiMapPin,
  FiChevronLeft, FiChevronRight, FiSun, FiMoon, FiHome,
  FiNavigation, FiFileText, FiHash, FiFilm, FiPaperclip,
  FiMoreVertical, FiCornerUpLeft, FiCheck,
} from 'react-icons/fi';
import wardrobeToolService from '../../services/wardrobeToolService';
import { WARDROBE_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage, isVideo, isDocument, getAttachmentName } from '../../utils/attachmentHelpers';

const COSTUME_STATE_LABELS = {
  hero: 'Hero',
  stunt: 'Stunt Double',
  background: 'Background',
  multiples: 'Multiples',
  aged: 'Aged/Distressed',
  clean: 'Clean',
  damaged: 'Damaged',
  bloody: 'Bloody',
  wet: 'Wet',
};

const COSTUME_STATE_COLORS = {
  hero: 'blue',
  stunt: 'orange',
  background: 'default',
  multiples: 'purple',
  aged: 'gold',
  clean: 'green',
  damaged: 'red',
  bloody: 'red',
  wet: 'cyan',
};

const FITTING_STATUS_LABELS = {
  scheduled: 'Scheduled',
  inProgress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  needsAlterations: 'Needs Alterations',
  approved: 'Approved',
};

const FITTING_STATUS_COLORS = {
  scheduled: 'blue',
  inProgress: 'orange',
  completed: 'green',
  cancelled: 'red',
  needsAlterations: 'gold',
  approved: 'cyan',
};

const WardrobeDetailPanel = ({ wardrobe, onClose, onEdit }) => {
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('details');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [commentFiles, setCommentFiles] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
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

  const baseUrl = WARDROBE_API_BASE_URL.replace('/api/v2/wardrobe', '');
  const attachments = wardrobe.attachments || [];

  useEffect(() => {
    if (wardrobe?._id) {
      loadDetails();
      setCurrentSlide(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardrobe?._id]);

  const loadDetails = async () => {
    try {
      const data = await wardrobeToolService.getWardrobeById(wardrobe._id);
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
      await wardrobeToolService.createComment(wardrobe._id, formData);
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
      await wardrobeToolService.createComment(wardrobe._id, formData);
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
      await wardrobeToolService.deleteComment(commentId);
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
      await wardrobeToolService.updateComment(editingComment._id, editingComment.text.trim());
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

  const contacts = wardrobe.contacts || [];
  const fittings = wardrobe.fittings || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={handleOverlayClick}>
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold truncate">
            {wardrobe.characterName || wardrobe.talentName || 'Wardrobe Detail'}
          </h2>
          <div className="flex items-center gap-1">
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(wardrobe)} />
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
                  {/* CAST Section */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cast</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {wardrobe.characterName && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <UserOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Character Name</label>
                            <p className="text-sm">{wardrobe.characterName}</p>
                          </div>
                        </div>
                      )}

                      {wardrobe.talentName && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <TeamOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Talent Name</label>
                            <p className="text-sm">{wardrobe.talentName}</p>
                          </div>
                        </div>
                      )}

                      {wardrobe.gender && (
                        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <UserOutlined className="text-gray-400 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Gender</label>
                            <div className="mt-0.5">
                              <Tag>{wardrobe.gender}</Tag>
                            </div>
                          </div>
                        </div>
                      )}

                      {wardrobe.isTemporary && (
                        <div className="flex gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <TagOutlined className="text-yellow-500 mt-0.5" />
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Cast Status</label>
                            <div className="mt-0.5">
                              <Tag color="gold">Temporary</Tag>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SCENE Section */}
                  {(wardrobe.episode || wardrobe.sceneNumber) && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Scene</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {wardrobe.episode && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <PlaySquareOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Episode</label>
                              <p className="text-sm">{wardrobe.episode}</p>
                            </div>
                          </div>
                        )}

                        {wardrobe.sceneNumber && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <NumberOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Scene Number</label>
                              <p className="text-sm">{wardrobe.sceneNumber}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CONTINUITY Section */}
                  {(wardrobe.costumeState || wardrobe.accessories || wardrobe.hairMakeupState || wardrobe.quickChange || wardrobe.changeNotes || wardrobe.continuityNotes) && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Continuity</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {wardrobe.costumeState && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <SkinOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Costume State</label>
                              <div className="mt-0.5">
                                <Tag color={COSTUME_STATE_COLORS[wardrobe.costumeState] || 'default'}>
                                  {COSTUME_STATE_LABELS[wardrobe.costumeState] || wardrobe.costumeState}
                                </Tag>
                              </div>
                            </div>
                          </div>
                        )}

                        {wardrobe.accessories && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <TagOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Accessories</label>
                              <p className="text-sm">{wardrobe.accessories}</p>
                            </div>
                          </div>
                        )}

                        {wardrobe.hairMakeupState && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <ScissorOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Hair & Makeup</label>
                              <p className="text-sm">{wardrobe.hairMakeupState}</p>
                            </div>
                          </div>
                        )}

                        {wardrobe.quickChange && (
                          <div className="flex gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <ThunderboltOutlined className="text-orange-500 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Quick Change</label>
                              <div className="mt-0.5">
                                <Tag color="orange">Quick Change</Tag>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {wardrobe.changeNotes && (
                        <div className="p-3 mt-3 bg-gray-50 rounded-lg">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">Change Notes</span>
                          <span className="text-sm text-gray-700">{wardrobe.changeNotes}</span>
                        </div>
                      )}

                      {wardrobe.continuityNotes && (
                        <div className="p-3 mt-3 bg-gray-50 rounded-lg">
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">Continuity Notes</span>
                          <span className="text-sm text-gray-700">{wardrobe.continuityNotes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* FITTINGS Section */}
                  {fittings.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fittings</h4>
                      <div className="space-y-2">
                        {fittings.map((fitting, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1.5">
                            <div className="flex items-center gap-2">
                              {fitting.type && (
                                <Tag color="purple" className="!text-[10px] !px-1.5 !py-0 !leading-5">{fitting.type}</Tag>
                              )}
                              {fitting.date && (
                                <span className="text-xs text-gray-500">{formatDate(fitting.date)}</span>
                              )}
                              {fitting.status && (
                                <Tag color={FITTING_STATUS_COLORS[fitting.status] || 'default'} className="!m-0">
                                  {FITTING_STATUS_LABELS[fitting.status] || fitting.status}
                                </Tag>
                              )}
                            </div>
                            {fitting.alterations && (
                              <p className="text-xs text-gray-600"><strong>Alterations:</strong> {fitting.alterations}</p>
                            )}
                            {fitting.notes && (
                              <p className="text-xs text-gray-500">{fitting.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NOTES Section */}
                  {wardrobe.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                      <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <FileTextOutlined className="text-gray-400 mt-0.5" />
                        <p className="text-sm">{wardrobe.description}</p>
                      </div>
                    </div>
                  )}

                  {/* LINK Section */}
                  {wardrobe.link && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Link</h4>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                        <LinkOutlined className="text-gray-400" />
                        <a href={wardrobe.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 truncate hover:underline">
                          {wardrobe.link}
                        </a>
                      </div>
                      {wardrobe.linkPreview && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          {wardrobe.linkPreview.image && (
                            <img src={wardrobe.linkPreview.image} alt="" className="w-full h-32 object-cover rounded mb-2" />
                          )}
                          {wardrobe.linkPreview.title && (
                            <p className="text-sm font-medium">{wardrobe.linkPreview.title}</p>
                          )}
                          {wardrobe.linkPreview.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{wardrobe.linkPreview.description}</p>
                          )}
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
                  {wardrobe.createdBy?.name && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <UserOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Uploaded By</label>
                        <p className="text-sm">{wardrobe.createdBy.name}</p>
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
                  fitting_added: 'Added fitting',
                  fitting_updated: 'Updated fitting',
                  cast_replaced: 'Replaced cast',
                };

                const actionColors = {
                  created: 'bg-green-400',
                  edited: 'bg-blue-400',
                  moved: 'bg-orange-400',
                  deleted: 'bg-red-400',
                  restored: 'bg-green-400',
                  shared: 'bg-purple-400',
                  generated_pdf: 'bg-purple-400',
                  fitting_added: 'bg-cyan-400',
                  fitting_updated: 'bg-cyan-400',
                  cast_replaced: 'bg-yellow-400',
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

export default WardrobeDetailPanel;
