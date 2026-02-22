import type { EventThread } from '../types';

const STORAGE_KEY = 'fluxmoment_threads_data';

export const store = {
    getThreads: (): EventThread[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                return JSON.parse(data) as EventThread[];
            }
        } catch (e) {
            console.error('Failed to parse threads from localStorage', e);
        }
        return [];
    },

    saveThreads: (threads: EventThread[]) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    }
};
