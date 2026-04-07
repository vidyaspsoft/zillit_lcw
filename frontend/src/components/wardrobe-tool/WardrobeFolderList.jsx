import React from 'react';
import { Badge, Button, Card, Tag, Tooltip } from 'antd';
import { DeleteOutlined, ArrowRightOutlined, RightOutlined, FolderOutlined, PictureOutlined, UserOutlined, TeamOutlined, SendOutlined } from '@ant-design/icons';
import { WARDROBE_API_BASE_URL } from '../../config/constants';
import { getAttachmentUrl } from '../../utils/attachmentHelpers';

const FIELD_LABELS = {
  episode: 'Episode',
  characterName: 'Character',
  sceneNumber: 'Scene',
};

const FIELD_LABELS_PLURAL = {
  episode: 'Episodes',
  characterName: 'Characters',
  sceneNumber: 'Scenes',
};

const WardrobeFolderList = ({ folders, onFolderClick, onMoveFolder, onDeleteFolder, activeTab, depth = 0, groupByField = 'episode', units = [] }) => {
  const allFields = ['episode', 'characterName', 'sceneNumber'];
  const remaining = allFields.filter((f) => f !== groupByField);
  const levels = [groupByField, ...remaining];

  const currentFieldKey = levels[depth];
  const nextFieldKey = levels[depth + 1];
  const currentLabel = FIELD_LABELS[currentFieldKey] || 'Folder';
  const currentLabelPlural = FIELD_LABELS_PLURAL[currentFieldKey] || 'Folders';
  const nextLabelPlural = FIELD_LABELS_PLURAL[nextFieldKey] || '';

  if (!folders || folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <FolderOutlined style={{ fontSize: 48 }} />
        <p className="mt-3 text-base">No {currentLabelPlural.toLowerCase()} found</p>
        <p className="text-sm text-gray-400">Add costumes to see them grouped here</p>
      </div>
    );
  }

  const unitOrder = units.map((u) => u.key || u.identifier);
  const currentIdx = unitOrder.indexOf(activeTab);
  const isLastTab = currentIdx === unitOrder.length - 1;
  const nextTabLabel = !isLastTab && currentIdx >= 0 && units[currentIdx + 1]
    ? units[currentIdx + 1].label
    : null;

  const baseUrl = WARDROBE_API_BASE_URL.replace('/api/v2/wardrobe', '');

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {folders.map((folder, index) => (
        <Card
          key={index}
          hoverable
          className="folder-card cursor-pointer"
          onClick={() => onFolderClick(folder)}
          bodyStyle={{ padding: 0 }}
          cover={
            <div className="relative h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
              {folder.thumbnail?.media ? (
                <img
                  src={getAttachmentUrl(folder.thumbnail, baseUrl)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <PictureOutlined style={{ fontSize: 24, color: '#bbb' }} />
              )}
              {folder.badge > 0 && (
                <Badge
                  count={folder.badge}
                  className="absolute top-2 right-2"
                />
              )}
            </div>
          }
        >
          <div className="p-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              {currentLabel}
            </span>
            <h3 className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
              {folder.folderName || 'Ungrouped'}
            </h3>

            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{folder.count} costume{folder.count !== 1 ? 's' : ''}</span>
              {folder.subFolderCount > 0 && nextLabelPlural && (
                <span className="flex items-center gap-1">
                  <FolderOutlined style={{ fontSize: 11 }} />
                  {folder.subFolderCount} {nextLabelPlural.toLowerCase()}
                </span>
              )}
            </div>

            {/* Character & scene counts */}
            {(folder.characterCount > 0 || folder.sceneCount > 0) && (
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                {folder.characterCount > 0 && (
                  <span className="flex items-center gap-1">
                    <UserOutlined style={{ fontSize: 11 }} />
                    {folder.characterCount} character{folder.characterCount !== 1 ? 's' : ''}
                  </span>
                )}
                {folder.sceneCount > 0 && (
                  <span className="flex items-center gap-1">
                    <TeamOutlined style={{ fontSize: 11 }} />
                    {folder.sceneCount} scene{folder.sceneCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Last update */}
            {folder.lastUpdate && (
              <div className="text-[10px] text-gray-400 mt-1.5">
                Updated {formatDate(folder.lastUpdate)}
              </div>
            )}
          </div>

          {/* Actions + drill-down indicator */}
          <div className="flex items-center justify-between px-3 pb-2" onClick={(e) => e.stopPropagation()}>
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

export default WardrobeFolderList;
