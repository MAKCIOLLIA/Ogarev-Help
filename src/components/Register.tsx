import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getErrorMessage } from '../lib/utils';
import { mrsuApi, AcademicRecord } from '../lib/mrsuApi';

interface RegisterProps {
  onBackClick: () => void;
}

export default function Register({ onBackClick }: RegisterProps) {
  const [role, setRole] = useState<'student' | 'parent'>('parent');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [gradeAverage, setGradeAverage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // University API state
  const [showUniAuth, setShowUniAuth] = useState(false);
  const [uniLogin, setUniLogin] = useState('');
  const [uniPassword, setUniPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [academicRecords, setAcademicRecords] = useState<AcademicRecord[]>([]);
  const [isVerified, setIsVerified] = useState(false);

  const handleVerifyUni = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError('');

    try {
      const result = await mrsuApi.verifyStudent(uniLogin, uniPassword, (msg) => {
        setUploadProgress(msg);
      });

      setAcademicRecords(result.records);
      setGradeAverage(result.averageGrade);
      setIsVerified(true);
      setShowUniAuth(false);

    } catch (err) {
      console.error('Verification failed:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsVerifying(false);
      setUploadProgress('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (role === 'student' && !isVerified) {
      setError('Необходимо подтвердить статус через ЭИОС МГУ');
      return;
    }

    // Проверка существующего пользователя
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      setError('Пользователь с таким email уже существует');
      return;
    }

    setUploading(true);
    setUploadProgress('Создание учётной записи...');

    try {
      // 1. Создание пользователя через RPC
      const { data: newUserId, error: userError } = await supabase.rpc('register_user', {
        p_email: email,
        p_password: password,
        p_full_name: fullName,
        p_role: role,
        p_grade_average: role === 'student' ? parseFloat(gradeAverage) : null,
        p_grade_book_path: null
      });

      if (userError || !newUserId) {
        console.error(userError);
        setError(getErrorMessage(userError || 'Ошибка при создании пользователя'));
        return;
      }

      // Всегда активируем пользователя сразу
      await supabase.from('users').update({ status: 'active' }).eq('id', newUserId);

      setSuccess(true);
      setTimeout(() => {
        onBackClick();
      }, 3000);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-green-600 mb-4 text-5xl">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Регистрация успешна!</h2>
          <p className="text-gray-600">Теперь вы можете войти в систему</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      {/* Uni Auth Modal */}
      {showUniAuth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-blue-900 mb-4 text-center">Вход в ЭИОС МГУ</h2>
            <form onSubmit={handleVerifyUni} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
                <input
                  type="text"
                  value={uniLogin}
                  onChange={(e) => setUniLogin(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                <input
                  type="password"
                  value={uniPassword}
                  onChange={(e) => setUniPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
              >
                {isVerifying ? 'Проверка...' : 'Войти и подтвердить'}
              </button>
              <button
                type="button"
                onClick={() => setShowUniAuth(false)}
                className="w-full text-gray-600 py-1 text-sm"
              >
                Отмена
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Academic Records Table View */}
      {isVerified && academicRecords.length > 0 && !success && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">Результаты верификации</h2>
            <p className="text-gray-600 mb-4">
              Найдены следующие экзамены в прошедших семестрах:
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Дисциплина</th>
                    <th className="px-4 py-2 font-semibold">Семестр</th>
                    <th className="px-4 py-2 font-semibold">Балл</th>
                    <th className="px-4 py-2 font-semibold">Оценка</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {academicRecords.map((record, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">{record.discipline}</td>
                      <td className="px-4 py-2 text-gray-500">{record.semester}</td>
                      <td className="px-4 py-2 font-medium">{record.score}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          record.grade === 5 ? 'bg-green-100 text-green-700' :
                          record.grade === 4 ? 'bg-blue-100 text-blue-700' :
                          record.grade === 3 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {record.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50 font-bold">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right">Средний балл:</td>
                    <td className="px-4 py-3 text-blue-900 text-lg">{gradeAverage}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setIsVerified(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  // Keep isVerified true and close this view to proceed with registration form
                  setAcademicRecords([]); 
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Подтвердить и продолжить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-blue-900">Регистрация</h1>
        <p className="text-center text-gray-600 mb-6">Огарёв - Точка знаний</p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setRole('parent')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              role === 'parent'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Родитель
          </button>
          <button
            onClick={() => setRole('student')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              role === 'student'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Студент
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Подтверждение пароля</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {role === 'student' && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-sm text-blue-900 font-medium mb-3">Верификация статуса студента</p>
              {!isVerified ? (
                <button
                  type="button"
                  onClick={() => setShowUniAuth(true)}
                  className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                >
                  <span>🔐 Подтвердить через ЭИОС МГУ</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-green-700 text-sm font-bold bg-green-50 p-2 rounded-lg border border-green-100">
                  <span>✅ Статус подтвержден (балл: {gradeAverage})</span>
                  <button 
                    type="button" 
                    onClick={() => setIsVerified(false)}
                    className="ml-auto text-xs text-gray-500 underline"
                  >
                    Сбросить
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 py-2 px-3 rounded-lg">
              {error}
            </div>
          )}

          {uploading && uploadProgress && (
            <div className="text-blue-600 text-sm text-center bg-blue-50 py-2 px-3 rounded-lg flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {uploadProgress}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || isVerifying}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? 'Обработка...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onBackClick}
            disabled={uploading || isVerifying}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
          >
            Вернуться к входу
          </button>
        </div>
      </div>
    </div>
  );
}
