export interface MediaAttachment {
    url: string;       // Firebase Storage 下载链接（或本地 object URL）
    type: 'image' | 'video';
    name: string;      // 原始文件名
}

export interface TimelineEntry {
    id: string;
    content: string;
    timestamp: number;
    attachments?: MediaAttachment[];
}

export interface EventCategory {
    name: string;      // Internal sub-topic (e.g., '影视娱乐', '产品与方案')
    theme: 'cyber-blue' | 'sunset-orange';
}

/** AI 分析出的情绪基调 */
export type MoodType =
    | 'happy'       // 开心/喜悦
    | 'focused'     // 专注/工作中
    | 'excited'     // 兴奋/激动
    | 'calm'        // 平静/放松
    | 'tired'       // 疲惫/累
    | 'playful'     // 俏皮/玩耍
    | 'proud'       // 自豪/满足
    | 'curious'     // 好奇/探索
    | 'cozy'        // 慵懒/舒适
    | 'adventurous'; // 冒险/旅行

/** 头像动画状态 */
export type AvatarStatus = 'idle' | 'summarizing' | 'telling';

export interface EventThread {
    id: string;
    title: string;           // AI-generated summary of this event
    category: EventCategory;
    tags: string[];          // AI-extracted keyword tags (max 5)
    entries: TimelineEntry[]; // Chronological list of moments
    lastUpdatedAt: number;   // Used for sorting cards
    mood?: MoodType;         // AI-detected emotional tone
    avatarVariant?: number;  // 0–49, determines decoration set
    embedding?: number[];    // Semantic vector embedding for search
}

export interface DeepMemoryCard {
    id: string;
    time: string;
    coreSummary: string;
    poeticInterpretation: string;
    originalRecord: string;
    emotionalFeedback: string;
    bgMediaUrl?: string;
    bgMediaType?: 'image' | 'video';
}

export interface EndOfDayTask {
    id: string;
    content: string;
    isCompleted: boolean;
}

export interface DailyMemoryData {
    dateStr: string;        // Friendly date display
    weather: string;        // AI inferred or real-time weather description
    poeticMessage: string;  // Poetic message to be enclosed in quotes
    summary: string;        // One-line summary of all moments today
    deepMemories: DeepMemoryCard[]; // Part 2
    tasks: EndOfDayTask[];          // Part 4
}
