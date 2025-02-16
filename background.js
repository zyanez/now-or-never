import {
    startPomodoroCycle,
    stopPomodoroCycle,
    resetPomodoroCycle,
    getPomodoroState,
} from "./background/pomodoroManager.js";
import {
    clearOverlayAndResetStyles,
    applyWillOverlay,
} from "./background/overlayManager.js";
import { isDistractingDomain } from "./background/domainChecker.js";
import { autoFocusTasks } from "./background/autoFocusManager.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getPomodoroState") {
        sendResponse(getPomodoroState());
    } else if (message.action === "createFiveMinuteTimer") {
        //
    } else if (message.action === "backToFocus") {
        autoFocusTasks();
        clearOverlayAndResetStyles();
    } else if (message.action === "startPomodoro") {
        startPomodoroCycle();
    } else if (message.action === "stopPomodoro") {
        stopPomodoroCycle();
    } else if (message.action === "resetPomodoro") {
        resetPomodoroCycle();
    }
});

chrome.webNavigation.onCompleted.addListener((details) => {
    chrome.storage.local.get(["temporaryAccess"], (result) => {
        const pomodoroState = getPomodoroState();
        if (pomodoroState.enabled && pomodoroState.mode === "focus") {
            const temporaryAccess = result.temporaryAccess;
            const currentTime = Date.now();
            if (
                !temporaryAccess ||
                temporaryAccess.url !== details.url ||
                temporaryAccess.expiresAt < currentTime
            ) {
                chrome.tabs.get(details.tabId, (tab) => {
                    if (chrome.runtime.lastError || !tab.url) return;
                    const currentHostname = new URL(tab.url).hostname;
                    if (isDistractingDomain(currentHostname)) {
                        chrome.scripting.executeScript({
                            target: { tabId: details.tabId },
                            function: applyWillOverlay,
                        });
                    }
                });
            }
        }
    });
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        pomodoroEnabled: false,
        focusModeEnabled: false,
        temporaryAccess: null,
    });
});
