import React from 'react';
import { Badge, Button, Card, Tag, Tooltip } from 'antd';
import {
  PictureOutlined, EditOutlined, DeleteOutlined, CheckSquareOutlined,
  BorderOutlined, MessageOutlined, VideoCameraOutlined, UserOutlined,
} from '@ant-design/icons';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';
import { WARDROBE_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage, isVideo } from '../../utils/attachmentHelpers';

const WardrobeItemList = ({
  wardrobes,
  onWardrobeClick,
  onEditWardrobe,
  onDeleteWardrobe,
  selectionMode,
  selectedItems,
  onToggleSelection,
  activeTab,
}) => {
  if (!wardrobes || wardrobes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <UserOutlined style={{ fontSize: 48 }} />
        <p className="mt-3 text-base">No costumes in this folder</p>
      </div>
    );
  }

  const baseUrl = WARDROBE_API_BASE_URL.replace('/api/v2/wardrobe', '');

  const getFirstImageAttachment = (item) => {
    if (item.attachments && item.attachments.length > 0) {
      const image = item.attachments.find((a) => isImage(a));
      return image || item.attachments[0];
    }
    return null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{wardrobes.length} item{wardrobes.length !== 1 ? 's' : ''}</span>
        <Button
          size="small"
          icon={selectionMode ? <CheckSquareOutlined /> : <BorderOutlined />}
          onClick={onToggleSelection}
        >
          {selectionMode ? 'Cancel' : 'Select'}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {wardrobes.map((item) => {
          const firstAtt = getFirstImageAttachment(item);
          const attachCount = item.attachments?.length || 0;
          const commentCount = item.commentCount || item.comments?.length || 0;
          const isSelected = selectedItems.includes(item._id);

          return (
            <Card
              key={item._id}
              hoverable
              className={`item-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onWardrobeClick(item)}
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

              {/* Costume Photo / Thumbnail */}
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
                {/* Character name - prominent */}
                {item.characterName && (
                  <h3 className="text-sm font-semibold text-gray-800 truncate">
                    {item.characterName}
                  </h3>
                )}

                {/* Talent name */}
                {item.talentName && (
                  <div className="text-xs text-gray-600 truncate">
                    {item.talentName}
                  </div>
                )}

                {/* Episode | Scene */}
                {(item.episode || item.sceneNumber) && (
                  <div className="text-xs text-gray-500">
                    {[
                      item.episode ? `EP ${item.episode}` : null,
                      item.sceneNumber ? `Scene ${item.sceneNumber}` : null,
                    ].filter(Boolean).join(' | ')}
                  </div>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {/* Costume state tag */}
                  {item.costumeState && (
                    <Tag className="text-[10px] m-0" color="blue">{item.costumeState}</Tag>
                  )}

                  {/* Temporary tag */}
                  {item.isTemporary && (
                    <Tag className="text-[10px] m-0" color="gold">Temporary</Tag>
                  )}

                  {/* Quick Change tag */}
                  {item.quickChange && (
                    <Tag className="text-[10px] m-0" color="orange">Quick Change</Tag>
                  )}
                </div>

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
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEditWardrobe(item)} />
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteWardrobe(item)} />
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

export default WardrobeItemList;
