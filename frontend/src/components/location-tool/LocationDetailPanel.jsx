import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Tabs, Tooltip, Tag, Input, Timeline } from 'antd';
import {
  CloseOutlined, EditOutlined, DeleteOutlined, ArrowRightOutlined,
  SendOutlined, PictureOutlined, LinkOutlined, UserOutlined,
  PhoneOutlined, MailOutlined, EnvironmentOutlined, LeftOutlined,
  RightOutlined, MoreOutlined, EnterOutlined, CheckOutlined,
  PaperClipOutlined, FileTextOutlined, VideoCameraOutlined,
  NumberOutlined, PlaySquareOutlined, HomeOutlined,
} from '@ant-design/icons';
import {
  FiX, FiEdit2, FiTrash2, FiArrowRight, FiSend, FiImage,
  FiLink, FiUser, FiPhone, FiMail, FiMapPin,
  FiChevronLeft, FiChevronRight, FiSun, FiMoon, FiHome,
  FiNavigation, FiFileText, FiHash, FiFilm, FiPaperclip,
  FiMoreVertical, FiCornerUpLeft, FiCheck,
} from 'react-icons/fi';
import locationToolService from '../../services/locationToolService';
import { LOCATION_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage, isVideo, isDocument, getAttachmentName } from '../../utils/attachmentHelpers';

