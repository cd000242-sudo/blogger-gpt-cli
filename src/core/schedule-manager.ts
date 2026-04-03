// src/core/schedule-manager.ts
// 스케줄 관리 및 예약 상태 확인 시스템

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface ScheduledPost {
  id: string;
  topic: string;
  keywords: string[];
  platform: 'blogger' | 'wordpress';
  publishType: 'draft' | 'now' | 'schedule';
  scheduleDateTime: string; // ISO string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  payload: any; // 전체 포스팅 페이로드
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
}

export interface ScheduleStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export class ScheduleManager {
  private scheduleFilePath: string;
  private scheduleData: ScheduledPost[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Electron 앱의 userData 디렉토리에 스케줄 파일 저장
    const userDataPath = app.getPath('userData');
    this.scheduleFilePath = path.join(userDataPath, 'scheduled-posts.json');
    this.loadScheduleData();
  }

  // 스케줄 데이터 로드
  private loadScheduleData(): void {
    try {
      if (fs.existsSync(this.scheduleFilePath)) {
        const data = fs.readFileSync(this.scheduleFilePath, 'utf8');
        this.scheduleData = JSON.parse(data);
        console.log(`📅 스케줄 데이터 로드됨: ${this.scheduleData.length}개 항목`);
      } else {
        this.scheduleData = [];
        this.saveScheduleData();
        console.log('📅 새로운 스케줄 파일 생성됨');
      }
    } catch (error) {
      console.error('❌ 스케줄 데이터 로드 실패:', error);
      this.scheduleData = [];
    }
  }

  // 스케줄 데이터 저장
  private saveScheduleData(): void {
    try {
      fs.writeFileSync(this.scheduleFilePath, JSON.stringify(this.scheduleData, null, 2));
      console.log(`💾 스케줄 데이터 저장됨: ${this.scheduleData.length}개 항목`);
    } catch (error) {
      console.error('❌ 스케줄 데이터 저장 실패:', error);
    }
  }

  // 새 스케줄 추가
  addSchedule(post: Omit<ScheduledPost, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'retryCount'>): string {
    const id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const scheduledPost: ScheduledPost = {
      ...post,
      id,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3
    };

    this.scheduleData.push(scheduledPost);
    this.saveScheduleData();
    
    console.log(`✅ 새 스케줄 추가됨: ${id} - ${post.topic}`);
    return id;
  }

  // 스케줄 업데이트
  updateSchedule(id: string, updates: Partial<ScheduledPost>): boolean {
    const index = this.scheduleData.findIndex(post => post.id === id);
    if (index === -1) {
      console.error(`❌ 스케줄을 찾을 수 없음: ${id}`);
      return false;
    }

    const filteredUpdates: Partial<ScheduledPost> = {};
    for (const key in updates) {
      if (key in updates && updates[key as keyof ScheduledPost] !== undefined) {
        const value = updates[key as keyof ScheduledPost];
        if (value !== undefined) {
          (filteredUpdates as any)[key] = value;
        }
      }
    }
    const existingPost = this.scheduleData[index];
    if (existingPost) {
      this.scheduleData[index] = {
        ...existingPost,
        ...filteredUpdates,
        updatedAt: new Date().toISOString()
      };
    }
    
    this.saveScheduleData();
    console.log(`🔄 스케줄 업데이트됨: ${id}`);
    return true;
  }

  // 스케줄 삭제
  deleteSchedule(id: string): boolean {
    const index = this.scheduleData.findIndex(post => post.id === id);
    if (index === -1) {
      console.error(`❌ 스케줄을 찾을 수 없음: ${id}`);
      return false;
    }

    const deletedPost = this.scheduleData.splice(index, 1)[0];
    this.saveScheduleData();
    if (deletedPost) {
      console.log(`🗑️ 스케줄 삭제됨: ${id} - ${deletedPost.topic}`);
    }
    return true;
  }

  // 스케줄 조회
  getSchedule(id: string): ScheduledPost | null {
    return this.scheduleData.find(post => post.id === id) || null;
  }

  // 모든 스케줄 조회
  getAllSchedules(): ScheduledPost[] {
    return [...this.scheduleData];
  }

  // 상태별 스케줄 조회
  getSchedulesByStatus(status: ScheduledPost['status']): ScheduledPost[] {
    return this.scheduleData.filter(post => post.status === status);
  }

  // 예약된 포스트 조회 (현재 시간 기준)
  getPendingSchedules(): ScheduledPost[] {
    const now = new Date();
    return this.scheduleData.filter(post => {
      const scheduleTime = new Date(post.scheduleDateTime);
      return post.status === 'pending' && scheduleTime <= now;
    });
  }

