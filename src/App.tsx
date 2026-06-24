import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ToastContainer from './components/shared/ToastContainer';
import ConfirmModal from './components/shared/ConfirmModal';
import Login from './components/Login';
import Register from './components/Register';
import Layout from './components/Layout';
import StudentProfile from './components/student/StudentProfile';
import StudentSchedule from './components/student/StudentSchedule';
import StudentConsultations from './components/student/StudentConsultations';
import ChildrenManagement from './components/parent/ChildrenManagement';
import ChildConsultationsView from './components/parent/ChildConsultationsView';
import ParentDashboard from './components/parent/ParentDashboard';
import FamilyCalendar from './components/parent/FamilyCalendar';
import ParentFinances from './components/parent/ParentFinances';
import ParentNewConsultation from './components/parent/ParentNewConsultation';
import NewConsultation from './components/child/NewConsultation';
import { ChildConsultations } from './components/child/ChildConsultations';
import ChildDashboard from './components/child/ChildDashboard';
import Messages from './components/shared/Messages';
import { Notifications } from './components/shared/Notifications';
import AdminPanel from './components/admin/AdminPanel';
import Profile from './components/shared/Profile';
import StudentApplications from './components/student/StudentApplications';
import Recommendations from './components/shared/Recommendations';
import StudentDashboard from './components/student/StudentDashboard';
import StudentFinance from './components/student/StudentFinance';
import StudentMaterials from './components/student/StudentMaterials';
import ReauthModal from './components/shared/ReauthModal';
import { Clock, ClipboardCheck } from 'lucide-react';
import { useRealtimeUpdates } from './hooks/useRealtimeUpdates';
import { supabase } from './lib/supabase';

import TestingInterface from './components/shared/TestingInterface';
import StudentCodeAcceptance from './components/shared/StudentCodeAcceptance';

