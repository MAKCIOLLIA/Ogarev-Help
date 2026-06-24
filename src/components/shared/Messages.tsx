import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, User as UserIcon, Search, Plus, X, Camera } from 'lucide-react';
import { UserRole } from '../../types';
import { getAvatarUrl } from '../../lib/utils';
import Avatar from './Avatar';

interface Contact {
  id: string;
  full_name: string;
  role: UserRole;
  unread_count: number;
  profile_photo_path: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface SearchResult {
  id: string;
  full_name: string;
  role: UserRole;
  profile_photo_path: string | null;
}

interface UserProfile {
  full_name: string;
  bio: string | null;
  profile_photo_path: string | null;
  role: UserRole;
  specializations: string[] | null;
  grade_average: number | null;
  average_rating: number | null;
  video_greeting: string | null;
}

export default function Messages() {
  const { user, token, refreshUnreadCounts } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [hoveredContact, setHoveredContact] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [prevScrollHeight, setPrevScrollHeight] = useState<number>(0);
  const ITEMS_PER_PAGE = 15;
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (prevScrollHeight && chatContainerRef.current) {
      const newScrollHeight = chatContainerRef.current.scrollHeight;
      const heightDifference = newScrollHeight - prevScrollHeight;
      if (heightDifference > 0) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollTop + heightDifference;
      }
      setPrevScrollHeight(0);
    }
  }, [messages, prevScrollHeight]);

  const loadContacts = useCallback(async () => {
    if (!token) return;

    const { data, error } = await supabase.rpc('get_contacts', { p_token: token });
    if (error) {
      console.error('get_contacts error:', error);
      return;
    }
    if (data) setContacts(data as Contact[]);
  }, [token]);

  const loadMessages = useCallback(async (isInitial = true, shouldClear = true, isSilent = false) => {
    if (!selectedContact || !token) return;

    if (isInitial && shouldClear) {
      setMessages([]);
      setHasMoreMessages(true);
    }
    
    if (!isSilent) setIsLoadingMore(true);
    const offset = isInitial ? 0 : messagesRef.current.length;

    console.log(`Messages: Loading messages for ${selectedContact.full_name}, initial: ${isInitial}, offset: ${offset}, silent: ${isSilent}`);

    const { data, error } = await supabase.rpc('get_messages', {
      p_token: token,
      p_contact_id: selectedContact.id,
      p_limit: ITEMS_PER_PAGE,
      p_offset: offset
    });

    if (error) {
      console.error('get_messages error:', error);
      if (!isSilent) setIsLoadingMore(false);
      return;
    }

    if (data) {
      const fetchedMessages = (data as Message[]).reverse();
      console.log(`Messages: Fetched ${fetchedMessages.length} messages`);
      
      if (isInitial) {
        setMessages(fetchedMessages);
        if (shouldClear) {
          // Скроллим вниз только при полной смене чата
          setTimeout(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
            }
          }, 100);
        }
      } else {
        if (chatContainerRef.current) {
          setPrevScrollHeight(chatContainerRef.current.scrollHeight);
        }
        setMessages(prev => [...fetchedMessages, ...prev]);
      }
      setHasMoreMessages(fetchedMessages.length === ITEMS_PER_PAGE);
      refreshUnreadCounts();
    }
    if (!isSilent) setIsLoadingMore(false);
  }, [selectedContact, token, refreshUnreadCounts]);

  useEffect(() => {
    loadContacts();
    if (selectedContact) {
      loadMessages(true, true);
    }
    
    const handleSync = () => {
      console.log('Messages: sync-data event received');
      
      // Обновляем список контактов в любом случае
      loadContacts();
      if (selectedContact) {
        loadMessages(true, false, true); // Обновляем текущий чат без очистки и тихо
      }
    };

    window.addEventListener('sync-data', handleSync);
    return () => window.removeEventListener('sync-data', handleSync);
  }, [token, loadContacts, selectedContact, loadMessages]);


  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    // Загружаем раньше, чем пользователь дойдет до самого верха (порог 200px)
    if (scrollTop < 200 && hasMoreMessages && !isLoadingMore) {
      loadMessages(false);
    }
  };

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  const loadUserProfile = async (userId: string) => {
    if (!token) return;
    const { data, error } = await supabase.rpc('get_user_public_profile', {
      p_token: token,
      p_user_id: userId,
    });
    if (error) {
      console.error('get_user_public_profile error:', error);
      return;
    }
    if (data && data.length > 0) {
      setUserProfile(data[0] as UserProfile);
      setProfileModalOpen(true);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || !token) {
      setSearchResults([]);
      return;
    }

    const { data, error } = await supabase.rpc('search_users_for_chat', {
      p_token: token,
      p_query: query,
    });

    if (error) {
      console.error('search_users_for_chat error:', error);
      return;
    }

    setSearchResults(data as SearchResult[]);
  };

  const startNewChat = (userToChat: SearchResult) => {
    const newContact: Contact = {
      id: userToChat.id,
      full_name: userToChat.full_name,
      role: userToChat.role,
      unread_count: 0,
      profile_photo_path: userToChat.profile_photo_path,
    };

    setContacts((prev) => {
      if (prev.find((c) => c.id === userToChat.id)) return prev;
      return [newContact, ...prev];
    });

    setSelectedContact(newContact);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !token || !user) return;
    
    const content = newMessage.trim();
    setNewMessage('');

    const { data: sentMessageInfo, error } = await supabase.rpc('send_message', {
      p_token: token,
      p_contact_id: selectedContact.id,
      p_content: content,
    });

    if (error) {
      console.error('send_message error:', error);
      setNewMessage(content);
      return;
    }

    if (sentMessageInfo && sentMessageInfo.length > 0) {
      const newMsg: Message = {
        id: sentMessageInfo[0].id,
        created_at: sentMessageInfo[0].created_at,
        content: content,
        sender_id: user.id,
        receiver_id: selectedContact.id,
        read: false
      };
      setMessages(prev => [...prev, newMsg]);
      // Всегда скроллим вниз при отправке своего сообщения
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    
    await loadContacts();
  };

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      student: 'Репетитор',
      parent: 'Родитель',
      child: 'Школьник',
      admin: 'Администратор',
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      student: 'bg-purple-100 text-purple-800',
      parent: 'bg-green-100 text-green-800',
      child: 'bg-blue-100 text-blue-800',
      admin: 'bg-red-100 text-red-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Сообщения</h1>
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Новый чат
        </button>
      </div>

      {isProfileModalOpen && userProfile && (
        <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{userProfile.full_name}</h2>
                <span className={`mt-1 inline-block px-2 py-1 text-xs rounded-full ${getRoleColor(userProfile.role)}`}>
                  {getRoleLabel(userProfile.role)}
                </span>
              </div>
              <button onClick={() => setProfileModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col items-center">
                <Avatar imageUrl={getAvatarUrl(userProfile.profile_photo_path)} name={userProfile.full_name} size={96} />
                {userProfile.bio && (
                  <p className="mt-4 text-center text-gray-600">{userProfile.bio}</p>
                )}
              </div>

              {userProfile.role === 'student' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-800">Специализации</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {userProfile.specializations?.map((spec, index) => (
                        <span key={index} className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">Средний балл</h3>
                      <p className="text-gray-600">{userProfile.grade_average?.toFixed(2)}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Рейтинг</h3>
                      <p className="text-gray-600">{userProfile.average_rating?.toFixed(1)} / 5.0</p>
                    </div>
                  </div>
                  {userProfile.video_greeting && (
                    <div>
                      <h3 className="font-semibold text-gray-800">Видео-приветствие</h3>
                      <div className="mt-2 rounded-lg overflow-hidden max-w-md">
                        <video controls className="w-full">
                          <source
                            src={supabase.storage.from('Documents').getPublicUrl(userProfile.video_greeting).data.publicUrl}
                            type="video/mp4"
                          />
                          Ваш браузер не поддерживает видео.
                        </video>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t text-right">
              <button
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Найти пользователя</h2>
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                  placeholder="Введите имя пользователя..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {searchQuery && searchResults.length === 0 ? (
                <div className="p-4 text-center text-gray-500">Пользователи не найдены</div>
              ) : searchResults.length > 0 ? (
                <>
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => startNewChat(u)}
                      className="p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar imageUrl={getAvatarUrl(u.profile_photo_path)} name={u.full_name} size={40} />
                          <h3 className="font-semibold text-gray-900">{u.full_name}</h3>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getRoleColor(u.role)}`}>
                          {getRoleLabel(u.role)}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="p-4 text-center text-gray-400 text-sm">
                  Введите имя для поиска
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden flex h-[600px]">
        {/* Список контактов */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900">Контакты</h2>
            <p className="text-xs text-gray-500 mt-1">
              {contacts.length === 0 ? 'Начните новый чат' : `${contacts.length} контактов`}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <div className="p-8 text-center">
                <Camera className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-500 mb-2">Нет сообщений</p>
                <p className="text-sm text-gray-400">Начните новый чат, чтобы общаться с другими пользователями</p>
              </div>
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.id}
                  onMouseEnter={() => setHoveredContact(contact.id)}
                  onMouseLeave={() => setHoveredContact(null)}
                  onClick={() => setSelectedContact(contact)}
                  className={`p-4 border-b cursor-pointer transition-colors relative ${
                    selectedContact?.id === contact.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar imageUrl={getAvatarUrl(contact.profile_photo_path)} name={contact.full_name} size={48} />
                      {contact.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {contact.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 truncate">{contact.full_name}</h3>
                        {hoveredContact === contact.id && (
                          <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getRoleColor(contact.role)}`}>
                            {getRoleLabel(contact.role)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Область чата */}
        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              <div
                className="p-4 border-b bg-gray-50 flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => loadUserProfile(selectedContact.id)}
              >
                <Avatar imageUrl={getAvatarUrl(selectedContact.profile_photo_path)} name={selectedContact.full_name} size={48} />
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedContact.full_name}</h2>
                  <span className={`mt-1 inline-block px-2 py-1 text-xs rounded-full ${getRoleColor(selectedContact.role)}`}>
                    {getRoleLabel(selectedContact.role)}
                  </span>
                </div>
              </div>

              <div 
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{ overflowAnchor: 'none' }}
              >
                {isLoadingMore && (
                  <div className="text-center py-2 text-sm text-gray-500">
                    Загрузка...
                  </div>
                )}
                {messages.length === 0 && !isLoadingMore ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <UserIcon className="mb-3 text-gray-300" size={48} />
                    <p className="mb-1">Начните диалог</p>
                    <p className="text-sm text-gray-400">Напишите первое сообщение {selectedContact.full_name}</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.sender_id === user?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(message.created_at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Введите сообщение..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
              <UserIcon className="mb-4 text-gray-300" size={64} />
              <h3 className="text-lg font-medium mb-2">Выберите чат</h3>
              <p className="text-gray-400 text-center">
                Выберите существующий контакт или начните новый чат
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
