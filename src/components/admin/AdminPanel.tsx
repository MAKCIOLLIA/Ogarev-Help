import { useState, useEffect } from 'react';
import DashboardTab from './DashboardTab';
import UsersTab from './UsersTab';
import ConsultationsTab from './ConsultationsTab';
import SpecializationsTab from './DataTab';
import RecommendationsEditor from './RecommendationsEditor';
import AdminLogsTab from './AdminLogsTab';

import TestsTab from './TestsTab';

interface AdminPanelProps {
  activeSection?: string;
}

const SECTIONS = [
  { id: 'dashboard', label: 'Аналитика' },
  { id: 'users',        label: 'Пользователи' },
  { id: 'consultations', label: 'Консультации' },
  { id: 'recommendations', label: 'Методический блок' },
  { id: 'tests', label: 'Тесты' },
  { id: 'specializations', label: 'Настройки' },
  { id: 'logs', label: 'Логи' },
];

export default function AdminPanel({ activeSection: propActiveSection }: AdminPanelProps = {}) {
  const [activeSection, setActiveSection] = useState(propActiveSection || 'dashboard');

  useEffect(() => {
    if (propActiveSection) setActiveSection(propActiveSection);
  }, [propActiveSection]);

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Панель администратора</h1>
      <div className="flex gap-2 mb-6 border-b overflow-x-auto pb-[1px]">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`whitespace-nowrap px-5 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeSection === s.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {activeSection === 'dashboard'       && <DashboardTab />}
      {activeSection === 'users'           && <UsersTab />}
      {activeSection === 'consultations'   && <ConsultationsTab />}
      {activeSection === 'recommendations' && <RecommendationsEditor />}
      {activeSection === 'tests'           && <TestsTab />}
      {activeSection === 'specializations' && <SpecializationsTab />}
      {activeSection === 'logs'            && <AdminLogsTab />}
    </div>
  );
}