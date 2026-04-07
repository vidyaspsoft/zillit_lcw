import React from 'react';
import { Modal, Button } from 'antd';
import { FiAlertTriangle } from 'react-icons/fi';

/**
 * ConfirmDialog -- a modal dialog for confirming destructive or important actions.
 *
 * @param {Object} props
 * @param {string} [props.title='Confirm Action'] - Dialog title
 * @param {string} [props.message] - Body message explaining the action
 * @param {string} [props.confirmLabel='Confirm'] - Label for the confirm button
 * @param {string} [props.cancelLabel='Cancel'] - Label for the cancel button
 * @param {'primary'|'danger'} [props.variant='primary'] - Visual style variant
 * @param {Function} props.onConfirm - Called when the user confirms
 * @param {Function} props.onCancel - Called when the user cancels or clicks the overlay
 */
const ConfirmDialog = ({
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      open={true}
      title={
        <div className="flex items-center gap-2">
          {variant === 'danger' && <FiAlertTriangle className="text-red-500 text-lg" />}
          <span>{title}</span>
        </div>
      }
      onCancel={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button
            type="primary"
            danger={variant === 'danger'}
            className={variant !== 'danger' ? 'btn-success' : ''}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-gray-600">{message}</p>
    </Modal>
  );
};

export default ConfirmDialog;
