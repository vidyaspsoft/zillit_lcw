import React from 'react';
import { Result, Button } from 'antd';
import { FiInbox } from 'react-icons/fi';

/**
 * EmptyState -- placeholder shown when a list or page has no content.
 *
 * @param {Object} props
 * @param {React.ComponentType} [props.icon=FiInbox] - Icon component rendered at the top
 * @param {string} [props.title='No data'] - Heading text
 * @param {string} [props.message] - Descriptive text below the heading
 * @param {Function} [props.action] - Click handler for the optional CTA button
 * @param {string} [props.actionLabel] - Label for the CTA button
 */
const EmptyState = ({ icon: Icon = FiInbox, title = 'No data', message = '', action, actionLabel }) => {
  return (
    <Result
      icon={<Icon className="text-4xl text-gray-400 mx-auto" />}
      title={<span className="text-lg font-medium text-gray-700">{title}</span>}
      subTitle={message ? <span className="text-gray-500">{message}</span> : undefined}
      extra={
        action && actionLabel ? (
          <Button type="primary" onClick={action}>
            {actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
};

export default EmptyState;
