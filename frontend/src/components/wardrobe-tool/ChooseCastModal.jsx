import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Tag, Tabs, Spin, Select, Empty } from 'antd';
import { CloseOutlined, SearchOutlined, UserOutlined, WarningOutlined, CheckCircleFilled } from '@ant-design/icons';
import wardrobeToolService from '../../services/wardrobeToolService';
import castingApi from '../../api/castingAxiosConfig';

/**
 * ChooseCastModal — Select from finalized castings or create temporary cast.
 *
 * Finalized tab: loads ALL finalized castings from casting-backend, with search filter.
 * Temporary tab: shows existing temp characters + create new form.
 */
const ChooseCastModal = ({ onSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState('finalized');

  // ── Finalized Cast ──
  const [finalizedList, setFinalizedList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Temporary Cast (from DB) ──
  const [tempCasts, setTempCasts] = useState([]);
  const [tempLoading, setTempLoading] = useState(true);
  const [tempCharacter, setTempCharacter] = useState('');
  const [tempTalent, setTempTalent] = useState('');
  const [tempGender, setTempGender] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch finalized castings on mount
  useEffect(() => {
    const fetchFinalized = async () => {
      setLoading(true);
      try {
        const response = await castingApi.get('/', {
          params: { status: 'final', toolType: 'main', limit: 0 },
        });
        const data = response.data?.data?.castings || response.data?.data || [];
        const bgResponse = await castingApi.get('/', {
          params: { status: 'final', toolType: 'background', limit: 0 },
        });
        const bgData = bgResponse.data?.data?.castings || bgResponse.data?.data || [];

        const allFinalized = [...data, ...bgData];
        const seen = new Set();
        const unique = allFinalized.filter((c) => {
          const key = `${c.characterName}|${c.talentName}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setFinalizedList(unique);
        setFilteredList(unique);
      } catch (err) {
        console.error('Failed to fetch finalized castings:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFinalized();
  }, []);

  // Fetch temporary casts from DB
  const fetchTempCasts = async () => {
    setTempLoading(true);
    try {
      const res = await wardrobeToolService.getTempCasts();
      setTempCasts(res.data || []);
    } catch {
      setTempCasts([]);
    } finally {
      setTempLoading(false);
    }
  };

  useEffect(() => {
    fetchTempCasts();
  }, []);

  // Search filter
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredList(finalizedList);
      return;
    }
    const s = searchText.toLowerCase();
    setFilteredList(
      finalizedList.filter(
        (c) =>
          (c.characterName || '').toLowerCase().includes(s) ||
          (c.talentName || '').toLowerCase().includes(s) ||
          (c.episode || '').toLowerCase().includes(s)
      )
    );
  }, [searchText, finalizedList]);

  const handleSelectFinalized = (cast) => {
    onSelect({
      castId: cast._id || '',
      characterName: cast.characterName || '',
      talentName: cast.talentName || '',
      gender: cast.gender || '',
      contactInfo: cast.contactInfo || [],
      isTemporary: false,
    });
  };

  const handleSelectExistingTemp = (temp) => {
    onSelect({
      castId: '',
      characterName: temp.characterName || '',
      talentName: temp.talentName || '',
      gender: temp.gender || '',
      contactInfo: [],
      isTemporary: true,
    });
  };

  const handleCreateTemporary = async () => {
    if (!tempCharacter.trim()) return;
    setCreating(true);
    try {
      // Save to DB
      await wardrobeToolService.createTempCast({
        characterName: tempCharacter.trim(),
        talentName: tempTalent.trim(),
        gender: tempGender,
      });
      // Select it
      onSelect({
        castId: '',
        characterName: tempCharacter.trim(),
        talentName: tempTalent.trim(),
        gender: tempGender,
        contactInfo: [],
        isTemporary: true,
      });
    } catch {
      // Still select even if DB save fails
      onSelect({
        castId: '',
        characterName: tempCharacter.trim(),
        talentName: tempTalent.trim(),
        gender: tempGender,
        contactInfo: [],
        isTemporary: true,
      });
    } finally {
      setCreating(false);
    }
  };

  const uniqueTempCasts = tempCasts;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold">Choose Cast</h3>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'finalized',
                label: (
                  <span className="flex items-center gap-1">
                    <CheckCircleFilled className="text-green-500" /> Finalized Cast
                    {finalizedList.length > 0 && (
                      <Tag className="!text-[10px] !m-0 !ml-1">{finalizedList.length}</Tag>
                    )}
                  </span>
                ),
                children: (
                  <div className="space-y-3">
                    {/* Search */}
                    <Input
                      prefix={<SearchOutlined className="text-gray-400" />}
                      placeholder="Search by character or talent name..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      allowClear
                    />

                    {loading && (
                      <div className="text-center py-8"><Spin tip="Loading finalized cast..." /></div>
                    )}

                    {!loading && filteredList.length === 0 && (
                      <Empty
                        description={
                          searchText
                            ? `No results for "${searchText}"`
                            : "No finalized cast found. Finalize castings in the Casting tool first."
                        }
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}

                    {/* Cast list */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {filteredList.map((cast, idx) => (
                        <div
                          key={cast._id || idx}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all"
                          onClick={() => handleSelectFinalized(cast)}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <UserOutlined className="text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">
                              {cast.characterName || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              Talent: {cast.talentName || '—'}
                            </div>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {cast.gender && <Tag className="!text-[10px] !m-0">{cast.gender}</Tag>}
                              {cast.castType && <Tag color="blue" className="!text-[10px] !m-0">{cast.castType}</Tag>}
                              {cast.episode && <Tag color="default" className="!text-[10px] !m-0">EP {cast.episode}</Tag>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                key: 'temporary',
                label: (
                  <span className="flex items-center gap-1">
                    <WarningOutlined className="text-amber-500" /> Temporary
                    {uniqueTempCasts.length > 0 && (
                      <Tag color="gold" className="!text-[10px] !m-0 !ml-1">{uniqueTempCasts.length}</Tag>
                    )}
                  </span>
                ),
                children: (
                  <div className="space-y-4">
                    {/* Loading */}
                    {tempLoading && <div className="text-center py-4"><Spin size="small" /></div>}

                    {/* Existing temporary characters */}
                    {!tempLoading && uniqueTempCasts.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-2">Existing Temporary Characters</p>
                        <div className="space-y-2">
                          {uniqueTempCasts.map((temp, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-3 border border-amber-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 cursor-pointer transition-all"
                              onClick={() => handleSelectExistingTemp(temp)}
                            >
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <WarningOutlined className="text-amber-500 text-xs" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 truncate">
                                  {temp.characterName}
                                </div>
                                {temp.talentName && (
                                  <div className="text-xs text-gray-500">{temp.talentName}</div>
                                )}
                              </div>
                              <Tag color="gold" className="!text-[10px]">Temporary</Tag>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Create new temporary */}
                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-medium text-gray-600 mb-2">Create New Temporary Cast</p>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-3">
                        Create a temporary cast when the character hasn't been finalized in Casting yet.
                        You'll need to assign a finalized cast before moving to Finalized status.
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Character Name *</label>
                          <Input
                            value={tempCharacter}
                            onChange={(e) => setTempCharacter(e.target.value)}
                            placeholder="e.g., Guard #1, Nurse"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Talent Name (optional)</label>
                          <Input
                            value={tempTalent}
                            onChange={(e) => setTempTalent(e.target.value)}
                            placeholder="Actor name if known"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Gender (optional)</label>
                          <Select
                            value={tempGender || undefined}
                            onChange={(val) => setTempGender(val)}
                            placeholder="Select..."
                            className="w-full"
                            allowClear
                            options={[
                              { value: 'male', label: 'Male' },
                              { value: 'female', label: 'Female' },
                              { value: 'nonBinary', label: 'Non-Binary' },
                              { value: 'transgender', label: 'Transgender' },
                              { value: 'other', label: 'Other' },
                            ]}
                          />
                        </div>
                        <Button
                          type="primary"
                          block
                          disabled={!tempCharacter.trim()}
                          loading={creating}
                          onClick={handleCreateTemporary}
                        >
                          Create Temporary Cast
                        </Button>
                      </div>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default ChooseCastModal;
