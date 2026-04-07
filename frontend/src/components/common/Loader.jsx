import React from 'react';
import { Spin } from 'antd';

/**
 * Loader -- a centered spinner with optional loading text.
 *
 * @param {Object} props
 * @param {'small'|'medium'|'large'} [props.size='medium'] - Spinner size variant
 * @param {string} [props.text] - Optional text shown below the spinner
 */
const Loader = ({ size = 'medium', text = '' }) => {
  const antdSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'default';

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Spin size={antdSize} />
      {text && <p className="mt-3 text-sm text-gray-500">{text}</p>}
    </div>
  );
};

export default Loader;
