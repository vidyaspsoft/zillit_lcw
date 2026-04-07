import React from 'react';
import { Button, Rate, Tag } from 'antd';
import { CloseOutlined, StarFilled, StarOutlined, UserOutlined } from '@ant-design/icons';
import { CASTING_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage } from '../../utils/attachmentHelpers';
import castingToolService from '../../services/castingToolService';

const CAST_TYPE_LABELS = {
  lead: 'Lead', supporting: 'Supporting', guestStar: 'Guest Star',
  recurring: 'Recurring', dayPlayer: 'Day Player', extra: 'Extra / Background',
  cameo: 'Cameo', voiceOver: 'Voice Over', stunt: 'Stunt', main: 'Main Cast',
};

const CastingCompareView = ({ castings, onClose, onUpdate }) => {
  const baseUrl = CASTING_API_BASE_URL.replace('/api/v2/casting', '');

  const getHeadshot = (casting) => {
    const img = casting.attachments?.find((a) => isImage(a));
    return img ? getAttachmentUrl(img, baseUrl) : null;
  };

  const handleTogglePick = async (casting) => {
    const formData = new FormData();
    formData.append('directorPick', !casting.directorPick);
    try {
      await castingToolService.updateCasting(casting._id, formData);
      if (onUpdate) onUpdate();
    } catch {}
  };

  const formatDate = (epoch) => {
    if (!epoch) return '';
    return new Date(epoch).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // The component renders as a full-screen overlay modal
  // with cards side by side (2 or 3 columns)
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold">Compare Talents ({castings.length})</h3>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>

        {/* Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`grid gap-5 ${castings.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {castings.map((c) => {
              const headshot = getHeadshot(c);
              return (
                <div key={c._id} className={`rounded-xl border-2 overflow-hidden transition-all ${c.directorPick ? 'border-amber-400 shadow-lg shadow-amber-100' : 'border-gray-200'}`}>
                  {/* Photo */}
                  <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                    {headshot ? (
                      <img src={headshot} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserOutlined style={{ fontSize: 48, color: '#CBD5E1' }} />
                    )}
                    {c.directorPick && (
                      <div className="absolute top-2 right-2 bg-amber-400 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <StarFilled style={{ fontSize: 10 }} /> Director's Pick
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h4 className="text-base font-bold text-gray-800">{c.talentName || 'Unknown'}</h4>
                      <p className="text-xs text-gray-500">{c.characterName || ''}</p>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {c.gender && <div><span className="text-gray-400 block">Gender</span><span className="font-medium capitalize">{c.gender}</span></div>}
                      {c.age && <div><span className="text-gray-400 block">Age</span><span className="font-medium">{c.age}</span></div>}
                      {c.ethnicity && <div><span className="text-gray-400 block">Ethnicity</span><span className="font-medium">{c.ethnicity}</span></div>}
                      {c.height && <div><span className="text-gray-400 block">Height</span><span className="font-medium">{c.height}</span></div>}
                      {c.build && <div><span className="text-gray-400 block">Build</span><span className="font-medium capitalize">{c.build}</span></div>}
                      {c.unionStatus && <div><span className="text-gray-400 block">Union</span><span className="font-medium">{c.unionStatus}</span></div>}
                    </div>

                    {/* Cast Type + Job Freq */}
                    <div className="flex flex-wrap gap-1">
                      {c.castType && <Tag color="blue">{CAST_TYPE_LABELS[c.castType] || c.castType}</Tag>}
                      {c.jobFrequency && <Tag color="geekblue">{c.jobFrequency}</Tag>}
                    </div>

                    {/* Audition Rating */}
                    {c.auditionRating > 0 && (
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase block">Audition Rating</span>
                        <Rate disabled value={c.auditionRating} style={{ fontSize: 14 }} />
                        {c.callbackRound > 0 && <Tag color="orange" className="ml-2">Callback {c.callbackRound}</Tag>}
                      </div>
                    )}

                    {/* Availability */}
                    {c.availabilityDates?.length > 0 && (
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase block">Availability</span>
                        <span className="text-xs">{c.availabilityDates.length} date(s)</span>
                      </div>
                    )}

                    {/* Special Skills */}
                    {c.specialSkills && (
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase block">Skills</span>
                        <p className="text-xs text-gray-600">{c.specialSkills}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {c.description && (
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase block">Notes</span>
                        <p className="text-xs text-gray-600 line-clamp-3">{c.description}</p>
                      </div>
                    )}

                    {/* Director Pick Toggle */}
                    <Button
                      block
                      type={c.directorPick ? 'primary' : 'default'}
                      icon={c.directorPick ? <StarFilled /> : <StarOutlined />}
                      className={c.directorPick ? '!bg-amber-500 !border-amber-500 !text-white' : ''}
                      onClick={() => handleTogglePick(c)}
                    >
                      {c.directorPick ? "Director's Pick" : 'Mark as Pick'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CastingCompareView;
