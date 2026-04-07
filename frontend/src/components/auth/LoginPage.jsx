import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiLock, FiLogIn } from 'react-icons/fi';
import { Card, Form, Select, Button, Typography, Spin } from 'antd';
import { LockOutlined, FolderOutlined, UserOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { LOCATION_API_BASE_URL } from '../../config/constants';

// Auth endpoints are on the location backend (same port as location API)
const AUTH_BASE_URL = LOCATION_API_BASE_URL.replace('/location', '');

const { Title, Text } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await axios.get(`${AUTH_BASE_URL}/auth/projects`);
        if (response.data.status === 1) {
          setProjects(response.data.data || []);
        }
      } catch (error) {
        toast.error('Failed to load projects');
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  // Fetch users when project changes
  useEffect(() => {
    if (!selectedProject) {
      setUsers([]);
      setSelectedUser('');
      return;
    }
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setSelectedUser('');
      try {
        const response = await axios.get(`${AUTH_BASE_URL}/auth/projects/${selectedProject}/users`);
        if (response.data.status === 1) {
          setUsers(response.data.data || []);
        }
      } catch (error) {
        toast.error('Failed to load users');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [selectedProject]);

  const validate = () => {
    const newErrors = {};
    if (!selectedProject) newErrors.project = 'Please select a project';
    if (!selectedUser) newErrors.user = 'Please select a user';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Generate a device ID
      const deviceId = `web-${navigator.userAgent.slice(0, 20)}-${Date.now()}`;
      const userObj = users.find((u) => (u._id || u.id) === selectedUser);
      await login(selectedUser, selectedProject, deviceId, userObj?.name || '');
      toast.success('Login successful!');
      navigate('/', { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Login failed. Please check your credentials.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProjectObj = projects.find((p) => (p._id || p.id) === selectedProject);
  const selectedUserObj = users.find((u) => (u._id || u.id) === selectedUser);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
      <Card
        className="w-full max-w-md shadow-2xl rounded-2xl border-0"
        styles={{ body: { padding: '40px 36px' } }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35)' }}
          >
            <FiLock className="text-white text-3xl" />
          </div>
          <Title level={3} className="!mb-1 !text-blue-600">Zillit Map</Title>
          <Text type="secondary">Sign in to access your project</Text>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {/* Project Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold" htmlFor="project">Select Project</label>
            <Select
              id="project"
              size="large"
              status={errors.project ? 'error' : undefined}
              value={selectedProject || undefined}
              placeholder={loadingProjects ? 'Loading projects...' : 'Choose a project...'}
              onChange={(value) => {
                setSelectedProject(value);
                if (errors.project) setErrors((prev) => ({ ...prev, project: '' }));
              }}
              disabled={isLoading || loadingProjects}
              loading={loadingProjects}
              suffixIcon={<FolderOutlined />}
              options={projects.map((project) => ({
                value: project._id || project.id,
                label: project.name,
              }))}
              className="w-full"
              allowClear
            />
            {selectedProjectObj && (
              <span className="text-xs text-gray-500 mt-0.5">{selectedProjectObj.description}</span>
            )}
            {errors.project && <span className="text-xs text-red-500 mt-0.5 font-medium">{errors.project}</span>}
          </div>

          {/* User Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold" htmlFor="user">Select User</label>
            <Select
              id="user"
              size="large"
              status={errors.user ? 'error' : undefined}
              value={selectedUser || undefined}
              placeholder={
                !selectedProject
                  ? 'Select a project first...'
                  : loadingUsers
                  ? 'Loading users...'
                  : 'Choose a user...'
              }
              onChange={(value) => {
                setSelectedUser(value);
                if (errors.user) setErrors((prev) => ({ ...prev, user: '' }));
              }}
              disabled={isLoading || !selectedProject || loadingUsers}
              loading={loadingUsers}
              suffixIcon={<UserOutlined />}
              options={users.map((user) => ({
                value: user._id || user.id,
                label: `${user.name} (${user.role})`,
              }))}
              className="w-full"
              allowClear
            />
            {selectedUserObj && (
              <span className="text-xs text-gray-500 mt-0.5">{selectedUserObj.email}</span>
            )}
            {errors.user && <span className="text-xs text-red-500 mt-0.5 font-medium">{errors.user}</span>}
          </div>

          {/* Submit Button */}
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={isLoading}
            icon={!isLoading ? <FiLogIn /> : undefined}
            className="!mt-1 !h-12 !font-semibold !text-[15px] !shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center pt-5 border-t border-gray-200">
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <FiLock className="text-sm" />
            Secure authentication for Zillit Map
          </p>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
