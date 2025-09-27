// src/app/settings/actions.ts
"use server";

import type { ConvertMp4ToGifOptions } from "@/lib/convertVideoToGif";

export type CommunitySettings = {
    // App Base URL
    appBaseUrl: string;

    // Point Requirements
    raidTrainRequiredPoints: number; 
    raidTrainEmergencyRequiredPoints: number;
    raidTrainBonusSlotsRequiredPoints: number;

    // Point Awards
    raidTrainPoints: number;
    captainLogPoints: number;
    raidParticipationPoints: number;
    newFollowerPoints: number;
    subscriptionPoints: number;
    cheerPointsPerBit: number;
    hypeTrainContributionPoints: number;

    // Raid Train Rules
    raidTrainBaseSlots: number;
    raidTrainBonusSlots: number;
    raidTrainAllowEmergencyWithSlot: boolean;
    useAttendanceForRaidTrain: boolean;

    // Clip Conversion Settings
    clipGifWidth: number;
    clipGifFps: number;
    clipGifLoop: number;
    clipGifMaxDurationSeconds: number;
};

export type Webhook = {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
};


export const defaultSettings: CommunitySettings = {
    // App Base URL
    appBaseUrl: "http://localhost:9002",

    // Point Requirements
    raidTrainRequiredPoints: 150,
    raidTrainEmergencyRequiredPoints: 0,
    raidTrainBonusSlotsRequiredPoints: 1000,
    
    // Point Awards
    raidTrainPoints: 25,
    captainLogPoints: 10,
    raidParticipationPoints: 5,
    newFollowerPoints: 5,
    subscriptionPoints: 50,
    cheerPointsPerBit: 1,
    hypeTrainContributionPoints: 10,

    // Raid Train Rules
    raidTrainBaseSlots: 1,
    raidTrainBonusSlots: 1,
    raidTrainAllowEmergencyWithSlot: false,
    useAttendanceForRaidTrain: false,

    // Clip Conversion Settings
    clipGifWidth: 480,
    clipGifFps: 15,
    clipGifLoop: 0,
    clipGifMaxDurationSeconds: 0,
};

// Saves the settings for a specific community.
export async function saveSettings(guildId: string, settings: Partial<CommunitySettings>) {
    if (!guildId) {
        return { success: false, error: "Community ID is required." };
    }
    try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const db = await getAdminDb();
        const settingsRef = db.collection('communities').doc(guildId).collection('settings').doc('points');
        await settingsRef.set(settings, { merge: true });
        return { success: true };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        return { success: false, error: errorMessage };
    }
}

// --- Webhook Management Actions ---

export async function addWebhook(guildId: string, name: string, url: string) {
    if (!guildId || !name || !url) {
        return { success: false, error: "Missing required fields." };
    }
    try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const db = await getAdminDb();
        const webhooksCollection = db.collection(`communities/${guildId}/webhooks`);
        await webhooksCollection.add({
            name,
            url,
            enabled: true,
        });
        return { success: true };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        return { success: false, error: errorMessage };
    }
}

export async function getWebhooks(guildId: string): Promise<Webhook[]> {
    if (!guildId) return [];
    try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const db = await getAdminDb();
        const snapshot = await db.collection(`communities/${guildId}/webhooks`).get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Webhook));
    } catch (e) {
        console.error("Error getting webhooks:", e);
        return [];
    }
}

export async function updateWebhookStatus(guildId: string, webhookId: string, enabled: boolean) {
    if (!guildId || !webhookId) {
        return { success: false, error: "Missing required fields." };
    }
    try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const db = await getAdminDb();
        await db.collection(`communities/${guildId}/webhooks`).doc(webhookId).update({ enabled });
        return { success: true };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        return { success: false, error: errorMessage };
    }
}

export async function deleteWebhook(guildId: string, webhookId: string) {
    if (!guildId || !webhookId) {
        return { success: false, error: "Missing required fields." };
    }
    try {
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const db = await getAdminDb();
        await db.collection(`communities/${guildId}/webhooks`).doc(webhookId).delete();
        return { success: true };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        return { success: false, error: errorMessage };
    }
}
