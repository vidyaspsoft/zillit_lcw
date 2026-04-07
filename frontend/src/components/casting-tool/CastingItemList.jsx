import React from 'react';
import { Badge, Button, Card, Rate, Tag, Tooltip } from 'antd';
import {
  PictureOutlined, EditOutlined, DeleteOutlined, CheckSquareOutlined,
  BorderOutlined, MessageOutlined, VideoCameraOutlined, UserOutlined,
  CalendarOutlined, StarFilled,
} from '@ant-design/icons';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';
import { CASTING_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage, isVideo } from '../../utils/attachmentHelpers';

const JOB_FREQUENCY_LABELS = {
  dayPlayer: 'Day Player',
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

const CastingItemList = ({
  castings,
  onCastingClick,
  onEditCasting,
  onDeleteCasting,
  selectionMode,
  selectedItems,
  onToggleSelection,
  activeTab,
}) => {
  if (!castings || castings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <UserOutlined style={{ fontSize: 48 }} />
        <p className="mt-3 text-base">No castings in this folder</p>
      </div>
    );
  }

  const baseUrl = CASTING_API_BASE_URL.replace('/api/v2/casting', '');

  const getFirstImageAttachment = (item) => {
    if (item.attachments && item.attachments.length > 0) {
      const image = item.attachments.find((a) => isImage(a));
      return image || item.attachments[0];
    }
    return null;
  };

  const formatAvailability = (dates) => {
    if (!dates || dates.length === 0) return null;
    const fmt = (epoch) => new Date(epoch).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (dates.length === 1) return fmt(dates[0]);
    const sorted = [...dates].sort();
    return `${fmt(sorted[0])} - ${fmt(sorted[sorted.length - 1])} (${dates.length})`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{castings.length} item{castings.length !== 1 ? 's' : ''}</span>
        <Button
          size="small"
          icon={selectionMode ? <CheckSquareOutlined /> : <BorderOutlined />}
          onClick={onToggleSelection}
        >
          {selectionMode ? 'Cancel' : 'Select'}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {castings.map((item) => {
          const firstAtt = getFirstImageAttachment(item);
          const attachCount = item.attachments?.length || 0;
          const commentCount = item.commentCount || item.comments?.length || 0;
          const isSelected = selectedItems.includes(item._id);
          const availability = formatAvailability(item.availabilityDates);

          return (
            <Card
              key={item._id}
              hoverable
              className={`item-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onCastingClick(item)}
              bodyStyle={{ padding: 0 }}
            >
              {/* Selection checkbox */}
              {selectionMode && (
                <div className="absolute top-2 left-2 z-10">
                  {isSelected ? (
                    <FiCheckSquare className="text-blue-500" size={18} />
                  ) : (
                    <FiSquare className="text-gray-400" size={18} />
                  )}
                </div>
              )}

              {/* Badge */}
              {item.badgeCount > 0 && (
                <Badge count={item.badgeCount} className="absolute top-2 right-2 z-10" />
              )}

              {/* Headshot / Thumbnail */}
              <div className="relative h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                {firstAtt?.media ? (
                  isVideo(firstAtt) ? (
                    <div className="flex items-center justify-center w-full h-full bg-gray-200">
                      <VideoCameraOutlined style={{ fontSize: 24, color: '#999' }} />
                    </div>
                  ) : (
                    <img
                      src={getAttachmentUrl(firstAtt, baseUrl)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <UserOutlined style={{ fontSize: 32, color: '#bbb' }} />
                )}
                {attachCount > 1 && (
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {attachCount}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-0.5">
                {/* Talent name - prominent */}
                {item.talentName && (
                  <h3 className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1">
                    {item.talentName}
                    {item.directorPick && <StarFilled style={{ color: '#F59E0B', fontSize: 12 }} />}
                  </h3>
                )}

                {/* Character name */}
                {item.characterName && (
                  <div className="text-xs text-gray-600 truncate">
                    <span className="font-semibold">Character:</span> {item.characterName}
                  </div>
                )}

                {/* Gender | Cast Type */}
                {(item.gender || item.castType) && (
                  <div className="text-xs text-gray-500">
                    {[item.gender, CAST_TYPE_LABELS[item.castType] || item.castType].filter(Boolean).join(' | ')}
                  </div>
                )}

                {/* Audition Rating */}
                {item.auditionRating > 0 && (
                  <Rate disabled value={item.auditionRating} style={{ fontSize: 10 }} />
                )}

                {/* Job frequency */}
                {item.jobFrequency && (
                  <Tag className="text-[10px] mt-1 m-0" color="geekblue">
                    {JOB_FREQUENCY_LABELS[item.jobFrequency] || item.jobFrequency}
                  </Tag>
                )}

                {/* Episode */}
                {item.episode && (
                  <div className="text-xs mt-0.5"><span className="font-semibold">Ep:</span> {item.episode}</div>
                )}

                {/* Availability */}
                {availability && (
                  <div className="text-xs flex items-center gap-1 text-gray-500 mt-0.5">
                    <CalendarOutlined style={{ fontSize: 11 }} />
                    {availability}
                  </div>
                )}

                {/* Ethnicity | Union Status */}
                {(item.ethnicity || item.unionStatus) && (
                  <div className="text-[11px] text-gray-400 truncate">
                    {[item.ethnicity, item.unionStatus].filter(Boolean).join(' | ')}
                  </div>
                )}

                {/* Attachment + comment counts */}
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                  {attachCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <PictureOutlined style={{ fontSize: 11 }} /> {attachCount}
                    </span>
                  )}
                  {commentCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <MessageOutlined style={{ fontSize: 11 }} /> {commentCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  {item.discussion && (
                    <Tooltip title="Has discussion">
                      <MessageOutlined className="text-blue-400 text-xs" />
                    </Tooltip>
                  )}
                </div>
                <div className="flex gap-1">
                  {activeTab !== 'final' && (
                    <Tooltip title="Edit">
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEditCasting(item)} />
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteCasting(item)} />
                  </Tooltip>
                </div>
              </div>

              {item.edited && (
                <Tag color="orange" className="absolute bottom-2 left-2 text-[10px]">Edited</Tag>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CastingItemList;
