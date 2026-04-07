import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Input, Badge, Spin, Space, Select, Segmented, Breadcrumb, Dropdown } from 'antd';
import {
  PlusOutlined, SearchOutlined, DownloadOutlined, DeleteOutlined,
  ShareAltOutlined, MessageOutlined, AppstoreOutlined, SwapOutlined, UploadOutlined,
} from '@ant-design/icons';
import { FiChevronRight } from 'react-icons/fi';
import useWardrobeTool from '../../hooks/useWardrobeTool';
import WardrobeFolderList from './WardrobeFolderList';
import WardrobeItemList from './WardrobeItemList';
import WardrobeFormV2 from './WardrobeFormV2';
import WardrobeDetailPanel from './WardrobeDetailPanel';
import WardrobeMoveDialog from './WardrobeMoveDialog';
import DeletedWardrobePanel from './DeletedWardrobePanel';
import WardrobeCompareView from './WardrobeCompareView';
import BulkImportModal from './BulkImportModal';
// ShareDialog removed — using Distribute instead
import UnitChatPanel from '../location-tool/UnitChatPanel';
import ConfirmDialog from '../common/ConfirmDialog';
import { toast } from 'react-toastify';

const GROUP_BY_OPTIONS = [
  { key: 'episode', label: 'Episode' },
  { key: 'characterName', label: 'Character' },
  { key: 'sceneNumber', label: 'Scene Number' },
];

const FALLBACK_TABS = [
  { key: 'select', label: 'Selects' },
  { key: 'shortlist', label: 'Shortlisted' },
  { key: 'final', label: 'Final' },
];

// -- Client-side grouping helpers --

/** Map groupBy key to wardrobe field name */
const groupByToField = (groupBy) => {
  return groupBy; // 'episode', 'characterName', or 'sceneNumber'
};

/** Build folder key for badge matching (same logic as backend buildFolderKey) */
const buildFolderKey = (status, parts) => {
  if (!parts.length) return status;
  const sorted = [...parts].sort();
  return `${status}|${sorted.join('|')}`;
};

/** Group wardrobes into folders by a field */
const groupWardrobesIntoFolders = (wardrobes, groupBy, nextGroupBy) => {
  const field = groupByToField(groupBy);
  const nextField = nextGroupBy ? groupByToField(nextGroupBy) : null;
  const groups = {};

  wardrobes.forEach((wardrobe) => {
    const val = wardrobe[field] || '';
    if (!groups[val]) {
      groups[val] = {
        folderName: val || '',
        count: 0,
        lastUpdate: null,
        thumbnail: null,
        subFolderCount: 0,
        characterCount: 0,
        sceneCount: 0,
        _items: [],
        _subValues: new Set(),
        _characters: new Set(),
        _scenes: new Set(),
      };
    }
    const g = groups[val];
    g.count++;
    if (!g.lastUpdate || new Date(wardrobe.updatedAt) > new Date(g.lastUpdate)) {
      g.lastUpdate = wardrobe.updatedAt;
    }
    if (!g.thumbnail && wardrobe.attachments && wardrobe.attachments.length > 0) {
      g.thumbnail = wardrobe.attachments[0];
    }
    g._items.push(wardrobe);
    if (nextField && wardrobe[nextField]) {
      g._subValues.add(wardrobe[nextField]);
    }
    if (wardrobe.characterName) g._characters.add(wardrobe.characterName);
    if (wardrobe.sceneNumber) g._scenes.add(wardrobe.sceneNumber);
  });

  return Object.values(groups).map((g) => ({
    folderName: g.folderName,
    count: g.count,
    lastUpdate: g.lastUpdate,
    thumbnail: g.thumbnail,
    subFolderCount: g._subValues.size,
    characterCount: g._characters.size,
    sceneCount: g._scenes.size,
    badge: 0, // will be filled from badgeMap
  })).sort((a, b) => {
    const aName = a.folderName || '';
    const bName = b.folderName || '';
    // Numeric sort if both are numbers
    const aNum = Number(aName);
    const bNum = Number(bName);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return aName.localeCompare(bName);
  });
};