const LocationDetailPanel = ({ location, onClose, onEdit, onDelete, onMove, activeTab }) => {
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('details');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [commentFiles, setCommentFiles] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [replyTo, setReplyTo] = useState(null); // { _id, userName, text }
  const [menuOpenId, setMenuOpenId] = useState(null); // comment _id whose menu is open
  const [editingComment, setEditingComment] = useState(null); // { _id, text }
  const fileInputRef = useRef(null);
  const commentInputRef = useRef(null);
  const menuRef = useRef(null);
  const baseUrl = LOCATION_API_BASE_URL.replace('/api/v2/location', '');
  const attachments = location.attachments || [];

  // Context is now inherent in the location doc itself (single episode per doc)
  const hasContext = !!(location.episode || location.sceneNumber);
  const contextLabel = [
    location.episode ? `Ep ${location.episode}` : '',
    location.sceneNumber ? `Scene ${location.sceneNumber}` : '',
  ].filter(Boolean).join(', ');

  useEffect(() => {
    if (location?._id) {
      loadDetails();
      setCurrentSlide(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?._id]);

  const loadDetails = async () => {
    try {
      const data = await locationToolService.getLocationById(location._id);
      const result = data.data || data;
      setComments(result.comments || []);
      setActivities(result.activities || []);
    } catch {
      // silent
    }
  };

  // All comments on this document are for this specific context (no filtering needed)
  const visibleComments = comments;

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() && commentFiles.length === 0) return;
    const formData = new FormData();
    formData.append('text', commentText.trim() || '(image)');
    // Reply threading
    if (replyTo) {
      formData.append('replyToId', replyTo._id);
      formData.append('replyToUserName', replyTo.userName || '');
      formData.append('replyToText', replyTo.text || '');
    }
    commentFiles.forEach((f) => formData.append('attachments', f));
    try {
      await locationToolService.createComment(location._id, formData);
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

  // Send current slide image as a discussion message
  const handleSendImage = async () => {
    const att = attachments[currentSlide];
    if (!att?.media) return;
    // Fetch the image as a blob and send it
    try {
      const imgUrl = getAttachmentUrl(att, baseUrl);
      const resp = await fetch(imgUrl);
      const blob = await resp.blob();
      const file = new File([blob], getAttachmentName(att), { type: att.mimetype || 'image/jpeg' });
      const formData = new FormData();
      formData.append('text', '(image)');
      formData.append('attachments', file);
      await locationToolService.createComment(location._id, formData);
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
      await locationToolService.deleteComment(commentId);
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
      await locationToolService.updateComment(editingComment._id, editingComment.text.trim());
      setEditingComment(null);
      loadDetails();
    } catch {
      // handled
    }
  };

  const handleCancelEdit = () => setEditingComment(null);

  // Close menu on outside click
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

  // Stop click from closing the overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={handleOverlayClick}>
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold truncate">
            {location.fileName || location.sceneNumber || 'Location Detail'}
          </h2>
          <div className="flex items-center gap-1">
            {activeTab !== 'final' && (
              <>
                <Tooltip title="Edit">
                  <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(location)} />
                </Tooltip>
                <Tooltip title="Move">
                  <Button type="text" icon={<ArrowRightOutlined />} onClick={() => onMove(location)} />
                </Tooltip>
              </>
            )}
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(location)} />
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
                  {/* Send this image to discussion */}
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
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <PictureOutlined style={{ fontSize: 48 }} />
                <p className="mt-2">No attachments</p>
              </div>
            )}

            {/* Link Preview */}
            {location.link && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white border-t border-gray-200 text-sm">
                <LinkOutlined className="text-gray-400" />
                <a href={location.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 truncate hover:underline">
                  {location.link}
                </a>
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
                <div className="p-4 grid grid-cols-2 gap-3 bg-white">
                  {/* Row: Location Name */}
                  {location.fileName && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <PictureOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Location Name</label>
                        <p className="text-sm">{location.fileName}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Scene Number */}
                  {location.sceneNumber && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <NumberOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Scene Number</label>
                        <p className="text-sm">{location.sceneNumber}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Episode */}
                  {location.episode && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <PlaySquareOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Episode</label>
                        <p className="text-sm">{location.episode}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: City */}
                  {location.city && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <EnvironmentOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">City</label>
                        <p className="text-sm">{location.city}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Address */}
                  {location.address && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                      <EnvironmentOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Address</label>
                        <p className="text-sm">{location.address}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: GPS */}
                  {(location.latitude != null && location.longitude != null) && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                      <EnvironmentOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">GPS Coordinates</label>
                        <p className="text-sm">{location.latitude}, {location.longitude}</p>
                        <a
                          href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          View on Google Maps
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Row: Sub-Location */}
                  {location.subLocation && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <EnvironmentOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Sub-Location</label>
                        <p className="text-sm">{location.subLocation}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Interior / Exterior */}
                  {location.interiorExterior && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <HomeOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Interior / Exterior</label>
                        <p className="text-sm capitalize">{location.interiorExterior}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Day / Night */}
                  {location.dayNight && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 mt-0.5">{location.dayNight === 'night' ? <FiMoon /> : <FiSun />}</span>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Day / Night</label>
                        <p className="text-sm capitalize">{location.dayNight}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Description */}
                  {location.description && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                      <FileTextOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Description</label>
                        <p className="text-sm">{location.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Parking */}
                  {location.parking && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 mt-0.5 font-bold text-xs">P</span>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Parking</label>
                        <p className="text-sm">{location.parking}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Permits */}
                  {location.permits && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 mt-0.5 font-bold text-xs">!</span>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Permits</label>
                        <p className="text-sm">{location.permits}</p>
                      </div>
                    </div>
                  )}

                  {/* Row: Notes */}
                  {location.notes && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                      <FileTextOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Notes</label>
                        <p className="text-sm">{location.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Contact Section */}
                  {(location.contactName || location.phone || location.email) && (
                    <div className="col-span-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-2">Contact Information</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {location.contactName && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <UserOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Contact Name</label>
                              <p className="text-sm">{location.contactName}</p>
                            </div>
                          </div>
                        )}
                        {location.phone && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <PhoneOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Phone</label>
                              <p className="text-sm">{location.countryCode} {location.phone}</p>
                            </div>
                          </div>
                        )}
                        {location.email && (
                          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <MailOutlined className="text-gray-400 mt-0.5" />
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Email</label>
                              <p className="text-sm"><a href={`mailto:${location.email}`} className="text-blue-500 hover:underline">{location.email}</a></p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Uploaded By */}
                  {location.createdBy?.name && (
                    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                      <UserOutlined className="text-gray-400 mt-0.5" />
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Uploaded By</label>
                        <p className="text-sm">{location.createdBy.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'discussion' && (
                <div className="flex flex-col h-full">
                  {/* Show which folder's discussion this is */}
                  {hasContext && (
                    <div className="px-4 py-2 bg-blue-50 text-xs text-blue-600 border-b border-blue-100">
                      {contextLabel}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {visibleComments.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-8">
                        {hasContext
                          ? `No discussion for ${contextLabel} yet.`
                          : 'No discussion yet.'
                        }
                        <br />Start the conversation.
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
                                <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
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
                  <form className="flex items-center gap-2 px-4 py-3 border-t border-gray-200" onSubmit={handleAddComment}>
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
                      placeholder={replyTo ? `Reply to ${replyTo.userName}...` : (hasContext ? `Comment on ${contextLabel}...` : 'Add a comment...')}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                    />
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
                // Filter out "commented" — discussions are separate from activity
                const filteredActivities = activities.filter(
                  (a) => a.action !== 'commented'
                );

                const actionLabels = {
                  created: 'Created location',
                  edited: 'Updated location',
                  moved: 'Moved location',
                  status_changed: 'Changed status',
                  deleted: 'Deleted location',
                  restored: 'Restored location',
                  attachment_added: 'Added attachments',
                  generated_pdf: 'Generated PDF',
                };

                return (
                  <div className="p-4">
                    {filteredActivities.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>}
                    <div className="space-y-3">
                      {filteredActivities.map((a) => (
                        <div key={a._id} className="flex gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.action === 'generated_pdf' ? 'bg-purple-400' : 'bg-blue-400'}`} />
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

export default LocationDetailPanel;
