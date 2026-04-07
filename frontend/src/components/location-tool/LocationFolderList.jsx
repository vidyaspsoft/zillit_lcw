import React from 'react';
import { Badge, Button, Card, Empty, Tooltip } from 'antd';
import { DeleteOutlined, ArrowRightOutlined, RightOutlined, FolderOutlined, PictureOutlined, SendOutlined } from '@ant-design/icons';
import { FiFolder, FiImage } from 'react-icons/fi';
import { LOCATION_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl } from '../../utils/attachmentHelpers';

const FIELD_LABELS = {
  episodes: 'Episode',
  fileName: 'Location Name',
  sceneNumber: 'Scene Number',
};

const FIELD_LABELS_PLURAL = {
  episodes: 'Episodes',
  fileName: 'Location Names',
  sceneNumber: 'Scene Numbers',
};

const LocationFolderList = ({ folders, onFolderClick, onMoveFolder, onDeleteFolder, activeTab, depth = 0, groupByField = 'episodes', units = [] }) => {
  // Build depth levels dynamically based on primary groupBy
  const allFields = ['episodes', 'fileName', 'sceneNumber'];
  const remaining = allFields.filter((f) => f !== groupByField);
  const levels = [groupByField, ...remaining]; // e.g. ['sceneNumber', 'episodes', 'fileName']

  const currentFieldKey = levels[depth]; // current grouping field
  const nextFieldKey = levels[depth + 1]; // next level field (for sub-folder label)
  const currentLabel = FIELD_LABELS[currentFieldKey] || 'Folder';
  const currentLabelPlural = FIELD_LABELS_PLURAL[currentFieldKey] || 'Folders';
  const nextLabelPlural = FIELD_LABELS_PLURAL[nextFieldKey] || '';

  if (!folders || folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <FolderOutlined style={{ fontSize: 48 }} />
        <p className="mt-3 text-base">No {currentLabelPlural.toLowerCase()} found</p>
        <p className="text-sm text-gray-400">Add locations to see them grouped here</p>
      </div>
    );
  }

  // Determine if current tab is not the last tab (can move forward)
  const unitOrder = units.map((u) => u.key || u.identifier);
  const currentIdx = unitOrder.indexOf(activeTab);
  const isLastTab = currentIdx === unitOrder.length - 1;
  const nextTabLabel = !isLastTab && currentIdx >= 0 && units[currentIdx + 1]
    ? units[currentIdx + 1].label
    : null;

  const baseUrl = LOCATION_API_BASE_URL.replace('/api/v2/location', '');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {folders.map((folder, index) => (
        <Card
          key={index}
          hoverable
          className="folder-card cursor-pointer"
          onClick={() => onFolderClick(folder)}
          bodyStyle={{ padding: 0 }}
          cover={
            <div className="card-thumbnail">
              {folder.thumbnail?.media ? (
                <img
                  src={getAttachmentUrl(folder.thumbnail, baseUrl)}
                  alt=""
                />
              ) : (
                <PictureOutlined className="placeholder-icon" />
              )}
              {folder.badge > 0 && (
                <div className="card-badge">
                  <Badge count={folder.badge} />
                </div>
              )}
            </div>
          }
        >
          <div className="card-body">
            <div className="card-label">{currentLabel}</div>
            <div className="card-title">{folder.folderName || 'Ungrouped'}</div>
            <div className="card-meta">
              <span>{folder.count} location{folder.count !== 1 ? 's' : ''}</span>
              {folder.subFolderCount > 0 && nextLabelPlural && (
                <span className="flex items-center gap-1">
                  <FolderOutlined style={{ fontSize: 11 }} />
                  {folder.subFolderCount} {nextLabelPlural.toLowerCase()}
                </span>
              )}
            </div>
          </div>

          <div className="card-actions" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1">
              {!isLastTab && (
                <Tooltip title={nextTabLabel ? `Move to ${nextTabLabel}` : 'Move'}>
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowRightOutlined />}
                    onClick={() => onMoveFolder(folder)}
                  />
                </Tooltip>
              )}
              <Tooltip title="Distribute">
                <Button
                  type="text"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={() => { /* Will be integrated with distribution system */ }}
                />
              </Tooltip>
              <Tooltip title="Delete folder">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDeleteFolder(folder)}
                />
              </Tooltip>
            </div>
            {folder.subFolderCount > 0 && (
              <RightOutlined className="text-gray-400 text-xs" />
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default LocationFolderList;