/** Filter wardrobes based on breadcrumb path */
const filterByBreadcrumbs = (wardrobes, breadcrumbs) => {
  return wardrobes.filter((wardrobe) => {
    return breadcrumbs.every((bc) => {
      const field = groupByToField(bc.groupBy);
      return (wardrobe[field] || '') === (bc.value || '');
    });
  });
};

const STATUS_DESCRIPTIONS = {
  select: 'Initial costume pool collected by wardrobe team',
  shortlist: 'Top picks after fittings, pending director review',
  final: 'Locked costumes, approved and ready for production',
};

const EMPTY_STATES = {
  select: { title: 'Start Building Your Wardrobe', subtitle: 'Add potential costumes for each character' },
  shortlist: { title: 'No Shortlisted Costumes Yet', subtitle: 'Move your top picks from Selects after fittings' },
  final: { title: 'No Finalized Costumes Yet', subtitle: 'Move approved costumes from Shortlisted once confirmed' },
};

const WardrobeToolPage = ({ toolType = 'main' }) => {
  const {
    units, allWardrobes, stats, badgeMap, deletedWardrobes, unitChats, loading,
    fetchUnits, fetchAllWardrobes, fetchBadges, markFolderViewed,
    fetchStats, fetchDeletedWardrobes,
    fetchUnitChats, sendUnitChat,
    createWardrobe, updateWardrobe, moveWardrobes, moveFolder,
    deleteWardrobe, restoreWardrobe, deleteFolder,
    generatePDF, shareWardrobes, setRefreshCallback,
  } = useWardrobeTool(toolType);

  // Build STATUS_TABS from dynamic units (fallback to hardcoded)
  const STATUS_TABS = units.length > 0
    ? units.map((u) => ({ key: u.identifier, label: u.label }))
    : FALLBACK_TABS;

  const [activeTab, setActiveTab] = useState('select');
  const [selectedWardrobe, setSelectedWardrobe] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingWardrobe, setEditingWardrobe] = useState(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeletedPanel, setShowDeletedPanel] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showUnitChat, setShowUnitChat] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Breadcrumb navigation for nested folders
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  // User-selected primary grouping field
  const [groupByField, setGroupByField] = useState('episode');

  // Fetch units on mount
  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // -- Derived state --
  const isAtFolderRoot = breadcrumbs.length === 0;

  // Determine current groupBy based on breadcrumb depth
  const getGroupByForDepth = useCallback((depth) => {
    const allFields = ['episode', 'characterName', 'sceneNumber'];
    const remaining = allFields.filter((f) => f !== groupByField);
    const levels = [groupByField, ...remaining];
    return levels[depth] || null;
  }, [groupByField]);

  // -- Refresh: re-fetch all wardrobes + badges + stats for current tab --
  const refreshCurrentView = useCallback(() => {
    fetchAllWardrobes(activeTab);
    fetchBadges(activeTab);
    fetchStats();
  }, [activeTab, fetchAllWardrobes, fetchBadges, fetchStats]);

  useEffect(() => {
    setRefreshCallback(refreshCurrentView);
  }, [refreshCurrentView, setRefreshCallback]);

  // Fetch data when tab changes
  useEffect(() => {
    fetchAllWardrobes(activeTab);
    fetchBadges(activeTab);
    fetchStats();
  }, [activeTab, fetchAllWardrobes, fetchBadges, fetchStats]);

  // -- Client-side computed folders and filtered wardrobes --
  const filteredByBreadcrumbs = useMemo(() => {
    return filterByBreadcrumbs(allWardrobes, breadcrumbs);
  }, [allWardrobes, breadcrumbs]);

  const currentGroupBy = getGroupByForDepth(breadcrumbs.length);
  const nextGroupBy = getGroupByForDepth(breadcrumbs.length + 1);

  const folders = useMemo(() => {
    if (!currentGroupBy) return [];
    const grouped = groupWardrobesIntoFolders(filteredByBreadcrumbs, currentGroupBy, nextGroupBy);

    // Attach badges from badgeMap
    const parentParts = [];
    breadcrumbs.forEach((bc) => {
      if (bc.groupBy === 'episode') parentParts.push(`ep:${bc.value}`);
      else if (bc.groupBy === 'characterName') parentParts.push(`ch:${bc.value}`);
      else if (bc.groupBy === 'sceneNumber') parentParts.push(`sc:${bc.value}`);
    });

    grouped.forEach((f) => {
      const parts = [...parentParts];
      if (currentGroupBy === 'episode') parts.push(`ep:${f.folderName}`);
      else if (currentGroupBy === 'characterName') parts.push(`ch:${f.folderName}`);
      else if (currentGroupBy === 'sceneNumber') parts.push(`sc:${f.folderName}`);
      const key = buildFolderKey(activeTab, parts);
      f.badge = badgeMap[key] || 0;
    });

    return grouped;
  }, [filteredByBreadcrumbs, currentGroupBy, nextGroupBy, breadcrumbs, activeTab, badgeMap]);

  // Wardrobes for item view (search-filtered)
  const wardrobes = useMemo(() => {
    if (!searchText) return filteredByBreadcrumbs;
    const s = searchText.toLowerCase();
    return filteredByBreadcrumbs.filter((wardrobe) =>
      (wardrobe.characterName || '').toLowerCase().includes(s) ||
      (wardrobe.talentName || '').toLowerCase().includes(s) ||
      (wardrobe.episode || '').toLowerCase().includes(s) ||
      (wardrobe.sceneNumber || '').toLowerCase().includes(s) ||
      (wardrobe.description || '').toLowerCase().includes(s)
    );
  }, [filteredByBreadcrumbs, searchText]);

  // -- Mark folder viewed when navigating into it --
  const handleFolderClick = useCallback((folder) => {
    const depth = breadcrumbs.length;
    const groupBy = getGroupByForDepth(depth);
    const labels = { episode: 'Episode', characterName: 'Character', sceneNumber: 'Scene Number' };
    const prefix = labels[groupBy] || '';
    const label = prefix ? `${prefix}: ${folder.folderName || 'Ungrouped'}` : (folder.folderName || 'Ungrouped');

    // Build folder key and mark as viewed
    const parentParts = [];
    breadcrumbs.forEach((bc) => {
      if (bc.groupBy === 'episode') parentParts.push(`ep:${bc.value}`);
      else if (bc.groupBy === 'characterName') parentParts.push(`ch:${bc.value}`);
      else if (bc.groupBy === 'sceneNumber') parentParts.push(`sc:${bc.value}`);
    });
    if (groupBy === 'episode') parentParts.push(`ep:${folder.folderName}`);
    else if (groupBy === 'characterName') parentParts.push(`ch:${folder.folderName}`);
    else if (groupBy === 'sceneNumber') parentParts.push(`sc:${folder.folderName}`);
    const folderKey = buildFolderKey(activeTab, parentParts);
    markFolderViewed(folderKey);

    setBreadcrumbs((prev) => [...prev, { groupBy, value: folder.folderName, label }]);
    setSelectedWardrobe(null);
    setSelectionMode(false);
    setSelectedItems([]);
  }, [breadcrumbs, getGroupByForDepth, activeTab, markFolderViewed]);

  // Reset breadcrumbs when groupBy changes
  const handleGroupByChange = (field) => {
    setGroupByField(field);
    setBreadcrumbs([]);
  };

  // -- Tab change --
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setBreadcrumbs([]);
    setSelectedWardrobe(null);
    setSelectionMode(false);
    setSelectedItems([]);
    setSearchText('');
    setShowUnitChat(false);
  };

  const handleBreadcrumbClick = (index) => {
    if (index < 0) {
      setBreadcrumbs([]);
    } else {
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
    }
    setSelectedWardrobe(null);
    setSelectionMode(false);
    setSelectedItems([]);
  };

  // -- Wardrobe click --
  const handleWardrobeClick = (wardrobe) => {
    if (selectionMode) {
      setSelectedItems((prev) =>
        prev.includes(wardrobe._id)
          ? prev.filter((id) => id !== wardrobe._id)
          : [...prev, wardrobe._id]
      );
    } else {
      setSelectedWardrobe(wardrobe);
    }
  };

  // -- Search --
  const handleSearch = (e) => {
    e.preventDefault();
    // Search is handled client-side via useMemo -- no API call needed
  };

  // -- Create / Edit --
  const handleCreateSubmit = async (formData) => {
    formData.append('status', activeTab);
    const result = await createWardrobe(formData);
    if (result) {
      setShowForm(false);
      refreshCurrentView();
    }
  };

  const handleUpdateSubmit = async (formData) => {
    if (!editingWardrobe) return;
    const result = await updateWardrobe(editingWardrobe._id, formData);
    if (result) {
      setEditingWardrobe(null);
      setShowForm(false);
      refreshCurrentView();
    }
  };

  // -- Move --
  const handleMoveComplete = () => {
    setShowMoveDialog(false);
    setMoveTarget(null);
    setSelectionMode(false);
    setSelectedItems([]);
    refreshCurrentView();
  };

  // -- Delete --
  const handleDeleteItem = async () => {
    if (!showDeleteConfirm) return;
    if (showDeleteConfirm.type === 'folder') {
      const success = await deleteFolder(
        showDeleteConfirm.folderField,
        showDeleteConfirm.folderValue,
        activeTab
      );
      if (success) {
        setShowDeleteConfirm(null);
        refreshCurrentView();
      }
    } else {
      const success = await deleteWardrobe(showDeleteConfirm._id);
      if (success) {
        setShowDeleteConfirm(null);
        setSelectedWardrobe(null);
        refreshCurrentView();
      }
    }
  };

  const handleGeneratePDF = async () => {
    const ids = selectionMode && selectedItems.length > 0
      ? selectedItems
      : wardrobes.map((c) => c._id);
    if (ids.length === 0) return;
    await generatePDF(ids, `${activeTab} - Wardrobe Report`);
  };

  const handleRestoreWardrobe = async (id) => {
    const success = await restoreWardrobe(id);
    if (success) {
      fetchDeletedWardrobes();
      refreshCurrentView();
    }
  };

  const handleShareWardrobes = async (userIds, message) => {
    const ids = selectionMode && selectedItems.length > 0
      ? selectedItems
      : wardrobes.map((c) => c._id);
    if (ids.length === 0) return;
    const success = await shareWardrobes(ids, userIds, message);
    if (success) {
      setShowShareDialog(false);
      setSelectionMode(false);
      setSelectedItems([]);
    }
  };

  // -- Badge counts --
  const getTabBadge = (tabKey) => {
    const count = (stats?.stats?.[tabKey] || 0);
    const badge = (stats?.badges?.[tabKey] || 0);
    const chatBadge = (stats?.unitChats?.[tabKey] || 0);
    return badge + chatBadge || count || 0;
  };

  // -- Should show folder view or item view --
  const showFolderView = folders.length > 0 && currentGroupBy !== null;
  const showItemView = breadcrumbs.length > 0 && (!showFolderView || folders.length === 0);

  return (
    <div className="flex flex-col h-[calc(100vh-var(--navbar-height))] bg-gray-50">
      {/* -- Status Tabs -- */}
      <div className="tool-header" style={{ gap: 10 }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`status-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
            {getTabBadge(tab.key) > 0 && (
              <Badge
                count={getTabBadge(tab.key)}
                size="small"
              />
            )}
          </button>
        ))}
        {STATUS_DESCRIPTIONS[activeTab] && (
          <span className="ml-3 text-xs text-gray-400 italic hidden md:inline">
            {STATUS_DESCRIPTIONS[activeTab]}
          </span>
        )}
      </div>

      {/* -- Toolbar -- */}
      <div className="tool-toolbar">
        <div className="flex items-center gap-1 min-w-0">
          <div className="flex items-center gap-1">
            <button
              className={`breadcrumb-btn ${isAtFolderRoot ? 'current' : ''}`}
              onClick={() => handleBreadcrumbClick(-1)}
            >
              {STATUS_TABS.find((t) => t.key === activeTab)?.label || activeTab}
            </button>
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={idx}>
                <FiChevronRight className="text-gray-300 flex-shrink-0" size={14} />
                <button
                  className={`breadcrumb-btn ${idx === breadcrumbs.length - 1 ? 'current' : ''}`}
                  onClick={() => handleBreadcrumbClick(idx)}
                >
                  {bc.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* -- Group By Selector (at folder root) -- */}
        {isAtFolderRoot && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <AppstoreOutlined />
            <span className="font-medium">Group by:</span>
            {GROUP_BY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`group-pill ${groupByField === opt.key ? 'active' : ''}`}
                onClick={() => handleGroupByChange(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search */}
          {showItemView && (
            <form onSubmit={handleSearch}>
              <Input
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder="Search costumes..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                size="small"
                className="w-48"
                allowClear
              />
            </form>
          )}

          {/* PDF Export */}
          {wardrobes.length > 0 && (
            <Button size="small" icon={<DownloadOutlined />} onClick={handleGeneratePDF}>
              PDF
            </Button>
          )}

          {/* Distribute */}
          {wardrobes.length > 0 && (
            <Button size="small" icon={<ShareAltOutlined />} onClick={() => toast.info('Distribution will be integrated soon')}>
              Distribute
            </Button>
          )}

          {/* Unit Chat */}
          <Button
            size="small"
            type={showUnitChat ? 'primary' : 'default'}
            icon={<MessageOutlined />}
            onClick={() => setShowUnitChat(!showUnitChat)}
          >
            Chat
          </Button>

          {/* Trash */}
          <Button
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => { fetchDeletedWardrobes(); setShowDeletedPanel(true); }}
          />

          {/* Import CSV */}
          <Button size="small" icon={<UploadOutlined />} onClick={() => setShowBulkImport(true)}>
            Import
          </Button>

          {/* Add Costume - not on Final */}
          {activeTab !== 'final' && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => { setEditingWardrobe(null); setShowForm(true); }}
            >
              + Add Costume
            </Button>
          )}
        </div>
      </div>

      {/* -- Selection Actions Bar -- */}
      {selectionMode && selectedItems.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selectedItems.length} selected</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setMoveTarget({ type: 'items', wardrobeIds: selectedItems });
              setShowMoveDialog(true);
            }}
          >
            Move
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleGeneratePDF}>
            PDF
          </Button>
          <Button size="small" icon={<ShareAltOutlined />} onClick={() => toast.info('Distribution will be integrated soon')}>
            Distribute
          </Button>
          {selectedItems.length >= 2 && selectedItems.length <= 3 && (
            <Button size="small" icon={<SwapOutlined />} onClick={() => setShowCompare(true)}>
              Compare
            </Button>
          )}
          <Button
            size="small"
            onClick={() => { setSelectionMode(false); setSelectedItems([]); }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* -- Content -- */}
      <div className="flex flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center w-full py-12">
            <Spin size="large" tip="Loading..." />
          </div>
        )}

        <div className="tool-content">
          {/* Empty state */}
          {!loading && wardrobes.length === 0 && folders.length === 0 && EMPTY_STATES[activeTab] && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">{EMPTY_STATES[activeTab].title}</h3>
              <p className="text-sm text-gray-400">{EMPTY_STATES[activeTab].subtitle}</p>
            </div>
          )}

          {/* Folder view */}
          {showFolderView && (
            <WardrobeFolderList
              folders={folders}
              onFolderClick={handleFolderClick}
              onMoveFolder={(folder) => {
                // Get wardrobes for this folder from client-side data
                const folderField = getGroupByForDepth(breadcrumbs.length);
                const field = groupByToField(folderField);
                const folderWardrobes = filteredByBreadcrumbs.filter(
                  (wardrobe) => (wardrobe[field] || '') === (folder.folderName || '')
                );
                setMoveTarget({
                  type: 'folder',
                  folderField,
                  folderValue: folder.folderName,
                  folderWardrobes,
                });
                setShowMoveDialog(true);
              }}
              onDeleteFolder={(folder) => {
                setShowDeleteConfirm({
                  type: 'folder',
                  folderField: getGroupByForDepth(breadcrumbs.length),
                  folderValue: folder.folderName,
                  folderName: folder.folderName,
                });
              }}
              activeTab={activeTab}
              depth={breadcrumbs.length}
              groupByField={groupByField}
              units={STATUS_TABS}
            />
          )}

          {/* Item view - inside a folder */}
          {showItemView && (
            <WardrobeItemList
              wardrobes={wardrobes}
              onWardrobeClick={handleWardrobeClick}
              onEditWardrobe={(wardrobe) => { setEditingWardrobe(wardrobe); setShowForm(true); }}
              onDeleteWardrobe={(wardrobe) => setShowDeleteConfirm(wardrobe)}
              selectionMode={selectionMode}
              selectedItems={selectedItems}
              onToggleSelection={() => setSelectionMode(!selectionMode)}
              activeTab={activeTab}
            />
          )}
        </div>

        {/* Unit Chat Panel */}
        {showUnitChat && (
          <UnitChatPanel
            unit={activeTab}
            chats={unitChats}
            onFetch={fetchUnitChats}
            onSend={sendUnitChat}
            onClose={() => setShowUnitChat(false)}
          />
        )}
      </div>

      {/* -- Detail Full View -- */}
      {selectedWardrobe && !selectionMode && (
        <WardrobeDetailPanel
          wardrobe={selectedWardrobe}
          onClose={() => setSelectedWardrobe(null)}
          onEdit={(wardrobe) => { setEditingWardrobe(wardrobe); setShowForm(true); }}
          onDelete={(wardrobe) => setShowDeleteConfirm(wardrobe)}
          onMove={(wardrobe) => {
            setSelectedItems([wardrobe._id]);
            setMoveTarget({ type: 'items', wardrobeIds: [wardrobe._id] });
            setShowMoveDialog(true);
          }}
          activeTab={activeTab}
        />
      )}

      {/* -- Modals -- */}
      {showForm && (
        <WardrobeFormV2
          wardrobe={editingWardrobe}
          onSubmit={editingWardrobe ? handleUpdateSubmit : handleCreateSubmit}
          onClose={() => { setShowForm(false); setEditingWardrobe(null); }}
          activeTab={activeTab}
          toolType={toolType}
        />
      )}

      {showMoveDialog && (
        <WardrobeMoveDialog
          currentStatus={activeTab}
          moveTarget={moveTarget}
          onMoveWardrobes={moveWardrobes}
          onMoveFolder={moveFolder}
          onComplete={handleMoveComplete}
          onClose={() => { setShowMoveDialog(false); setMoveTarget(null); }}
          existingWardrobes={
            moveTarget?.type === 'items'
              ? allWardrobes.filter((c) => (moveTarget.wardrobeIds || selectedItems).includes(c._id))
              : (moveTarget?.folderWardrobes || [])
          }
          units={STATUS_TABS}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Confirmation"
          message={
            showDeleteConfirm.type === 'folder'
              ? `Delete folder "${showDeleteConfirm.folderName}" and all its costumes?`
              : `Delete this costume?`
          }
          onConfirm={handleDeleteItem}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {showDeletedPanel && (
        <DeletedWardrobePanel
          wardrobes={deletedWardrobes}
          onRestore={handleRestoreWardrobe}
          onClose={() => setShowDeletedPanel(false)}
        />
      )}

      {showCompare && selectedItems.length >= 2 && (
        <WardrobeCompareView
          wardrobes={allWardrobes.filter((c) => selectedItems.includes(c._id))}
          onClose={() => setShowCompare(false)}
          onUpdate={() => { refreshCurrentView(); setShowCompare(false); }}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          activeTab={activeTab}
          toolType={toolType}
          onClose={() => setShowBulkImport(false)}
          onSuccess={refreshCurrentView}
        />
      )}
    </div>
  );
};

export default WardrobeToolPage;
