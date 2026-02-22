import { getStorage, ref, deleteObject } from 'firebase/storage';
import type { MediaAttachment } from '../types';

const CLOUDINARY_CLOUD_NAME = 'daml9cbnj';
const CLOUDINARY_UPLOAD_PRESET = 'y4oxnjmo';

const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm'
];
const MAX_SIZE_MB = 50;

/**
 * Upload a File to Cloudinary via unsigned upload preset.
 * No backend needed — browser uploads directly to Cloudinary CDN.
 */
export async function uploadMedia(file: File, _uid?: string): Promise<MediaAttachment> {
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`不支持的文件类型：${file.type}。支持 JPG/PNG/GIF/WebP 图片和 MP4/WebM 视频。`);
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`文件过大（最大 ${MAX_SIZE_MB}MB）`);
    }

    const resourceType = file.type.startsWith('image/') ? 'image' : 'video';
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Cloudinary 上传失败：${err?.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    return {
        url: data.secure_url,
        type: resourceType,
        name: file.name,
    };
}

/**
 * Attempts to delete a media file based on its storage reference URL.
 * Currently, Cloudinary unsigned uploads cannot be deleted from the client directly,
 * so this is a placeholder or can handle Firebase Storage URLs if migrated.
 */
export async function deleteMedia(url: string): Promise<void> {
    try {
        if (!url.includes('firebasestorage.googleapis.com')) {
            console.log(`[Storage] Skipping delete for non-Firebase media: ${url}`);
            return;
        }

        const storage = getStorage();
        const fileRef = ref(storage, url);
        await deleteObject(fileRef);
    } catch (e) {
        console.warn(`[Firebase] Failed to delete media ${url}:`, e);
    }
}
