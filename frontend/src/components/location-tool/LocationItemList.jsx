import React from 'react';
import { Badge, Button, Card, Tag, Tooltip, Empty } from 'antd';
import {
  PictureOutlined, EditOutlined, DeleteOutlined, CheckSquareOutlined,
  BorderOutlined, MessageOutlined, VideoCameraOutlined, LinkOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import {
  FiImage, FiEdit2, FiTrash2, FiSquare, FiCheckSquare, FiMessageSquare,
  FiVideo, FiLink, FiMapPin,
} from 'react-icons/fi';
import { LOCATION_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl, isImage, isVideo } from '../../utils/attachmentHelpers';

const LocationItemList = ({
  locations,
  onLocationClick,
  onEditLocation,
  onDeleteLocation,
  selectionMode,
  selectedItems,
  onToggleSelection,
  activeTab,
}) => {
  if (!locations || locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <PictureOutlined style={{ fontSize: 48 }} />
        <p className="mt-3 text-base">No locations in this folder</p>
      </div>
    );
  }

  const baseUrl = LOCATION_API_BASE_URL.replace('/api/v2/location', '');

  const getFirstAttachment = (loc) => {
    if (loc.attachments && loc.attachments.length > 0) return loc.attachments[0];
    return null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{locations.length} item{locations.length !== 1 ? 's' : ''}</span>
        <Button
          size="small"
          icon={selectionMode ? <CheckSquareOutlined /> : <BorderOutlined />}
          onClick={onToggleSelection}
        >
          {selectionMode ? 'Cancel' : 'Select'}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {locations.map((loc) => {
          const firstAtt = getFirstAttachment(loc);
          const attachCount = loc.attachments?.length || 0;
          const isSelected = selectedItems.includes(loc._id);
          return (
            <Card
              key={loc._id}
              hoverable
              className={`bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer transition-all overflow-hidden ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => onLocationClick(loc)}
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
              {loc.badgeCount > 0 && (
                <Badge count={loc.badgeCount} className="absolute top-2 right-2 z-10" />
              )}

              {/* Thumbnail */}
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
                ) : loc.link ? (
                  <div className="relative flex items-center justify-center w-full h-full bg-gray-200">
                    <LinkOutlined style={{ fontSize: 24, color: '#999' }} />
                    {loc.linkPreview?.image && (
                      <img src={loc.linkPreview.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                  </div>
                ) : (
                  <PictureOutlined style={{ fontSize: 24, color: '#bbb' }} />
                )}
                {attachCount > 1 && (
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {attachCount}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-0.5">
                {loc.fileName && (
                  <div className="text-xs"><span className="font-semibold">Location:</span> {loc.fileName}</div>
                )}
                {loc.sceneNumber && (
                  <div className="text-xs"><span className="font-semibold">Scene:</span> {loc.sceneNumber}</div>
                )}
                {loc.episode && (
                  <div className="text-xs"><span className="font-semibold">Ep:</span> {loc.episode}</div>
                )}
                {loc.city && (
                  <div className="text-xs"><span className="font-semibold">City:</span> {loc.city}</div>
                )}
                {(loc.latitude != null && loc.longitude != null) && (
                  <div className="text-xs flex items-center gap-1 text-green-600">
                    <EnvironmentOutlined style={{ fontSize: 12 }} /> GPS
                  </div>
                )}
                {loc.link && !loc.fileName && (
                  <div className="text-xs flex items-center gap-1 truncate">
                    <LinkOutlined style={{ fontSize: 12 }} />
                    <a href={loc.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 truncate hover:underline" onClick={(e) => e.stopPropagation()}>
                      {loc.linkPreview?.title || loc.link}
                    </a>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  {loc.discussion && (
                    <Tooltip title="Has discussion">
                      <MessageOutlined className="text-blue-400 text-xs" />
                    </Tooltip>
                  )}
                </div>
                <div className="flex gap-1">
                  {activeTab !== 'final' && (
                    <Tooltip title="Edit">
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEditLocation(loc)} />
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteLocation(loc)} />
                  </Tooltip>
                </div>
              </div>

              {loc.edited && (
                <Tag color="orange" className="absolute bottom-2 left-2 text-[10px]">Edited</Tag>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default LocationItemList;