  // 스케줄 통계 조회
  getScheduleStats(): ScheduleStats {
    const stats: ScheduleStats = {
      total: this.scheduleData.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    this.scheduleData.forEach(post => {
      stats[post.status]++;
    });

    return stats;
  }

  // 스케줄 모니터링 시작
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('⚠️ 스케줄 모니터링이 이미 실행 중입니다');
      return;
    }

    this.isMonitoring = true;
    console.log('🔄 스케줄 모니터링 시작됨');

    // 30초마다 예약된 포스트 확인
    this.monitoringInterval = setInterval(() => {
      this.checkPendingSchedules();
    }, 30000);

    // 즉시 한 번 실행
    this.checkPendingSchedules();
  }

  // 스케줄 모니터링 중지
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('⚠️ 스케줄 모니터링이 실행 중이 아닙니다');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('⏹️ 스케줄 모니터링 중지됨');
  }

  // 예약된 포스트 확인 및 처리
  private async checkPendingSchedules(): Promise<void> {
    const pendingSchedules = this.getPendingSchedules();
    
    if (pendingSchedules.length === 0) {
      return;
    }

    console.log(`🔍 예약된 포스트 확인: ${pendingSchedules.length}개 발견`);

    for (const schedule of pendingSchedules) {
      try {
        await this.processScheduledPost(schedule);
      } catch (error) {
        console.error(`❌ 스케줄 처리 실패: ${schedule.id}`, error);
        this.updateSchedule(schedule.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }
  }

  // 예약된 포스트 처리
  private async processScheduledPost(schedule: ScheduledPost): Promise<void> {
    console.log(`🚀 예약된 포스트 처리 시작: ${schedule.id} - ${schedule.topic}`);
    
    // 상태를 processing으로 변경
    this.updateSchedule(schedule.id, { status: 'processing' });

    try {
      // 포스팅 로직 실행
      const { runPost } = await import('./index');
      
      const result = await runPost(schedule.payload);
      
      if (result.ok) {
        const updates: Partial<ScheduledPost> = { status: 'completed' };
        // errorMessage가 있으면 제거하기 위해 명시적으로 설정하지 않음
        this.updateSchedule(schedule.id, updates);
        console.log(`✅ 예약된 포스트 처리 완료: ${schedule.id}`);
      } else {
        throw new Error(result.error || '포스팅 실패');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      const retryCount = schedule.retryCount + 1;
      
      if (retryCount < schedule.maxRetries) {
        // 재시도 가능
        this.updateSchedule(schedule.id, {
          status: 'pending',
          retryCount,
          errorMessage: `${errorMessage} (재시도 ${retryCount}/${schedule.maxRetries})`
        });
        console.log(`🔄 재시도 예약: ${schedule.id} (${retryCount}/${schedule.maxRetries})`);
      } else {
        // 최대 재시도 횟수 초과
        this.updateSchedule(schedule.id, {
          status: 'failed',
          retryCount,
          errorMessage: `${errorMessage} (최대 재시도 횟수 초과)`
        });
        console.log(`❌ 최종 실패: ${schedule.id}`);
      }
    }
  }

  // 스케줄 상태 확인 (UI용)
  getScheduleStatus(): {
    isMonitoring: boolean;
    stats: ScheduleStats;
    nextSchedule: ScheduledPost | null;
    recentActivity: ScheduledPost[];
  } {
    const stats = this.getScheduleStats();
    const pendingSchedules = this.getSchedulesByStatus('pending');
    const nextSchedule: ScheduledPost | null = pendingSchedules.length > 0 
      ? pendingSchedules.sort((a, b) => new Date(a.scheduleDateTime).getTime() - new Date(b.scheduleDateTime).getTime())[0] || null
      : null;
    
    const recentActivity = this.scheduleData
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    return {
      isMonitoring: this.isMonitoring,
      stats,
      nextSchedule,
      recentActivity
    };
  }

  // 스케줄 정리 (오래된 완료/실패된 스케줄 삭제)
  cleanupOldSchedules(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const initialCount = this.scheduleData.length;
    this.scheduleData = this.scheduleData.filter(post => {
      const createdAt = new Date(post.createdAt);
      const isOld = createdAt < cutoffDate;
      const isCompletedOrFailed = post.status === 'completed' || post.status === 'failed';
      
      return !(isOld && isCompletedOrFailed);
    });
    
    const deletedCount = initialCount - this.scheduleData.length;
    if (deletedCount > 0) {
      this.saveScheduleData();
      console.log(`🧹 오래된 스케줄 정리됨: ${deletedCount}개 삭제`);
    }
    
    return deletedCount;
  }
}

// 싱글톤 인스턴스
let scheduleManagerInstance: ScheduleManager | null = null;

export function getScheduleManager(): ScheduleManager {
  if (!scheduleManagerInstance) {
    scheduleManagerInstance = new ScheduleManager();
  }
  return scheduleManagerInstance;
}
