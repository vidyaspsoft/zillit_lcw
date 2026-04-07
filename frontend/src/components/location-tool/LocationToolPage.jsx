import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Input, Badge, Spin, Space, Upload, Segmented, Breadcrumb, Dropdown } from 'antd';
import {
  PlusOutlined, SearchOutlined, DownloadOutlined, DeleteOutlined,
  ShareAltOutlined, MessageOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { FiChevronRight } from 'react-icons/fi';
import useLocationTool from '../../hooks/useLocationTool';
import locationToolService from '../../services/locationToolService';
import { LOCATION_API_BASE_URL } from '../../config/constants';
import LocationFolderList from './LocationFolderList';
import LocationItemList from './LocationItemList';
import LocationForm from './LocationForm';
import LocationDetailPanel from './LocationDetailPanel';
import MoveDialog from './MoveDialog';
import DeletedLocationsPanel from './DeletedLocationsPanel';
import ShareDialog from './ShareDialog';
import UnitChatPanel from './UnitChatPanel';
import ConfirmDialog from '../common/ConfirmDialog';

const GROUP_BY_OPTIONS = [
  { key: 'episodes', label: 'Episode' },
  { key: 'fileName', label: 'Location Name' },
  { key: 'sceneNumber', label: 'Scene Number' },
];

const FALLBACK_TABS = [
  { key: 'library', label: 'Library' },
  { key: 'select', label: 'Selects' },
  { key: 'shortlist', label: 'Shortlisted' },
  { key: 'final', label: 'Final' },
];

// ── Client-side grouping helpers ──

/** Map groupBy key to location field name */
const groupByToField = (groupBy) => {
  if (groupBy === 'episodes') return 'episode';
  return groupBy; // 'fileName' or 'sceneNumber'
};

/** Build folder key for badge matching (same logic as backend buildFolderKey) */
const buildFolderKey = (status, parts) => {
  if (!parts.length) return status;
  const sorted = [...parts].sort();
  return `${status}|${sorted.join('|')}`;
};

/** Group locations into folders by a field */
const groupLocationsIntoFolders = (locations, groupBy, nextGroupBy) => {
  const field = groupByToField(groupBy);
  const nextField = nextGroupBy ? groupByToField(nextGroupBy) : null;
  const groups = {};

  locations.forEach((loc) => {
    const val = loc[field] || '';
    if (!groups[val]) {
      groups[val] = {
        folderName: val || '',
        count: 0,
        lastUpdate: null,
        thumbnail: null,
        subFolderCount: 0,
        _items: [],
        _subValues: new Set(),
      };
    }
    const g = groups[val];
    g.count++;
    if (!g.lastUpdate || new Date(loc.updatedAt) > new Date(g.lastUpdate)) {
      g.lastUpdate = loc.updatedAt;
    }
    if (!g.thumbnail && loc.attachments && loc.attachments.length > 0) {
      g.thumbnail = loc.attachments[0];
    }
    g._items.push(loc);
    if (nextField && loc[nextField]) {
      g._subValues.add(loc[nextField]);
    }
  });

  return Object.values(groups).map((g) => ({
    folderName: g.folderName,
    count: g.count,
    lastUpdate: g.lastUpdate,
    thumbnail: g.thumbnail,
    subFolderCount: g._subValues.size,
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

/** Filter locations based on breadcrumb path */
const filterByBreadcrumbs = (locations, breadcrumbs) => {
  return locations.filter((loc) => {
    return breadcrumbs.every((bc) => {
      const field = groupByToField(bc.groupBy);
      return (loc[field] || '') === (bc.value || '');
    });
  });
};

const LocationToolPage = () => {
  const {
    units, allLocations, stats, badgeMap, deletedLocations, unitChats, loading,
    fetchUnits, fetchAllLocations, fetchBadges, markFolderViewed,
    fetchStats, fetchDeletedLocations,
    fetchUnitChats, sendUnitChat,
    createLocation, updateLocation, moveLocations, moveFolder,
    deleteLocation, restoreLocation, deleteFolder,
    generatePDF, shareLocations, setRefreshCallback,
  } = useLocationTool();

  // Build STATUS_TABS from dynamic units (fallback to hardcoded)
  const STATUS_TABS = units.length > 0
    ? units.map((u) => ({ key: u.identifier, label: u.label }))
    : FALLBACK_TABS;

  const [activeTab, setActiveTab] = useState('library');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeletedPanel, setShowDeletedPanel] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showUnitChat, setShowUnitChat] = useState(false);

  // Breadcrumb navigation for nested folders
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  // User-selected primary grouping field
  const [groupByField, setGroupByField] = useState('episodes');

  // Fetch units on mount
  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // ── Derived state ──
  const isAtFolderRoot = breadcrumbs.length === 0;

  // Determine current groupBy based on breadcrumb depth
  const getGroupByForDepth = useCallback((depth) => {
    const allFields = ['episodes', 'fileName', 'sceneNumber'];
    const remaining = allFields.filter((f) => f !== groupByField);
    const levels = [groupByField, ...remaining];
    return levels[depth] || null;
  }, [groupByField]);

  // ── Refresh: re-fetch all locations + badges + stats for current tab ──
  const refreshCurrentView = useCallback(() => {
    fetchAllLocations(activeTab);
    fetchBadges(activeTab);
    fetchStats();
  }, [activeTab, fetchAllLocations, fetchBadges, fetchStats]);

  useEffect(() => {
    setRefreshCallback(refreshCurrentView);
  }, [refreshCurrentView, setRefreshCallback]);

  // Fetch data when tab changes
  useEffect(() => {
    fetchAllLocations(activeTab);
    fetchBadges(activeTab);
    fetchStats();
  }, [activeTab, fetchAllLocations, fetchBadges, fetchStats]);

  // ── Client-side computed folders and filtered locations ──
  const filteredByBreadcrumbs = useMemo(() => {
    return filterByBreadcrumbs(allLocations, breadcrumbs);
  }, [allLocations, breadcrumbs]);

  const currentGroupBy = getGroupByForDepth(breadcrumbs.length);
  const nextGroupBy = getGroupByForDepth(breadcrumbs.length + 1);

  const folders = useMemo(() => {
    if (!currentGroupBy) return [];
    const grouped = groupLocationsIntoFolders(filteredByBreadcrumbs, currentGroupBy, nextGroupBy);

    // Attach badges from badgeMap
    const parentParts = [];
    breadcrumbs.forEach((bc) => {
      if (bc.groupBy === 'episodes') parentParts.push(`ep:${bc.value}`);
      else if (bc.groupBy === 'sceneNumber') parentParts.push(`sc:${bc.value}`);
      else if (bc.groupBy === 'fileName') parentParts.push(`fn:${bc.value}`);
    });

    grouped.forEach((f) => {
      const parts = [...parentParts];
      if (currentGroupBy === 'episodes') parts.push(`ep:${f.folderName}`);
      else if (currentGroupBy === 'sceneNumber') parts.push(`sc:${f.folderName}`);
      else if (currentGroupBy === 'fileName') parts.push(`fn:${f.folderName}`);
      const key = buildFolderKey(activeTab, parts);
      f.badge = badgeMap[key] || 0;
    });

    return grouped;
  }, [filteredByBreadcrumbs, currentGroupBy, nextGroupBy, breadcrumbs, activeTab, badgeMap]);

  // Locations for item view (search-filtered)
  const locations = useMemo(() => {
    if (!searchText) return filteredByBreadcrumbs;
    const s = searchText.toLowerCase();
    return filteredByBreadcrumbs.filter((loc) =>
      (loc.fileName || '').toLowerCase().includes(s) ||
      (loc.sceneNumber || '').toLowerCase().includes(s) ||
      (loc.city || '').toLowerCase().includes(s) ||
      (loc.description || '').toLowerCase().includes(s) ||
      (loc.address || '').toLowerCase().includes(s) ||
      (loc.episode || '').toLowerCase().includes(s)
    );
  }, [filteredByBreadcrumbs, searchText]);

  // ── Mark folder viewed when navigating into it ──
  const handleFolderClick = useCallback((folder) => {
    const depth = breadcrumbs.length;
    const groupBy = getGroupByForDepth(depth);
    const labels = { episodes: 'Episode', fileName: 'Location', sceneNumber: 'Scene' };
    const prefix = labels[groupBy] || '';
    const label = prefix ? `${prefix}: ${folder.folderName || 'Ungrouped'}` : (folder.folderName || 'Ungrouped');

    // Build folder key and mark as viewed
    const parentParts = [];
    breadcrumbs.forEach((bc) => {
      if (bc.groupBy === 'episodes') parentParts.push(`ep:${bc.value}`);
      else if (bc.groupBy === 'sceneNumber') parentParts.push(`sc:${bc.value}`);
      else if (bc.groupBy === 'fileName') parentParts.push(`fn:${bc.value}`);
    });
    if (groupBy === 'episodes') parentParts.push(`ep:${folder.folderName}`);
    else if (groupBy === 'sceneNumber') parentParts.push(`sc:${folder.folderName}`);
    else if (groupBy === 'fileName') parentParts.push(`fn:${folder.folderName}`);
    const folderKey = buildFolderKey(activeTab, parentParts);
    markFolderViewed(folderKey);

    setBreadcrumbs((prev) => [...prev, { groupBy, value: folder.folderName, label }]);
    setSelectedLocation(null);
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
    setSelectedLocation(null);
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
    setSelectedLocation(null);
    setSelectionMode(false);
    setSelectedItems([]);
  };

  // ── Location click ──
  const handleLocationClick = (location) => {
    if (selectionMode) {
      setSelectedItems((prev) =>
        prev.includes(location._id)
          ? prev.filter((id) => id !== location._id)
          : [...prev, location._id]
      );
    } else {
      setSelectedLocation(location);
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
    const result = await createLocation(formData);
    if (result) {
      setShowForm(false);
      refreshCurrentView();
    }
  };

  const handleUpdateSubmit = async (formData) => {
    if (!editingLocation) return;
    const result = await updateLocation(editingLocation._id, formData);
    if (result) {
      setEditingLocation(null);
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
    } else if (showDeleteConfirm.type === 'bulk') {
      // Single API call for bulk delete
      try {
        const res = await locationToolService.bulkDeleteLocations(showDeleteConfirm.ids);
        const count = res.data?.deletedCount || showDeleteConfirm.ids.length;
        const { toast } = await import('react-toastify');
        toast.success(`${count} item${count !== 1 ? 's' : ''} deleted`);
      } catch {}
      setShowDeleteConfirm(null);
      setSelectionMode(false);
      setSelectedItems([]);
      refreshCurrentView();
    } else {
      const success = await deleteLocation(showDeleteConfirm._id);
      if (success) {
        setShowDeleteConfirm(null);
        setSelectedLocation(null);
        refreshCurrentView();
      }
    }
  };

  const handleGeneratePDF = async () => {
    const ids = selectionMode && selectedItems.length > 0
      ? selectedItems
      : locations.map((l) => l._id);
    if (ids.length === 0) return;
    await generatePDF(ids, `${activeTab} - Location Report`);
  };

  const handleRestoreLocation = async (id) => {
    const success = await restoreLocation(id);
    if (success) {
      fetchDeletedLocations();
      refreshCurrentView();
    }
  };

  const handleShareLocations = async (userIds, message) => {
    const ids = selectionMode && selectedItems.length > 0
      ? selectedItems
      : locations.map((l) => l._id);
    if (ids.length === 0) return;
    const success = await shareLocations(ids, userIds, message);
    if (success) {
      setShowShareDialog(false);
      setSelectionMode(false);
      setSelectedItems([]);
    }
  };

  // ── Badge counts ──
  const getTabBadge = (tabKey) => {
    const count = (stats?.stats?.[tabKey] || 0);
    // Library tab: show item count only (no activity badges)
    if (tabKey === 'library') return count;
    const badge = (stats?.badges?.[tabKey] || 0);
    const chatBadge = (stats?.unitChats?.[tabKey] || 0);
    return badge + chatBadge || count || 0;
  };

  // ── Should show folder view or item view ──
  const showFolderView = folders.length > 0 && currentGroupBy !== null;
  const showItemView = breadcrumbs.length > 0 && (!showFolderView || folders.length === 0);

  // ── Inline full-page views for Create and Move ──
  if (showForm) {
    return (
      <div className="flex flex-col h-[calc(100vh-var(--navbar-height))] bg-gray-50">
        <LocationForm
          location={editingLocation}
          onSubmit={editingLocation ? handleUpdateSubmit : handleCreateSubmit}
          onClose={() => { setShowForm(false); setEditingLocation(null); }}
          activeTab={activeTab}
          inline={true}
        />
      </div>
    );
  }

  // MoveDialog renders as overlay modal (pick step) → then inline (form step)
  // Handled via showMoveDialog state below in the JSX

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

        {/* ── Group By Selector (at folder root, NOT on Library) ── */}
        {isAtFolderRoot && activeTab !== 'library' && (
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
          {/* Library: only Select + Upload */}
          {activeTab === 'library' && !selectionMode && (
            <Button
              size="small"
              onClick={() => setSelectionMode(true)}
            >
              Select
            </Button>
          )}

          {/* Non-Library tools */}
          {activeTab !== 'library' && (
            <>
              {/* Search */}
              {showItemView && (
                <form onSubmit={handleSearch}>
                  <Input
                    prefix={<SearchOutlined className="text-gray-400" />}
                    placeholder="Search..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    size="small"
                    className="w-48"
                    allowClear
                  />
                </form>
              )}

              {/* PDF Export */}
              {locations.length > 0 && (
                <Button size="small" icon={<DownloadOutlined />} onClick={handleGeneratePDF}>
                  PDF
                </Button>
              )}

              {/* Distribute */}
              {locations.length > 0 && (
                <Button size="small" icon={<ShareAltOutlined />} onClick={() => { /* Distribution will be integrated */ }}>
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
                onClick={() => { fetchDeletedLocations(); setShowDeletedPanel(true); }}
              />
            </>
          )}

          {/* Add Location / Upload — not on Final */}
          {activeTab !== 'final' && (
            activeTab === 'library' ? (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = 'image/*,video/*,.pdf';
                  input.onchange = async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    // Upload each file as a separate library entry — single loop, no extra toasts
                    let uploaded = 0;
                    for (const file of files) {
                      try {
                        const fd = new FormData();
                        fd.append('status', 'library');
                        fd.append('files', file);
                        // Don't set fileName for library — it's just an image, not a named location
                        fd.append('fileName', '');
                        await locationToolService.createLocation(fd);
                        uploaded++;
                      } catch {}
                    }
                    if (uploaded > 0) {
                      const { toast } = await import('react-toastify');
                      toast.success(`${uploaded} image${uploaded !== 1 ? 's' : ''} uploaded to Library`);
                    }
                    refreshCurrentView();
                  };
                  input.click();
                }}
              >
                Upload Images
              </Button>
            ) : (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => { setEditingLocation(null); setShowForm(true); }}
              >
                Add Location
              </Button>
            )
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
              setMoveTarget({ type: 'items', ids: selectedItems });
              setShowMoveDialog(true);
            }}
          >
            Move
          </Button>
          {activeTab === 'library' && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                setShowDeleteConfirm({
                  type: 'bulk',
                  ids: selectedItems,
                  message: `Delete ${selectedItems.length} item(s) from Library?`,
                });
              }}
            >
              Delete
            </Button>
          )}
          {activeTab !== 'library' && (
            <>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleGeneratePDF}>
                PDF
              </Button>
              <Button size="small" icon={<ShareAltOutlined />} onClick={() => { /* Distribution will be integrated */ }}>
                Distribute
              </Button>
            </>
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
          {/* ── Library: Flat image grid (no folders) ── */}
          {activeTab === 'library' && !loading && (
            <div>
              {allLocations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📷</div>
                  <h3>Library is empty</h3>
                  <p>Upload images to start building your location library</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">{allLocations.length} item{allLocations.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {allLocations.map((loc) => {
                      const att = loc.attachments?.[0];
                      const isSelected = selectedItems.includes(loc._id);
                      const baseUrl = LOCATION_API_BASE_URL.replace('/api/v2/location', '');
                      const imgUrl = att?.media
                        ? (att.bucket ? `https://${att.bucket}.s3.${att.region || 'ap-south-1'}.amazonaws.com/${att.media}` : `${baseUrl}/uploads/${att.media}`)
                        : null;

                      return (
                        <div
                          key={loc._id}
                          className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all group ${
                            isSelected ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-300'
                          }`}
                          onClick={() => {
                            if (selectionMode) {
                              setSelectedItems((prev) =>
                                prev.includes(loc._id) ? prev.filter((id) => id !== loc._id) : [...prev, loc._id]
                              );
                            } else {
                              setSelectedLocation(loc);
                            }
                          }}
                        >
                          <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                            {imgUrl ? (
                              <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-2xl text-gray-300">📷</span>
                            )}
                          </div>

                          {/* Selection checkbox */}
                          {selectionMode && (
                            <div className={`absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                              isSelected ? 'bg-blue-500 text-white' : 'bg-white/80 border border-gray-300 text-gray-400'
                            }`}>
                              {isSelected ? '✓' : ''}
                            </div>
                          )}

                          {/* File name */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                            <span className="text-[11px] text-white truncate block">
                              {loc.fileName || att?.name || 'Untitled'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Folder view (non-library) */}
          {activeTab !== 'library' && showFolderView && (
            <LocationFolderList
              folders={folders}
              onFolderClick={handleFolderClick}
              onMoveFolder={(folder) => {
                // Get locations for this folder from client-side data
                const folderField = getGroupByForDepth(breadcrumbs.length);
                const field = groupByToField(folderField);
                const folderLocs = filteredByBreadcrumbs.filter(
                  (loc) => (loc[field] || '') === (folder.folderName || '')
                );
                setMoveTarget({
                  type: 'folder',
                  folderField,
                  folderValue: folder.folderName,
                  folderLocations: folderLocs,
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

          {/* Item view - inside a folder (non-library) */}
          {activeTab !== 'library' && showItemView && (
            <LocationItemList
              locations={locations}
              onLocationClick={handleLocationClick}
              onEditLocation={(loc) => { setEditingLocation(loc); setShowForm(true); }}
              onDeleteLocation={(loc) => setShowDeleteConfirm(loc)}
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
      {selectedLocation && !selectionMode && (
        <LocationDetailPanel
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onEdit={(loc) => { setEditingLocation(loc); setShowForm(true); }}
          onDelete={(loc) => setShowDeleteConfirm(loc)}
          onMove={(loc) => {
            setSelectedItems([loc._id]);
            setMoveTarget({ type: 'items', ids: [loc._id] });
            setShowMoveDialog(true);
          }}
          activeTab={activeTab}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Confirmation"
          message={
            showDeleteConfirm.type === 'folder'
              ? `Delete folder "${showDeleteConfirm.folderName}" and all its locations?`
              : showDeleteConfirm.type === 'bulk'
              ? showDeleteConfirm.message || `Delete ${showDeleteConfirm.ids?.length || 0} item(s)?`
              : `Delete this location?`
          }
          onConfirm={handleDeleteItem}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {showDeletedPanel && (
        <DeletedLocationsPanel
          locations={deletedLocations}
          onRestore={handleRestoreLocation}
          onClose={() => setShowDeletedPanel(false)}
        />
      )}

      {showShareDialog && (
        <ShareDialog
          onShare={handleShareLocations}
          onClose={() => setShowShareDialog(false)}
          count={selectionMode && selectedItems.length > 0 ? selectedItems.length : locations.length}
        />
      )}

      {showMoveDialog && (
        <MoveDialog
          currentStatus={activeTab}
          moveTarget={moveTarget}
          onMoveLocations={moveLocations}
          onMoveFolder={moveFolder}
          onComplete={handleMoveComplete}
          onClose={() => { setShowMoveDialog(false); setMoveTarget(null); }}
          existingLocations={
            moveTarget?.type === 'items'
              ? allLocations.filter((l) => (moveTarget.ids || selectedItems).includes(l._id))
              : (moveTarget?.folderLocations || [])
          }
          units={STATUS_TABS}
        />
      )}
    </div>
  );
};

export default LocationToolPage;
