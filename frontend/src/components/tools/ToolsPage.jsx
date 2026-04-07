import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiUsers, FiUserPlus, FiScissors, FiCalendar, FiArrowRight } from 'react-icons/fi';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

const tools = [
  {
    id: 'location-tool',
    title: 'Location Tool',
    description: 'Scout, shortlist, and finalize shooting locations',
    icon: FiMapPin,
    path: '/location-tool',
    color: '#E74C3C',
    gradient: 'linear-gradient(135deg, #E74C3C, #C0392B)',
  },
  {
    id: 'casting-tool',
    title: 'Casting (Main)',
    description: 'Select, shortlist, and finalize lead, supporting, and named characters',
    icon: FiUsers,
    path: '/casting-tool',
    color: '#8E44AD',
    gradient: 'linear-gradient(135deg, #8E44AD, #6C3483)',
  },
  {
    id: 'background-casting-tool',
    title: 'Casting (Background)',
    description: 'Manage background extras, stand-ins, and crowd casting',
    icon: FiUserPlus,
    path: '/background-casting-tool',
    color: '#2563EB',
    gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  },
  {
    id: 'costume-tool',
    title: 'Costume (Main)',
    description: 'Manage costumes, fittings, and continuity for main cast',
    icon: FiScissors,
    path: '/costume-tool',
    color: '#059669',
    gradient: 'linear-gradient(135deg, #10B981, #047857)',
  },
  {
    id: 'background-costume-tool',
    title: 'Costume (Background)',
    description: 'Manage costumes for background extras and crowd',
    icon: FiScissors,
    path: '/background-costume-tool',
    color: '#0891B2',
    gradient: 'linear-gradient(135deg, #06B6D4, #0E7490)',
  },
  {
    id: 'box-schedule',
    title: 'Box Schedule',
    description: 'Plan production days — prep, shoot, wrap, travel and off days',
    icon: FiCalendar,
    path: '/box-schedule',
    color: '#F39C12',
    gradient: 'linear-gradient(135deg, #F39C12, #E67E22)',
  },
];

/**
 * ToolsPage -- Landing page after login showing available tool cards.
 */
const ToolsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Welcome to Zillit
        </h2>
        <p className="text-gray-500">
          Select a tool to get started
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => {
          const IconComponent = tool.icon;
          return (
            <Card
              key={tool.id}
              hoverable
              className="rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 group cursor-pointer"
              styles={{ body: { padding: '28px 24px' } }}
              onClick={() => navigate(tool.path)}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-xl text-white shadow-md"
                  style={{ background: tool.gradient }}
                >
                  <IconComponent className="text-3xl" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">{tool.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{tool.description}</p>
                </div>
                <div className="text-xl text-gray-300 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-blue-500">
                  <FiArrowRight />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ToolsPage;
