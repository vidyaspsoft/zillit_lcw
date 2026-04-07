import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Input, Badge, Spin, Space, Select, Segmented, Breadcrumb, Dropdown } from 'antd';
import {
  PlusOutlined, SearchOutlined, DownloadOutlined, DeleteOutlined,
  ShareAltOutlined, MessageOutlined, AppstoreOutlined, SwapOutlined, UploadOutlined,
} from '@ant-design/icons';
import { FiChevronRight } from 'react-icons/fi';
import useCastingTool from '../../hooks/useCastingTool';
import CastingFolderList from './CastingFolderList';
import CastingItemList from './CastingItemList';
import CastingForm from './CastingFormV2';
import CastingDetailPanel from './CastingDetailPanel';
import CastingMoveDialog from './CastingMoveDialog';
import DeletedCastingsPanel from './DeletedCastingsPanel';
import CastingCompareView from './CastingCompareView';
import BulkImportModal from './BulkImportModal';
import ShareDialog from '../location-tool/ShareDialog';
import UnitChatPanel from '../location-tool/UnitChatPanel';
import ConfirmDialog from '../common/ConfirmDialog';
import { toast } from 'react-toastify';

const GROUP_BY_OPTIONS = [
  { key: 'episode', label: 'Episode' },
  { key: 'characterName', label: 'Character' },
  { key: 'talentName', label: 'Talent' },
];

const MAIN_CAST_TYPE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'lead', label: 'Lead' },
  { key: 'supporting', label: 'Supporting' },
  { key: 'guestStar', label: 'Guest Star' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'dayPlayer', label: 'Day Player' },
  { key: 'cameo', label: 'Cameo' },
  { key: 'voiceOver', label: 'Voice Over' },
  { key: 'stunt', label: 'Stunt' },
];

const BG_CAST_TYPE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'featuredExtra', label: 'Featured Extra' },
  { key: 'generalBackground', label: 'General Background' },
  { key: 'standIn', label: 'Stand-In' },
  { key: 'photoDouble', label: 'Photo Double' },
  { key: 'specialAbility', label: 'Special Ability' },
  { key: 'utilityStunts', label: 'Utility Stunts' },
  { key: 'silentBits', label: 'Silent Bits' },
];

const GENDER_FILTERS = [
  { key: '', label: 'All' },
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'nonBinary', label: 'Non-Binary' },
  { key: 'transgender', label: 'Transgender' },
  { key: 'other', label: 'Other' },
];

const FALLBACK_TABS = [
  { key: 'select', label: 'Selects' },
  { key: 'shortlist', label: 'Shortlisted' },
  { key: 'final', label: 'Final' },
];

// ── Client-side grouping helpers ──

/** Map groupBy key to casting field name */
const groupByToField = (groupBy) => {
  return groupBy; // 'episode', 'characterName', or 'talentName'
};

/** Build folder key for badge matching (same logic as backend buildFolderKey) */
const buildFolderKey = (status, parts) => {
  if (!parts.length) return status;
  const sorted = [...parts].sort();
  return `${status}|${sorted.join('|')}`;
};

