import React, { useState, useMemo, useRef } from 'react';
import { Button, Upload, Table, Alert, Tag, Checkbox, Tooltip } from 'antd';
import { InboxOutlined, CloseOutlined, PictureOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import wardrobeToolService from '../../services/wardrobeToolService';
import { toast } from 'react-toastify';

const EXPECTED_COLUMNS = {
  charactername: 'characterName',
  talentname: 'talentName',
  episode: 'episode',
  gender: 'gender',
  casttype: 'castType',
  jobfrequency: 'jobFrequency',
  age: 'age',
  ethnicity: 'ethnicity',
  height: 'height',
  build: 'build',
  unionstatus: 'unionStatus',
  specialskills: 'specialSkills',
  description: 'description',
  haircolor: 'hairColor',
  eyecolor: 'eyeColor',
  image: '_image',
  imagefile: '_image',
  photo: '_image',
  headshot: '_image',
};

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map((line, idx) => {
    const values = parseRow(line);
    const row = { _rowKey: idx };
    headers.forEach((h, i) => {
      const mapped = EXPECTED_COLUMNS[h.toLowerCase().replace(/[\s_-]/g, '')] || h;
      row[mapped] = values[i] || '';
    });
    return row;
  });

  return { headers, rows };
};

const BulkImportModal = ({ activeTab, onClose, onSuccess, toolType = 'main' }) => {
  const [csvData, setCsvData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  // Map: rowKey → { file: File, preview: string }
  const [rowImages, setRowImages] = useState({});
  const fileInputRefs = useRef({});

  // ── CSV upload ──
  const handleCSVUpload = (file) => {
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseCSV(e.target.result);
        if (result.rows.length === 0) {
          setError('No data rows found in CSV');
          return;
        }
        setCsvData(result);
        setSelectedKeys(result.rows.map((r) => r._rowKey));
        setRowImages({});
      } catch {
        setError('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
    return false;
  };

  // ── Assign image(s) to a row (supports multiple) ──
  const assignImageToRow = (rowKey, file) => {
    const preview = URL.createObjectURL(file);
    setRowImages((prev) => ({
      ...prev,
      [rowKey]: [...(prev[rowKey] || []), { file, preview }],
    }));
  };

  const removeImageFromRow = (rowKey, idx) => {
    setRowImages((prev) => {
      const images = [...(prev[rowKey] || [])];
      if (images[idx]?.preview) URL.revokeObjectURL(images[idx].preview);
      images.splice(idx, 1);
      if (images.length === 0) {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      }
      return { ...prev, [rowKey]: images };
    });
  };

  const handleFileInputChange = (rowKey, e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        assignImageToRow(rowKey, file);
      }
    });
    e.target.value = '';
  };

  // ── Bulk image upload (auto-match by filename) ──
  const handleBulkImageUpload = (file) => {
    if (!csvData?.rows?.length) return false;

    const fileName = file.name.toLowerCase();
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');

    // Try to match to a row
    let matchedKey = null;

    for (const row of csvData.rows) {
      // Match by CSV "image" column
      if (row._image && row._image.toLowerCase() === fileName) {
        matchedKey = row._rowKey;
        break;
      }
      // Match by talent name
      const talentNorm = (row.talentName || '').toLowerCase().replace(/[_-]/g, ' ');
      if (talentNorm && nameWithoutExt.includes(talentNorm)) {
        matchedKey = row._rowKey;
        break;
      }
      // Match by character name
      const charNorm = (row.characterName || '').toLowerCase().replace(/[_-]/g, ' ');
      if (charNorm && nameWithoutExt.includes(charNorm)) {
        if (!matchedKey) matchedKey = row._rowKey; // prefer talent match
      }
    }

    if (matchedKey !== null) {
      assignImageToRow(matchedKey, file);
    }

    return false;
  };

  // ── Selection ──
  const allSelected = csvData?.rows?.length > 0 && selectedKeys.length === csvData.rows.length;
  const someSelected = selectedKeys.length > 0 && !allSelected;
  const toggleSelectAll = () => {
    setSelectedKeys(allSelected ? [] : csvData.rows.map((r) => r._rowKey));
  };
  const toggleRow = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // ── Stats ──
  const selectedCount = selectedKeys.length;
  const rowsWithImages = Object.keys(rowImages).length;
  const totalImageCount = Object.values(rowImages).reduce((sum, imgs) => sum + imgs.length, 0);
  const selectedWithImages = selectedKeys.filter((k) => rowImages[k]?.length > 0).length;

  // ── Table columns ──
  const columns = useMemo(() => {
    if (!csvData?.rows?.length) return [];

    const checkCol = {
      title: (
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={toggleSelectAll}
        />
      ),
      key: '_select',
      width: 40,
      fixed: 'left',
      render: (_, record) => (
        <Checkbox
          checked={selectedKeys.includes(record._rowKey)}
          onChange={() => toggleRow(record._rowKey)}
        />
      ),
    };

    // Data columns (exclude internal fields)
    const dataCols = Object.keys(csvData.rows[0])
      .filter((k) => !k.startsWith('_'))
      .map((key) => ({
        title: key,
        dataIndex: key,
        key,
        ellipsis: true,
        width: key === 'description' || key === 'specialSkills' ? 160 : 100,
      }));

    // Image assignment column (last) — supports multiple images
    const imageCol = {
      title: 'Photos',
      key: '_photo',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const images = rowImages[record._rowKey] || [];
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.preview}
                  alt=""
                  className="w-8 h-8 rounded object-cover border border-green-300"
                />
                <button
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
                  onClick={() => removeImageFromRow(record._rowKey, idx)}
                >
                  &times;
                </button>
              </div>
            ))}
            <Tooltip title="Add photo(s)">
              <button
                className="w-8 h-8 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer bg-transparent"
                onClick={() => fileInputRefs.current[record._rowKey]?.click()}
              >
                <PlusOutlined style={{ fontSize: 10 }} />
              </button>
            </Tooltip>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              ref={(el) => { fileInputRefs.current[record._rowKey] = el; }}
              onChange={(e) => handleFileInputChange(record._rowKey, e)}
            />
          </div>
        );
      },
    };

    return [checkCol, ...dataCols, imageCol];
  }, [csvData, selectedKeys, allSelected, someSelected, rowImages]);

  // ── Import ──
  const handleImport = async () => {
    if (selectedCount === 0) return;

    // Validate: every selected row must have at least one photo
    const missingPhotos = csvData.rows
      .filter((r) => selectedKeys.includes(r._rowKey) && !(rowImages[r._rowKey]?.length > 0))
      .map((r) => r.talentName || r.characterName || `Row ${r._rowKey + 1}`);

    if (missingPhotos.length > 0) {
      const names = missingPhotos.slice(0, 5).join(', ');
      const more = missingPhotos.length > 5 ? ` and ${missingPhotos.length - 5} more` : '';
      setError(`Photo required for every row. Missing: ${names}${more}`);
      return;
    }

    setImporting(true);
    setError('');

    try {
      const selectedRows = csvData.rows.filter((r) => selectedKeys.includes(r._rowKey));

      const formData = new FormData();
      formData.append('status', activeTab);
      formData.append('toolType', toolType);

      const castingsData = [];
      const imageFiles = [];

      selectedRows.forEach((row) => {
        const { _rowKey, _image, ...data } = row;
        const images = rowImages[_rowKey] || [];

        // Track start index and count of images for this row
        const startIdx = imageFiles.length;
        images.forEach((img) => imageFiles.push(img.file));

        castingsData.push({
          ...data,
          _imageStartIndex: images.length > 0 ? startIdx : -1,
          _imageCount: images.length,
        });
      });

      formData.append('castings', JSON.stringify(castingsData));
      imageFiles.forEach((file) => formData.append('files', file));

      const result = await wardrobeToolService.bulkImportWithImages(formData);
      const imported = result.data?.importedCount || selectedCount;
      const imgs = result.data?.imagesAttached || 0;
      toast.success(`${imported} casting(s) imported${imgs > 0 ? ` with ${imgs} photo(s)` : ''}`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Bulk Import</h3>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}

          {/* Step 1: Upload CSV */}
          {!csvData ? (
            <Upload.Dragger
              accept=".csv"
              beforeUpload={handleCSVUpload}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Drop CSV file here or click to browse</p>
              <p className="ant-upload-hint">
                Columns: Character Name, Talent Name, Episode, Gender, Cast Type, Job Frequency, Age, Ethnicity, Height, Build, Hair Color, Eye Color, Special Skills, Union Status, Description
              </p>
            </Upload.Dragger>
          ) : (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium">{csvData.rows.length} rows</span>
                  {selectedCount === csvData.rows.length ? (
                    <Tag color="green">All selected</Tag>
                  ) : (
                    <Tag color="orange">{selectedCount} selected</Tag>
                  )}
                  <Tag color={totalImageCount > 0 ? 'blue' : 'default'} icon={<PictureOutlined />}>
                    {totalImageCount} photo{totalImageCount !== 1 ? 's' : ''} across {rowsWithImages} row{rowsWithImages !== 1 ? 's' : ''}
                  </Tag>
                </div>
                <div className="flex gap-2">
                  <Button size="small" onClick={() => { setCsvData(null); setSelectedKeys([]); setRowImages({}); }}>
                    Change File
                  </Button>
                  <Tag color="blue">Importing to: {activeTab}</Tag>
                </div>
              </div>

              {/* Tip */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-600">
                <PictureOutlined className="mr-1" />
                Use the <strong>Photos</strong> column on the right to attach headshots/images per talent. Click <strong>+</strong> to add multiple photos.
              </div>

              {/* Data table with photo assignment column */}
              <Table
                dataSource={csvData.rows.map((r) => ({ ...r, key: r._rowKey }))}
                columns={columns}
                size="small"
                scroll={{ x: 1200, y: 350 }}
                pagination={false}
                bordered
                rowClassName={(record) => {
                  if (!selectedKeys.includes(record._rowKey)) return 'opacity-40';
                  if (!(rowImages[record._rowKey]?.length > 0)) return 'bg-red-50';
                  return '';
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {csvData && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <span className="text-xs text-gray-400">
              {selectedCount} of {csvData.rows.length} rows
              {totalImageCount > 0 ? ` | ${totalImageCount} photos` : ''}
              {selectedCount - selectedWithImages > 0 && (
                <span className="text-red-500 ml-2">
                  ({selectedCount - selectedWithImages} missing photos)
                </span>
              )}
            </span>
            <div className="flex gap-3">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                type="primary"
                onClick={handleImport}
                loading={importing}
                disabled={selectedCount === 0}
              >
                Import {selectedCount} Casting{selectedCount !== 1 ? 's' : ''}
                {totalImageCount > 0 ? ` + ${totalImageCount} photo${totalImageCount !== 1 ? 's' : ''}` : ''}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkImportModal;