function AppContent() {
  const { user, loading, switchToParent, isTokenExpired, renewToken, logout, testStatus, refreshTestStatus } = useAuth();
  
  // Подключаем систему Realtime-уведомлений
  useRealtimeUpdates();

  const [showRegister, setShowRegister] = useState(false);
  const [showSwitchParentModal, setShowSwitchParentModal] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('activeTab');
    if (saved) return saved;
    return 'dashboard';
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    if (showRegister) {
      return <Register onBackClick={() => setShowRegister(false)} />;
    }
    return <Login onRegisterClick={() => setShowRegister(true)} />;
  }

  // Логика обязательного онбординга для студентов (тест + кодекс)
  if (user.role === 'student' && testStatus) {
    const entrance = testStatus.entrance_test;
    
    // 1. Входной тест (если есть и не пройден)
    if (entrance?.exists && entrance.status !== 'passed') {
      if (entrance.status === 'not_started' || entrance.status === 'started' || (entrance.status === 'failed' && entrance.can_retry)) {
        return (
          <TestingInterface 
            testId={entrance.test_id} 
            onComplete={() => refreshTestStatus()} 
          />
        );
      }

      if (entrance.status === 'failed' && !entrance.can_retry) {
        return (
          <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border-t-8 border-red-500">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock size={40} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-4">Тестирование провалено</h2>
              <p className="text-gray-600 leading-relaxed mb-8">
                К сожалению, вы не набрали проходной балл. Согласно правилам платформы, следующая попытка будет доступна через 3 месяца.
              </p>
              <div className="bg-red-50 p-4 rounded-2xl mb-8">
                <p className="text-sm font-bold text-red-800">Дата следующей попытки:</p>
                <p className="text-xl font-black text-red-600">
                  {new Date(entrance.retry_after!).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <button onClick={logout} className="text-gray-400 font-bold hover:text-gray-600 underline">Выйти из аккаунта</button>
            </div>
          </div>
        );
      }

      if (entrance.status === 'pending_admin') {
        return (
          <div className="min-h-screen bg-orange-50 flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border-t-8 border-orange-500">
              <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <ClipboardCheck size={40} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-4">Ожидание решения</h2>
              <p className="text-gray-600 leading-relaxed mb-8">
                Вы набрали недостаточно баллов, но так как ваш средний балл зачетки высок (≥ 4.5), ваша ситуация передана на рассмотрение администратору.
              </p>
              <p className="text-sm text-gray-400 font-medium mb-8">Пожалуйста, подождите. Мы сообщим вам о результате.</p>
              <button onClick={logout} className="text-gray-400 font-bold hover:text-gray-600 underline">Выйти из аккаунта</button>
            </div>
          </div>
        );
      }
    }

    // 2. Обязательное принятие кодекса студента (если еще не принято)
    if (!testStatus.accepted_code_at) {
      return (
          <StudentCodeAcceptance 
              codeUrl={supabase.storage.from('Documents').getPublicUrl('system/student_code.pdf').data.publicUrl}
              onComplete={() => refreshTestStatus()}
          />
      );
    }
  }

  // Установка начальной вкладки для разных ролей, если она не установлена
  if ((user.role === 'child' || user.role === 'student') && activeTab === 'profile' && !localStorage.getItem('activeTab')) {
    setActiveTab('dashboard');
  }

  const handleTabChange = (tab: string) => {
    if (tab === 'switch-parent' && user.role === 'child') {
      setShowSwitchParentModal(true);
    } else {
      setActiveTab(tab);
      localStorage.setItem('activeTab', tab);
    }
  };

  const handleSwitchParentSubmit = async (password: string) => {
    setIsSwitching(true);
    const result = await switchToParent(password);
    setIsSwitching(false);
    
    if (result.success) {
      setShowSwitchParentModal(false);
      setActiveTab('dashboard');
    } else {
      throw new Error(result.error || 'Ошибка при переключении');
    }
  };

  const handleRenewToken = async (password: string) => {
    const success = await renewToken(password);
    if (!success) {
      throw new Error('Неверный пароль');
    }
  };

  const renderContent = () => {
    if (user.role === 'student') {
      switch (activeTab) {
        case 'dashboard':
          return <StudentDashboard onTabChange={handleTabChange} />;
        case 'profile':
          return <StudentProfile />;
        case 'applications':
          return <StudentApplications />;
        case 'recommendations':
          return <Recommendations />;
        case 'schedule':
          return <StudentSchedule />;
        case 'consultations':
          return <StudentConsultations />;
        case 'finance':
          return <StudentFinance />;
        case 'materials':
          return <StudentMaterials />;
        case 'messages':
          return <Messages />;
        case 'notifications':
          return <Notifications />;
        default:
          return <StudentDashboard onTabChange={handleTabChange} />;
      }
    }

    if (user.role === 'parent') {
      if (activeTab.startsWith('child-')) {
        const childId = activeTab.replace('child-', '');
        return <ChildConsultationsView childId={childId} />;
      }

      switch (activeTab) {
        case 'dashboard':
          return <ParentDashboard onTabChange={handleTabChange} />;
        case 'calendar':
          return <FamilyCalendar />;
        case 'finances':
          return <ParentFinances />;
        case 'new-consultation':
          return <ParentNewConsultation onTabChange={handleTabChange} />;
        case 'recommendations':
          return <Recommendations />;
        case 'profile':
          return <Profile />;
        case 'children':
          return <ChildrenManagement />;
        case 'notifications':
          return <Notifications />;
        case 'messages':
          return <Messages />;
        default:
          return <ParentDashboard onTabChange={handleTabChange} />;
      }
    }

    if (user.role === 'child') {
      switch (activeTab) {
        case 'dashboard':
          return <ChildDashboard onTabChange={handleTabChange} />;
        case 'profile':
          return <Profile />;
        case 'new-consultation':
          return <NewConsultation onTabChange={handleTabChange} />;
        case 'recommendations':
          return <Recommendations />;
        case 'notifications':
          return <Notifications />;
        case 'consultations':
          return <ChildConsultations onTabChange={handleTabChange} />;
        case 'messages':
          return <Messages />;
        default:
          return <ChildDashboard onTabChange={handleTabChange} />;
          }
        }

    if (user.role === 'admin') {
      switch (activeTab) {
        case 'profile':
          return <Profile />;
        case 'admin-panel':
          return <AdminPanel />;
        case 'notifications':
          return <Notifications />;
        case 'messages':
          return <Messages />;
        default:
          return <Profile />;
      }
    }

    return <div>Неизвестная роль</div>;
  };

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={handleTabChange}>
        {renderContent()}
      </Layout>

      {isTokenExpired && (
        <ReauthModal
          title="Сессия истекла"
          description="Ваша сессия истекла (прошло более 7 дней). Пожалуйста, введите пароль, чтобы продолжить работу, или выйдите из аккаунта."
          onSubmit={handleRenewToken}
          onLogout={logout}
          isLoading={false}
        />
      )}

      {showSwitchParentModal && (
        <ReauthModal
          title="Переход к родителю"
          description="Для перехода в аккаунт родителя, пожалуйста, введите пароль родителя."
          onSubmit={handleSwitchParentSubmit}
          onClose={() => setShowSwitchParentModal(false)}
          isLoading={isSwitching}
        />
      )}

      <ToastContainer />
      <ConfirmModal />
    </>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;