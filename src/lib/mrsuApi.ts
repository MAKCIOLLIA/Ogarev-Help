import { supabase } from './supabase';
import { calculateGrade } from './utils';

export interface AcademicRecord {
  discipline: string;
  score: number;
  grade: number;
  semester: string;
}

export interface UniVerificationResult {
  records: AcademicRecord[];
  averageGrade: string;
}

interface StudentSemester {
  Year: string;
  Number?: number;
  Name: string;
  Period?: number;
}

interface RecordBook {
  Number: string;
  Disciplines: {
    Id: string;
    Title?: string;
    DisciplineName?: string;
  }[];
}

interface RatingPlanSection {
  SectionType: number;
  ControlDots: {
    Mark: {
      Ball: number;
    } | null;
  }[];
}

interface RatingPlan {
  Sections: RatingPlanSection[];
}

export const mrsuApi = {
  async getToken(username: string, password: string): Promise<string> {
    console.log('[MRSU API] Requesting token for:', username);
    const { data, error } = await supabase.rpc('mrus_proxy_get_token', {
      p_username: username,
      p_password: password
    });

    if (error || !data || data.error) {
      console.error('[MRSU API] Token error:', error || data?.message);
      throw new Error(data?.message || 'Ошибка авторизации через прокси');
    }

    console.log('[MRSU API] Token received successfully');
    return data.access_token;
  },

  /**
   * Получение данных через прокси GET
   */
  async fetchProxy<T = unknown>(url: string, token: string): Promise<T> {
    const { data, error } = await supabase.rpc('mrus_proxy_get', {
      p_url: url,
      p_token: token
    });

    if (error) {
      console.error(`[MRSU API] Fetch error for ${url}:`, error);
      throw error;
    }

    return data as T;
  },

  /**
   * Основная функция верификации студента
   */
  async verifyStudent(username: string, password: string, onProgress?: (msg: string) => void): Promise<UniVerificationResult> {
    try {
      const token = await this.getToken(username, password);

      // 1. Получаем текущий контекст
      if (onProgress) onProgress('Определение текущего семестра...');
      const currentSem = await this.fetchProxy<StudentSemester>('v1/StudentSemester?selector=current', token);
      
      const currentYearStart = parseInt(currentSem.Year?.split('-')[0] || '0');
      const currentNum = currentSem.Number || parseInt(currentSem.Name) || 0;

      // 2. Получаем все семестры
      if (onProgress) onProgress('Загрузка истории семестров...');
      const allSemesters = await this.fetchProxy<StudentSemester[]>('v1/StudentSemester', token);
      
      // Сортировка и фильтрация
      const sortedSemesters = [...allSemesters].sort((a, b) => {
        const aYear = parseInt(a.Year?.split('-')[0] || '0');
        const bYear = parseInt(b.Year?.split('-')[0] || '0');
        if (aYear !== bYear) return aYear - bYear;
        return (a.Period || 0) - (b.Period || 0);
      });

      const pastSemesters = sortedSemesters.filter((s) => {
        const sYearStart = parseInt(s.Year?.split('-')[0] || '0');
        const sPeriod = s.Period || s.Number || parseInt(s.Name) || 0;
        
        if (sYearStart < currentYearStart) return true;
        if (sYearStart === currentYearStart && sPeriod < currentNum) return true;
        return false;
      });

      if (pastSemesters.length === 0) {
        throw new Error('Не найдено завершенных семестров для анализа');
      }

      // 3. Определяем основную зачетку по самому раннему семестру
      if (onProgress) onProgress('Определение номера зачетной книжки...');
      const earliestSem = pastSemesters[0];
      const earliestData = await this.fetchProxy<{ RecordBooks: RecordBook[] }>(
        `v1/StudentSemester?year=${encodeURIComponent(earliestSem.Year)}&period=${earliestSem.Period || earliestSem.Number || parseInt(earliestSem.Name)}`, 
        token
      );

      if (!earliestData.RecordBooks || earliestData.RecordBooks.length === 0) {
        throw new Error('Данные о зачетных книжках не найдены');
      }

      const primaryRecordBookNumber = earliestData.RecordBooks[0].Number;

      // 4. Собираем дисциплины и баллы
      const records: AcademicRecord[] = [];
      let semCount = 0;

      for (const s of pastSemesters) {
        semCount++;
        const periodNum = s.Period || s.Number || parseInt(s.Name);
        if (onProgress) onProgress(`Обработка семестра ${semCount}/${pastSemesters.length}: ${s.Year}...`);

        const semData = await this.fetchProxy<{ RecordBooks: RecordBook[] }>(
          `v1/StudentSemester?year=${encodeURIComponent(s.Year)}&period=${periodNum}`, 
          token
        );

        const recordBook = semData.RecordBooks.find((rb) => rb.Number === primaryRecordBookNumber) || semData.RecordBooks[0];
        const disciplines = recordBook.Disciplines || [];

        for (const info of disciplines) {
          try {
            const plan = await this.fetchProxy<RatingPlan>(`v2/StudentRatingPlan/${info.Id}`, token);
            
            let totalScore = 0;
            let isExam = false;

            if (plan.Sections && Array.isArray(plan.Sections)) {
              plan.Sections.forEach((section) => {
                if (section.SectionType === 30) {
                  isExam = true;
                }

                if (section.SectionType !== 40) {
                  if (section.ControlDots && Array.isArray(section.ControlDots)) {
                    section.ControlDots.forEach((dot) => {
                      if (dot.Mark && typeof dot.Mark.Ball === 'number') {
                        totalScore += dot.Mark.Ball;
                      }
                    });
                  }
                }
              });
            }

            const finalScore = Math.min(Math.ceil(totalScore), 100);
            const finalGrade = calculateGrade(finalScore);
            // Фильтрация: 
            // 1. Только экзамены (есть секция с типом 30)
            // 2. Только оценки выше двойки
            if (isExam && finalGrade > 2) {
              records.push({
                discipline: info.Title || info.DisciplineName || 'Без названия',
                score: finalScore,
                grade: finalGrade,
                semester: `${s.Year} (Сем. ${periodNum})`
              });
            }
          } catch (e) {
            console.warn(`[MRSU API] Skip discipline ${info.Id} due to error`, e);
          }
        }
      }

      if (records.length === 0) {
        throw new Error('В завершенных семестрах не найдено дисциплин с формой контроля "Экзамен"');
      }

      const sum = records.reduce((acc, r) => acc + r.grade, 0);
      const avg = (sum / records.length).toFixed(2);

      console.log('[MRSU API] Final Results:', { records, avg });
      return { records, averageGrade: avg };

    } finally {
      console.groupEnd();
    }
  }
};
