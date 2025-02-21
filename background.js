import {
    startPomodoroCycle,
    stopPomodoroCycle,
    resetPomodoroCycle,
    getPomodoroState,
} from "./background/pomodoroManager.js";
import { applyWillOverlay } from "./background/overlayManager.js";
import { isDistractingDomain } from "./background/domainChecker.js";
import { autoFocusTasks } from "./background/autoFocusManager.js";
import thresholdMessages from "./messages.js";

const storage = {
    get: (keys) =>
        new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
    set: (data) =>
        new Promise((resolve) => chrome.storage.local.set(data, resolve)),
};

let cachedSiteTimers = {};
let flushTimer = null;
let distractingStartTime = null;
let currentDistractingUrl = null;

const FLUSH_DELAY = 1000;
const CHECK_INTERVAL = 0.1;

const isInternalURL = (url) =>
    url.startsWith("chrome://") || url === "about:newtab";

const getHostname = (url) => {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
};

const flushSiteTimers = () => {
    storage
        .set({ siteTimers: cachedSiteTimers })
        .catch((error) => console.error("Error updating timers:", error));
    flushTimer = null;
};

const scheduleFlush = () => {
    if (!flushTimer) flushTimer = setTimeout(flushSiteTimers, FLUSH_DELAY);
};

const updateSiteTimers = async (hostname, elapsed) => {
    if (!hostname) return;

    cachedSiteTimers[hostname] = (cachedSiteTimers[hostname] || 0) + elapsed;
    scheduleFlush();

    const thresholds = Object.keys(thresholdMessages)
        .map(Number)
        .sort((a, b) => b - a);

    for (const threshold of thresholds) {
        const thresholdMs = threshold * 60 * 1000;
        const notificationKey = `${hostname}_notified_${threshold}`;

        if (
            cachedSiteTimers[hostname] >= thresholdMs &&
            !cachedSiteTimers[notificationKey]
        ) {
            const messages = thresholdMessages[threshold];
            if (messages?.length) {
                const message =
                    messages[Math.floor(Math.random() * messages.length)];
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: "icons/icon128.png",
                    title: "Procastination Alert",
                    message,
                    priority: 2,
                });
                cachedSiteTimers[notificationKey] = true;
                scheduleFlush();
            }
            break;
        }
    }
};

const handleNavigation = async ({ tabId, url }) => {
    if (isInternalURL(url)) return;

    const [pomodoroState, { temporaryAccess }] = await Promise.all([
        getPomodoroState(),
        storage.get("temporaryAccess"),
    ]);

    if (!pomodoroState.enabled || pomodoroState.mode !== "focus") return;

    const isValidAccess =
        temporaryAccess?.url === url &&
        temporaryAccess?.expiresAt >= Date.now();

    if (!isValidAccess) {
        const tab = await new Promise((resolve) =>
            chrome.tabs.get(tabId, resolve)
        );
        const hostname = getHostname(tab?.url);

        if (hostname && isDistractingDomain(tab.url)) {
            chrome.scripting.executeScript({
                target: { tabId },
                function: applyWillOverlay,
            });
        }
    }
};

const handleAlarm = async (alarm) => {
    if (alarm.name !== "distractingTimeCheck") return;

    const { antiProcrastinationEnabled } = await storage.get(
        "antiProcrastinationEnabled"
    );
    if (!antiProcrastinationEnabled) {
        distractingStartTime = null;
        currentDistractingUrl = null;
        return;
    }

    const [tab] = await new Promise((resolve) =>
        chrome.tabs.query({ active: true, currentWindow: true }, resolve)
    );

    const hostname = getHostname(tab?.url);
    if (!hostname || isInternalURL(tab.url)) {
        distractingStartTime = null;
        currentDistractingUrl = null;
        return;
    }

    const now = Date.now();
    const isDistracting = isDistractingDomain(tab.url);

    if (isDistracting) {
        if (currentDistractingUrl !== hostname) {
            if (currentDistractingUrl) {
                await updateSiteTimers(
                    currentDistractingUrl,
                    now - distractingStartTime
                );
            }
            currentDistractingUrl = hostname;
            distractingStartTime = now;
        }
        await updateSiteTimers(hostname, now - distractingStartTime);
        distractingStartTime = now;
    } else if (currentDistractingUrl) {
        delete cachedSiteTimers[currentDistractingUrl];
        currentDistractingUrl = null;
        distractingStartTime = null;
        scheduleFlush();
    }
};

const messageHandlers = {
    getPomodoroState: () => getPomodoroState(),
    createFiveMinuteTimer: ({ url }) => {
        const alarmName = `fiveMinTimer_${Date.now()}`;
        chrome.alarms.create(alarmName, { delayInMinutes: 5 });
        return storage.set({ [alarmName]: url });
    },
    backToFocus: autoFocusTasks,
    toggleAntiProcastination: ({ enabled }) =>
        storage.set({ antiProcrastinationEnabled: enable }),
    startPomodoro: startPomodoroCycle,
    stopPomodoro: stopPomodoroCycle,
    resetPomodoro: resetPomodoroCycle,
};

chrome.runtime.onInstalled.addListener(() => {
    storage.set({
        pomodoroEnabled: false,
        antiProcrastinationEnabled: false,
        temporaryAccess: null,
        siteTimers: {}
    });
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    const handler = messageHandlers[message.action];
    if (handler){
        Promise.resolve(handler(message))
            .then(sendResponse)
            .catch(console.error);
        return true;
    }
});

chrome.webNavigation.onCompleted.addListener(handleNavigation);
chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.alarms.create("distractingTimeCheck", { periodInMinutes: CHECK_INTERVAL });