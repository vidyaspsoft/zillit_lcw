import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'antd';
import { CloseOutlined, SendOutlined, MessageOutlined } from '@ant-design/icons';

const UNIT_LABELS = {
  select: 'Selects',
  shortlist: 'Shortlisted',
  final: 'Final',
};

const UnitChatPanel = ({ unit, chats, onFetch, onSend, onClose }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    onFetch(unit);
  }, [unit, onFetch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const result = await onSend(unit, text.trim());
    if (result) {
      setText('');
      onFetch(unit);
    }
    setSending(false);
  };

  return (
    <div className="w-80 flex flex-col border-l border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <MessageOutlined className="text-blue-500" />
        <h3 className="text-sm font-semibold flex-1">{UNIT_LABELS[unit] || unit} Chat</h3>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(!chats || chats.length === 0) && (
          <p className="text-sm text-gray-400 text-center py-8">No messages yet. Start the conversation.</p>
        )}
        {chats.map((msg) => (
          <div key={msg._id} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800">{msg.userName || 'User'}</span>
              <span className="text-[10px] text-gray-400">
                {new Date(msg.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-gray-700">{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="flex items-center gap-2 px-4 py-3 border-t border-gray-200" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
        />
        <Button
          type="primary"
          htmlType="submit"
          icon={<SendOutlined />}
          disabled={!text.trim() || sending}
          size="small"
        />
      </form>
    </div>
  );
};

export default UnitChatPanel;
