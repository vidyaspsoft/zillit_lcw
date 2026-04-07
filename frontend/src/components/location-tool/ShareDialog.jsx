import React, { useState } from 'react';
import { Button, Input } from 'antd';
import { CloseOutlined, SendOutlined } from '@ant-design/icons';

const ShareDialog = ({ onShare, onClose, count }) => {
  const [emails, setEmails] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailList = emails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (emailList.length === 0) {
      alert('Please enter at least one email or user ID');
      return;
    }

    setSending(true);
    await onShare(emailList, message);
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Share {count} Location{count !== 1 ? 's' : ''}</h3>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white rounded-b-xl">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Recipients (comma-separated emails or user IDs)
            </label>
            <Input
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="user1@example.com, user2@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Message (optional)
            </label>
            <Input.TextArea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Check out these locations..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={sending} icon={<SendOutlined />}>
              {sending ? 'Sharing...' : 'Share'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShareDialog;
