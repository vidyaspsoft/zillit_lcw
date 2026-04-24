const LOCATION_BACKEND = import.meta.env.VITE_LOCATION_BACKEND_URL || 'http://localhost:5003';
const CASTING_BACKEND = import.meta.env.VITE_CASTING_BACKEND_URL || 'http://localhost:5004';
const WARDROBE_BACKEND = import.meta.env.VITE_WARDROBE_BACKEND_URL || 'http://localhost:5005';

export const API_BASE_URL = `${LOCATION_BACKEND}/api/v2`;
export const BACKEND_URL = LOCATION_BACKEND;
export const LOCATION_API_BASE_URL = `${LOCATION_BACKEND}/api/v2/location`;
export const CASTING_API_BASE_URL = `${CASTING_BACKEND}/api/v2/casting`;
export const WARDROBE_API_BASE_URL = `${WARDROBE_BACKEND}/api/v2/wardrobe`;
export const BOX_SCHEDULE_API_BASE_URL = 'https://productionapi-dev.zillit.com/api/v2/box-schedule';

export const BOX_SCHEDULE_HEADERS = {
  Accept: 'application/json',
  'Accept-Charset': 'UTF-8',
  Timezone: 'Asia/Kolkata',
  bodyhash: '502d11c05b36af506ed969b29b3f73c43f83ce85bc303640a24c9da032c2eb56',
  moduledata:
    '695308702698fdd102cb91252812508cff101e70dedfbb4a8b6419e914f88f30b5d938cfff5f8475812d7563bd035597d5fd2a7e452841c7b1e93b1eec49ff92912f3340142cb14f1b08e296752e00e824838b64c5dd6aebcf0e1d6cfe39701ff9bb9c6777d3d540c791c2f5122294bbf3ece41736016111cf4163fe5ce4926c32298be1c15af9a6c06c58ce50aeb2dd99b2ddb1a97613f8e2cb7c1793b6ab5a0bec790e9dff7cbbeef730215574c20ad2b3c1a38741bd4c48e4f3b45013f946c95e44b8d99d6c2ecfcb2147b8b513ef',
};

export const GOOGLE_MAPS_API_KEY = 'AIzaSyCO1UjERiJOaDMv8v4nhzTihT2Kgs4KOdk';

export const COLORS = {
  primary: '#1B4F72',
  secondary: '#2E86C1',
  accent: '#3498DB',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  background: '#F5F7FA',
  cardBg: '#FFFFFF',
  textPrimary: '#2C3E50',
  textSecondary: '#7F8C8D',
  border: '#E0E0E0',
};
