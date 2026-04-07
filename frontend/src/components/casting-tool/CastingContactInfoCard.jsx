import React from 'react';
import { Card, Tag, Space, Typography, Button } from 'antd';
import {
  EditOutlined, DeleteOutlined,
  MailOutlined, PhoneOutlined, UserOutlined,
} from '@ant-design/icons';

const { Text, Link } = Typography;

const TYPE_COLORS = {
  Agent: 'blue',
  Manager: 'purple',
  Talent: 'green',
  Other: 'default',
};

const CastingContactInfoCard = ({ contacts = [], onEdit, onDelete, readOnly = false }) => {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <UserOutlined style={{ fontSize: 24 }} />
        <p className="mt-2 text-sm">No contacts added</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contacts.map((contact, index) => {
        const phoneWithCode = contact.countryCode
          ? `${contact.countryCode}${contact.phone}`
          : contact.phone;

        return (
          <Card
            key={contact._id || index}
            size="small"
            className="border border-gray-200"
            bodyStyle={{ padding: '12px 16px' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Space size={8} className="mb-1">
                  {contact.type && (
                    <Tag color={TYPE_COLORS[contact.type] || 'default'} className="text-xs">
                      {contact.type}
                    </Tag>
                  )}
                </Space>

                <Text strong className="block text-sm truncate">
                  {contact.name || 'Unnamed Contact'}
                </Text>

                {contact.company && (
                  <Text type="secondary" className="block text-xs truncate">
                    {contact.company}
                  </Text>
                )}

                <Space direction="vertical" size={2} className="mt-2">
                  {contact.email && (
                    <div className="flex items-center gap-1.5">
                      <MailOutlined className="text-gray-400" style={{ fontSize: 12 }} />
                      <Link href={`mailto:${contact.email}`} className="text-xs">
                        {contact.email}
                      </Link>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-1.5">
                      <PhoneOutlined className="text-gray-400" style={{ fontSize: 12 }} />
                      <Link href={`tel:${phoneWithCode}`} className="text-xs">
                        {contact.countryCode && (
                          <span className="text-gray-400 mr-1">{contact.countryCode}</span>
                        )}
                        {contact.phone}
                      </Link>
                    </div>
                  )}
                </Space>
              </div>

              {!readOnly && (onEdit || onDelete) && (
                <Space size={4}>
                  {onEdit && (
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => onEdit(contact, index)}
                    />
                  )}
                  {onDelete && (
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => onDelete(contact, index)}
                    />
                  )}
                </Space>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default CastingContactInfoCard;