/** Group castings into folders by a field */
const groupCastingsIntoFolders = (castings, groupBy, nextGroupBy) => {
  const field = groupByToField(groupBy);
  const nextField = nextGroupBy ? groupByToField(nextGroupBy) : null;
  const groups = {};

  castings.forEach((casting) => {
    const val = casting[field] || '';
    if (!groups[val]) {
      groups[val] = {
        folderName: val || '',
        count: 0,
        lastUpdate: null,
        thumbnail: null,
        subFolderCount: 0,
        characterCount: 0,
        talentCount: 0,
        _items: [],
        _subValues: new Set(),
        _characters: new Set(),
        _talents: new Set(),
      };
    }
    const g = groups[val];
    g.count++;
    if (!g.lastUpdate || new Date(casting.updatedAt) > new Date(g.lastUpdate)) {
      g.lastUpdate = casting.updatedAt;
    }
    if (!g.thumbnail && casting.attachments && casting.attachments.length > 0) {
      g.thumbnail = casting.attachments[0];
    }
    g._items.push(casting);
    if (nextField && casting[nextField]) {
      g._subValues.add(casting[nextField]);
    }
    if (casting.characterName) g._characters.add(casting.characterName);
    if (casting.talentName) g._talents.add(casting.talentName);
  });

  return Object.values(groups).map((g) => ({
    folderName: g.folderName,
    count: g.count,
    lastUpdate: g.lastUpdate,
    thumbnail: g.thumbnail,
    subFolderCount: g._subValues.size,
    characterCount: g._characters.size,
    talentCount: g._talents.size,
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

/** Filter castings based on breadcrumb path */
const filterByBreadcrumbs = (castings, breadcrumbs) => {
  return castings.filter((casting) => {
    return breadcrumbs.every((bc) => {
      const field = groupByToField(bc.groupBy);
      return (casting[field] || '') === (bc.value || '');
    });
  });
};

const STATUS_DESCRIPTIONS = {
  select: 'Initial talent pool collected by casting team',
  shortlist: 'Top picks after auditions, pending director review',
  final: 'Locked cast, deals confirmed, ready for production',
};

const EMPTY_STATES = {
  select: { title: 'Start Building Your Cast', subtitle: 'Add potential talents for each character' },
  shortlist: { title: 'No Shortlisted Talents Yet', subtitle: 'Move your top picks from Selects after auditions' },
  final: { title: 'No Finalized Cast Yet', subtitle: 'Move confirmed talents from Shortlisted once deals are closed' },
};

const CastingToolPage = ({ toolType = 'main' }) => {
  const {
    units, allCastings, stats, badgeMap, deletedCastings, unitChats, loading,
    fetchUnits, fetchAllCastings, fetchBadges, markFolderViewed,
    fetchStats, fetchDeletedCastings,
    fetchUnitChats, sendUnitChat,
    createCasting, updateCasting, moveCastings, moveFolder,
    deleteCasting, restoreCasting, deleteFolder,
    generatePDF, shareCastings, setRefreshCallback,
  } = useCastingTool(toolType);

  // Build STATUS_TABS from dynamic units (fallback to hardcoded)
  const STATUS_TABS = units.length > 0
    ? units.map((u) => ({ key: u.identifier, label: u.label }))
    : FALLBACK_TABS;

  const [activeTab, setActiveTab] = useState('select');
  const [selectedCasting, setSelectedCasting] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCasting, setEditingCasting] = useState(null);
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
  const [castTypeFilter, setCastTypeFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  // Breadcrumb navigation for nested folders
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  // User-selected primary grouping field
  const [groupByField, setGroupByField] = useState('episode');

  // Fetch units on mount
  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // ── Derived state ──
  const isAtFolderRoot = breadcrumbs.length === 0;

  // Determine current groupBy based on breadcrumb depth
  const getGroupByForDepth = useCallback((depth) => {
    const allFields = ['episode', 'characterName', 'talentName'];
    const remaining = allFields.filter((f) => f !== groupByField);
    const levels = [groupByField, ...remaining];
    return levels[depth] || null;
  }, [groupByField]);

  // ── Refresh: re-fetch all castings + badges + stats for current tab ──
  const refreshCurrentView = useCallback(() => {
    fetchAllCastings(activeTab);
    fetchBadges(activeTab);
    fetchStats();
  }, [activeTab, fetchAllCastings, fetchBadges, fetchStats]);

  useEffect(() => {
    setRefreshCallback(refreshCurrentView);
  }, [refreshCurrentView, setRefreshCallback]);

  // Fetch data when tab changes
  useEffect(() => {
    fetchAllCastings(activeTab);
    fetchBadges(activeTab);
    fetchStats();
  }, [activeTab, fetchAllCastings, fetchBadges, fetchStats]);

  // ── Client-side computed folders and filtered castings ──
  const filteredByCastType = useMemo(() => {
    let result = allCastings;
    if (castTypeFilter) result = result.filter((c) => c.castType === castTypeFilter);
    if (genderFilter) result = result.filter((c) => c.gender === genderFilter);
    return result;
  }, [allCastings, castTypeFilter, genderFilter]);

  const filteredByBreadcrumbs = useMemo(() => {
    return filterByBreadcrumbs(filteredByCastType, breadcrumbs);
  }, [filteredByCastType, breadcrumbs]);

  const currentGroupBy = getGroupByForDepth(breadcrumbs.length);
  const nextGroupBy = getGroupByForDepth(breadcrumbs.length + 1);

  const folders = useMemo(() => {
    if (!currentGroupBy) return [];
    const grouped = groupCastingsIntoFolders(filteredByBreadcrumbs, currentGroupBy, nextGroupBy);

    // Attach badges from badgeMap
    const parentParts = [];
    breadcrumbs.forEach((bc) => {
      if (bc.groupBy === 'episode') parentParts.push(`ep:${bc.value}`);
      else if (bc.groupBy === 'characterName') parentParts.push(`ch:${bc.value}`);
      else if (bc.groupBy === 'talentName') parentParts.push(`tl:${bc.value}`);
    });

    grouped.forEach((f) => {
      const parts = [...parentParts];
      if (currentGroupBy === 'episode') parts.push(`ep:${f.folderName}`);
      else if (currentGroupBy === 'characterName') parts.push(`ch:${f.folderName}`);
      else if (currentGroupBy === 'talentName') parts.push(`tl:${f.folderName}`);
      const key = buildFolderKey(activeTab, parts);
      f.badge = badgeMap[key] || 0;
    });

    return grouped;
  }, [filteredByBreadcrumbs, currentGroupBy, nextGroupBy, breadcrumbs, activeTab, badgeMap]);

  // Castings for item view (search-filtered)
  const castings = useMemo(() => {
    if (!searchText) return filteredByBreadcrumbs;
    const s = searchText.toLowerCase();
    return filteredByBreadcrumbs.filter((casting) =>
      (casting.characterName || '').toLowerCase().includes(s) ||
      (casting.talentName || '').toLowerCase().includes(s) ||
      (casting.episode || '').toLowerCase().includes(s) ||
      (casting.gender || '').toLowerCase().includes(s) ||
      (casting.description || '').toLowerCase().includes(s)
    );
  }, [filteredByBreadcrumbs, searchText]);

  // ── Mark folder viewed when navigating into it ──
  const handleFolderClick = useCallback((folder) => {
    const depth = breadcrumbs.length;
    const groupBy = getGroupByForDepth(depth);
    const labels = { episode: 'Episode', characterName: 'Character', talentName: 'Talent' };
    const prefix = labels[groupBy] || '';
    const label = prefix ? `${prefix}: ${folder.folderName || 'Ungrouped'}` : (folder.folderName || 'Ungrouped');

    // Build folder key and mark as viewed
    const parentParts = [];
    breadcrumbs.forEach((bc) => {
      if (bc.groupBy === 'episode') parentParts.push(`ep:${bc.value}`);
      else if (bc.groupBy === 'characterName') parentParts.push(`ch:${bc.value}`);
      else if (bc.groupBy === 'talentName') parentParts.push(`tl:${bc.value}`);
    });
    if (groupBy === 'episode') parentParts.push(`ep:${folder.folderName}`);
    else if (groupBy === 'characterName') parentParts.push(`ch:${folder.folderName}`);
    else if (groupBy === 'talentName') parentParts.push(`tl:${folder.folderName}`);
    const folderKey = buildFolderKey(activeTab, parentParts);
    markFolderViewed(folderKey);

    setBreadcrumbs((prev) => [...prev, { groupBy, value: folder.folderName, label }]);
    setSelectedCasting(null);
    setSelectionMode(false);
    setSelectedItems([]);
  }, [breadcrumbs, getGroupByForDepth, activeTab, markFolderViewed]);

  // Reset breadcrumbs when groupBy changes
  const handleGroupByChange = (field) => {
    setGroupByField(field);
    setBreadcrumbs([]);
  };

  // ── Tab change ──
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setBreadcrumbs([]);
    setSelectedCasting(null);
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
    setSelectedCasting(null);
    setSelectionMode(false);
    setSelectedItems([]);
  };

  // ── Casting click ──
  const handleCastingClick = (casting) => {
    if (selectionMode) {
      setSelectedItems((prev) =>
        prev.includes(casting._id)
          ? prev.filter((id) => id !== casting._id)
          : [...prev, casting._id]
      );
    } else {
      setSelectedCasting(casting);
    }
  };

  // ── Search ──
  const handleSearch = (e) => {
    e.preventDefault();
    // Search is handled client-side via useMemo — no API call needed
  };

  // ── Create / Edit ──
  const handleCreateSubmit = async (formData) => {
    formData.append('status', activeTab);
    const result = await createCasting(formData);
    if (result) {
      setShowForm(false);
      refreshCurrentView();
    }
  };

  const handleUpdateSubmit = async (formData) => {
    if (!editingCasting) return;
    const result = await updateCasting(editingCasting._id, formData);
    if (result) {
      setEditingCasting(null);
      setShowForm(false);
      refreshCurrentView();
    }
  };

  // ── Move ──
  const handleMoveComplete = () => {
    setShowMoveDialog(false);
    setMoveTarget(null);
    setSelectionMode(false);
    setSelectedItems([]);
    refreshCurrentView();
  };

  // ── Delete ──
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
      const success = await deleteCasting(showDeleteConfirm._id);
      if (success) {
        setShowDeleteConfirm(null);
        setSelectedCasting(null);
        refreshCurrentView();
      }
    }
  };

  const handleGeneratePDF = async () => {
    const ids = selectionMode && selectedItems.length > 0
      ? selectedItems
      : castings.map((c) => c._id);
    if (ids.length === 0) return;
    await generatePDF(ids, `${activeTab} - Casting Report`);
  };

  const handleRestoreCasting = async (id) => {
    const success = await restoreCasting(id);
    if (success) {
      fetchDeletedCastings();
      refreshCurrentView();
    }
  };

  const handleShareCastings = async (userIds, message) => {
    const ids = selectionMode && selectedItems.length > 0
      ? selectedItems
      : castings.map((c) => c._id);
    if (ids.length === 0) return;
    const success = await shareCastings(ids, userIds, message);
    if (success) {
      setShowShareDialog(false);
      setSelectionMode(false);
      setSelectedItems([]);
    }
  };

  // ── Badge counts ──
  const getTabBadge = (tabKey) => {
    const count = (stats?.stats?.[tabKey] || 0);
    const badge = (stats?.badges?.[tabKey] || 0);
    const chatBadge = (stats?.unitChats?.[tabKey] || 0);
    return badge + chatBadge || count || 0;
  };

  // ── Should show folder view or item view ──
  const showFolderView = folders.length > 0 && currentGroupBy !== null;
  const showItemView = breadcrumbs.length > 0 && (!showFolderView || folders.length === 0);

  return (
    <div className="flex flex-col h-[calc(100vh-var(--navbar-height))] bg-gray-50">
      {/* ── Status Tabs ── */}
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

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 px-5 py-2 bg-white border-b border-gray-100">
        <Select
          value={castTypeFilter || undefined}
          onChange={(val) => setCastTypeFilter(val || '')}
          placeholder="Cast Type"
          allowClear
          className="!w-44"
          size="small"
          options={(toolType === 'background' ? BG_CAST_TYPE_FILTERS : MAIN_CAST_TYPE_FILTERS).filter((f) => f.key).map((f) => ({ value: f.key, label: f.label }))}
        />
        <Select
          value={genderFilter || undefined}
          onChange={(val) => setGenderFilter(val || '')}
          placeholder="Gender"
          allowClear
          className="!w-36"
          size="small"
          options={GENDER_FILTERS.filter((f) => f.key).map((f) => ({ value: f.key, label: f.label }))}
        />
        {(castTypeFilter || genderFilter) && (
          <Button
            type="link"
            size="small"
            className="!text-xs !text-gray-400"
            onClick={() => { setCastTypeFilter(''); setGenderFilter(''); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* ── Toolbar ── */}
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

        {/* ── Group By Selector (at folder root) ── */}
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
                placeholder="Search castings..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                size="small"
                className="w-48"
                allowClear
              />
            </form>
          )}

          {/* PDF Export */}
          {castings.length > 0 && (
            <Button size="small" icon={<DownloadOutlined />} onClick={handleGeneratePDF}>
              PDF
            </Button>
          )}

          {/* Distribute */}
          {castings.length > 0 && (
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
            onClick={() => { fetchDeletedCastings(); setShowDeletedPanel(true); }}
          />

          {/* Import CSV */}
          <Button size="small" icon={<UploadOutlined />} onClick={() => setShowBulkImport(true)}>
            Import
          </Button>

          {/* Add Casting - not on Final */}
          {activeTab !== 'final' && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => { setEditingCasting(null); setShowForm(true); }}
            >
              Add Casting
            </Button>
          )}
        </div>
      </div>

      {/* ── Selection Actions Bar ── */}
      {selectionMode && selectedItems.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selectedItems.length} selected</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setMoveTarget({ type: 'items', castingIds: selectedItems });
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

      {/* ── Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center w-full py-12">
            <Spin size="large" tip="Loading..." />
          </div>
        )}

        <div className="tool-content">
          {/* Empty state */}
          {!loading && castings.length === 0 && folders.length === 0 && EMPTY_STATES[activeTab] && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">{EMPTY_STATES[activeTab].title}</h3>
              <p className="text-sm text-gray-400">{EMPTY_STATES[activeTab].subtitle}</p>
            </div>
          )}

          {/* Folder view */}
          {showFolderView && (
            <CastingFolderList
              folders={folders}
              onFolderClick={handleFolderClick}
              onMoveFolder={(folder) => {
                // Get castings for this folder from client-side data
                const folderField = getGroupByForDepth(breadcrumbs.length);
                const field = groupByToField(folderField);
                const folderCastings = filteredByBreadcrumbs.filter(
                  (casting) => (casting[field] || '') === (folder.folderName || '')
                );
                setMoveTarget({
                  type: 'folder',
                  folderField,
                  folderValue: folder.folderName,
                  folderCastings,
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
            <CastingItemList
              castings={castings}
              onCastingClick={handleCastingClick}
              onEditCasting={(casting) => { setEditingCasting(casting); setShowForm(true); }}
              onDeleteCasting={(casting) => setShowDeleteConfirm(casting)}
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

      {/* ── Detail Full View ── */}
      {selectedCasting && !selectionMode && (
        <CastingDetailPanel
          casting={selectedCasting}
          onClose={() => setSelectedCasting(null)}
          onEdit={(casting) => { setEditingCasting(casting); setShowForm(true); }}
          onDelete={(casting) => setShowDeleteConfirm(casting)}
          onMove={(casting) => {
            setSelectedItems([casting._id]);
            setMoveTarget({ type: 'items', castingIds: [casting._id] });
            setShowMoveDialog(true);
          }}
          activeTab={activeTab}
        />
      )}

      {/* ── Modals ── */}
      {showForm && (
        <CastingForm
          casting={editingCasting}
          onSubmit={editingCasting ? handleUpdateSubmit : handleCreateSubmit}
          onClose={() => { setShowForm(false); setEditingCasting(null); }}
          activeTab={activeTab}
          toolType={toolType}
        />
      )}

      {showMoveDialog && (
        <CastingMoveDialog
          currentStatus={activeTab}
          moveTarget={moveTarget}
          onMoveCastings={moveCastings}
          onMoveFolder={moveFolder}
          onComplete={handleMoveComplete}
          onClose={() => { setShowMoveDialog(false); setMoveTarget(null); }}
          existingCastings={
            moveTarget?.type === 'items'
              ? allCastings.filter((c) => (moveTarget.castingIds || selectedItems).includes(c._id))
              : (moveTarget?.folderCastings || [])
          }
          units={STATUS_TABS}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Confirmation"
          message={
            showDeleteConfirm.type === 'folder'
              ? `Delete folder "${showDeleteConfirm.folderName}" and all its castings?`
              : `Delete this casting?`
          }
          onConfirm={handleDeleteItem}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {showDeletedPanel && (
        <DeletedCastingsPanel
          castings={deletedCastings}
          onRestore={handleRestoreCasting}
          onClose={() => setShowDeletedPanel(false)}
        />
      )}

      {showCompare && selectedItems.length >= 2 && (
        <CastingCompareView
          castings={allCastings.filter((c) => selectedItems.includes(c._id))}
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

export default CastingToolPage;
