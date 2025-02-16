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
        const alarmName = `fiveMinTimer_${Date.now()}`;
        chrome.alarms.create(alarmName, { delayInMinutes: 5 });
        chrome.storage.local.set({ [alarmName]: message.url });
    } else if (message.action === "backToFocus") {
        autoFocusTasks();
    } else if (message.action === "toggleAntiProcrastination") {
        chrome.storage.local.set({
            antiProcrastinationEnabled: message.enabled,
        });
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
                    if (isDistractingDomain(tab.url)) {
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

chrome.alarms.create("progressCheck", { periodInMinutes: 5 });

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        pomodoroEnabled: false,
        antiProcrastinationEnabled: false,
        temporaryAccess: null,
        siteTimers: {},
    });
});

let distractingStartTime = null;
let currentDistractingUrl = null;
const thresholdMessages = {
    5: [
        "You've spent 5 minutes on this site. A quick pause might help refocus your energy.",
        "5 minutes in: consider a brief stretch to keep your mind sharp.",
        "At 5 minutes, it's a good time to evaluate if you're still on task.",
        "Five minutes passed: a reminder to check your priorities.",
        "5 minutes elapsed—time to ask, is this productive?",
        "After 5 minutes here, a short break might boost your productivity.",
        "Five minutes down, and it's a good moment for a micro-break.",
        "At 5 minutes, consider a quick refocus on your main goals.",
        "You've reached 5 minutes on this site. A glance at your agenda might be useful.",
        "5 minutes in: stay mindful of your time and objectives.",
        "After 5 minutes here, maybe take a deep breath and reassess.",
        "The 5-minute mark is a gentle reminder to check in with your progress.",
        "You've been here for 5 minutes. Is it aligned with your priorities?",
        "5 minutes spent here: a good moment for a short mental reset.",
        "At 5 minutes, consider whether a quick break could benefit you.",
        "5 minutes elapsed—take a moment to ensure you're on track.",
        "After 5 minutes on this site, a brief pause could help recalibrate your focus.",
        "The 5-minute mark is here; check if you're still moving toward your goals.",
        "5 minutes in: consider if this browsing supports your objectives.",
        "You've reached 5 minutes on this site; perhaps review your to-do list.",
    ],
    15: [
        "You've been on this site for 15 minutes. Consider a short break to rejuvenate your focus.",
        "15 minutes have passed—perhaps it's time to pause and realign your priorities.",
        "At 15 minutes, check if your current activity aligns with your key tasks.",
        "Fifteen minutes in: a brief break might help boost your productivity.",
        "15 minutes elapsed; consider stepping back for a moment to assess your progress.",
        "After 15 minutes, it might be useful to shift focus back to your work.",
        "15 minutes on this site—time to evaluate if you're still on track with your goals.",
        "Fifteen minutes have passed. A short break could be beneficial now.",
        "15 minutes in: consider taking a brief pause to refresh your mind.",
        "At the 15-minute mark, a quick check on your agenda might be helpful.",
        "15 minutes on this site may warrant a moment to review your priorities.",
        "After 15 minutes here, it might be time for a quick mental reset.",
        "15 minutes elapsed—ask yourself if this is the best use of your time.",
        "You've spent 15 minutes here; a short break might help you regain focus.",
        "Fifteen minutes in, and it might be a good moment to review your goals.",
        "After 15 minutes on this site, a brief pause could boost your efficiency.",
        "15 minutes have gone by—time to ask if you're still on task.",
        "At the 15-minute mark, consider whether it's time for a productive shift.",
        "Fifteen minutes on this site: a reminder to check your focus.",
        "15 minutes elapsed; consider a short break to maintain your momentum.",
    ],
    30: [
        "You've spent 30 minutes here. It might be time to refocus on your priorities.",
        "30 minutes in: consider re-evaluating if this is the best use of your time.",
        "After 30 minutes, a more substantial break might help you get back on track.",
        "Thirty minutes have passed—it's a good moment to assess your progress.",
        "At the 30-minute mark, it might be time to shift your attention back to your goals.",
        "30 minutes on this site may indicate it's time to return to work.",
        "After 30 minutes, consider refocusing on tasks that matter most.",
        "You've reached 30 minutes; it might be wise to redirect your energy to your responsibilities.",
        "Thirty minutes in, and it might be time for a serious productivity check.",
        "At 30 minutes, assess if this browsing is hindering your progress.",
        "30 minutes elapsed—time to refocus on what truly matters.",
        "After half an hour, it might be best to switch gears back to your work.",
        "Thirty minutes have passed; it's a good opportunity to re-establish your focus.",
        "At the 30-minute mark, consider a moment to review your agenda.",
        "30 minutes on this site—perhaps it's time to re-prioritize your tasks.",
        "After 30 minutes, a strong reminder to refocus on your goals is in order.",
        "30 minutes elapsed—ask if this activity is serving your priorities.",
        "You've spent 30 minutes here; consider taking a break to regain focus.",
        "At 30 minutes, reassess if your current browsing aligns with your objectives.",
        "Thirty minutes in, and it might be time to shift your focus back to work.",
    ],
    45: [
        "You've spent 45 minutes here. This prolonged session may be impacting your productivity—consider refocusing.",
        "After 45 minutes, it might be time to step away and realign with your primary objectives.",
        "At 45 minutes, consider if continuing this browsing is delaying your important tasks.",
        "Forty-five minutes in: it may be a good time to take a break and refocus on your responsibilities.",
        "45 minutes have passed; a brief shift back to work could improve your productivity.",
        "After 45 minutes on this site, a change of pace might be necessary.",
        "Forty-five minutes elapsed—assess if this activity is hindering your progress.",
        "45 minutes on this site may warrant a pause to re-evaluate your priorities.",
        "At the 45-minute mark, consider shifting your focus back to your core tasks.",
        "Forty-five minutes in—time to check if you're staying on track with your goals.",
        "After 45 minutes, a more productive break might be beneficial.",
        "45 minutes elapsed; it's a good moment to refocus on your responsibilities.",
        "At 45 minutes, ask yourself if this is the best use of your time.",
        "After 45 minutes on this site, it might be wise to return to your main work.",
        "Forty-five minutes in—consider taking a deliberate break to refocus.",
        "At 45 minutes, a pause might help realign your attention to your priorities.",
        "45 minutes have passed; perhaps it's time to re-establish your focus on work.",
        "After 45 minutes, consider that prolonged distraction may be costing you valuable time.",
        "At the 45-minute mark, a break to refocus on important tasks could be beneficial.",
        "Forty-five minutes here—time to ask if this is truly productive.",
    ],
    60: [
        "You've spent one hour on this site. This is a significant distraction—consider refocusing on your work.",
        "One hour in: it's a strong signal to redirect your attention to your priorities.",
        "After 60 minutes, prolonged browsing may be impacting your productivity. Time to get back to work.",
        "At the 60-minute mark, consider that an hour here might be too much—refocus on your goals.",
        "Sixty minutes have passed; it may be time for a serious productivity reset.",
        "One hour on this site indicates a substantial distraction—consider taking immediate action to refocus.",
        "After 60 minutes, it's a clear signal that it's time to return to your important tasks.",
        "At one hour, your productivity might be suffering. Consider switching your focus back to work.",
        "One hour elapsed—this is a critical moment to assess your time use and get back on track.",
        "Sixty minutes in may be too long; it's a prompt to redirect your attention to your core responsibilities.",
        "After one hour on this site, consider that your time might be better spent on your work.",
        "At the 60-minute mark, it might be wise to pause and reflect on your priorities.",
        "One hour of distraction is significant—consider refocusing on what truly matters.",
        "After 60 minutes, take a moment to reassess if this browsing aligns with your goals.",
        "At one hour, it's a clear reminder that prolonged distractions can hinder your productivity.",
        "One hour on this site—time to take decisive steps to return to your tasks.",
        "After 60 minutes, your work might be waiting—refocus on your primary objectives.",
        "At the 60-minute mark, consider that your time might be better invested in your goals.",
        "One hour of distraction is a strong signal—take a break and get back to what matters.",
        "After 60 minutes, it's critical to redirect your attention to your work for better productivity.",
    ],
    75: [
        "After 75 minutes, it's clear that prolonged distraction is taking a toll—consider taking immediate action.",
        "Seventy-five minutes on this site is a significant diversion; refocus on your primary objectives now.",
        "At 75 minutes, the time lost is considerable—step away and re-engage with your priorities.",
        "After 75 minutes, it may be time to seriously reconsider how you're spending your time.",
        "Seventy-five minutes of browsing indicates a critical need to redirect your focus to important tasks.",
    ],
    90: [
        "90 minutes in: this prolonged distraction is impacting your productivity—it's time to get back to work.",
        "After 90 minutes, you've lost a substantial amount of time; refocus on your main responsibilities immediately.",
        "At 90 minutes, consider that this session is severely impacting your progress—step back and reprioritize.",
        "Ninety minutes on this site is excessive; take a decisive break and return to your core tasks.",
        "After 90 minutes, the cost of distraction is high—focus on what truly matters.",
    ],
    105: [
        "105 minutes have passed—this is a critical threshold; immediate refocusing is needed.",
        "After 105 minutes, the impact on your productivity is undeniable—redirect your attention now.",
        "At 105 minutes, it's time to seriously assess your priorities and eliminate unnecessary distractions.",
        "One hour and 45 minutes on this site signals a major diversion—step away and reclaim your time.",
        "After 105 minutes, consider a decisive shift back to your important work.",
    ],
    120: [
        "2 hours on this site is a substantial loss of time—it's imperative to get back on track immediately.",
        "After 2 hours, the prolonged distraction is unsustainable—refocus on your critical tasks now.",
        "At 2 hours, the cost of distraction is severe—it's time for an immediate productivity reset.",
        "Two hours in: this extended session should prompt an urgent return to your priorities.",
        "After 120 minutes (2 hours), consider this a wake-up call to redirect your attention to what truly matters.",
    ],
};

function getRandomMessage(threshold) {
    const messages = thresholdMessages[threshold];
    if (messages && messages.length) {
        const index = Math.floor(Math.random() * messages.length);
        return messages[index];
    }
    return "";
}

function checkDistractingTime() {
    chrome.storage.local.get(
        ["antiProcrastinationEnabled", "siteTimers"],
        (data) => {
            if (!data.antiProcrastinationEnabled) {
                distractingStartTime = null;
                currentDistractingUrl = null;
                return;
            }

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || !tabs[0] || !tabs[0].url) {
                    distractingStartTime = null;
                    currentDistractingUrl = null;
                    return;
                }

                const tab = tabs[0];

                if (isDistractingDomain(tab.url)) {
                    const hostname = new URL(tab.url).hostname;

                    if (!currentDistractingUrl) {
                        currentDistractingUrl = hostname;
                        distractingStartTime = Date.now();
                    } else if (currentDistractingUrl !== hostname) {
                        const elapsed = Date.now() - distractingStartTime;
                        const siteTimers = data.siteTimers || {};
                        siteTimers[currentDistractingUrl] =
                            (siteTimers[currentDistractingUrl] || 0) + elapsed;
                        chrome.storage.local.set({ siteTimers });

                        currentDistractingUrl = hostname;
                        distractingStartTime = Date.now();
                    } else {
                        const elapsed = Date.now() - distractingStartTime;
                        const siteTimers = data.siteTimers || {};
                        const accumulatedTime =
                            (siteTimers[hostname] || 0) + elapsed;
                        siteTimers[hostname] = accumulatedTime;
                        chrome.storage.local.set({ siteTimers });

                        Object.keys(thresholdMessages).forEach(
                            (thresholdKey) => {
                                const thresholdMinutes = parseInt(
                                    thresholdKey,
                                    10
                                );
                                const thresholdMs =
                                    thresholdMinutes * 60 * 1000;
                                if (
                                    accumulatedTime >= thresholdMs &&
                                    !siteTimers[
                                        `${hostname}_notified_${thresholdKey}`
                                    ]
                                ) {
                                    const message =
                                        getRandomMessage(thresholdKey);
                                    chrome.notifications.create({
                                        type: "basic",
                                        iconUrl: "icons/icon128.png",
                                        title: "Procrastination Alert",
                                        message: message,
                                        priority: 2,
                                    });
                                    siteTimers[
                                        `${hostname}_notified_${thresholdKey}`
                                    ] = true;
                                    chrome.storage.local.set({ siteTimers });
                                }
                            }
                        );

                        distractingStartTime = Date.now();
                    }
                } else {
                    console.log("Not a distracting domain");
                    if (currentDistractingUrl) {
                        chrome.storage.local.get(["siteTimers"], (result) => {
                            const siteTimers = result.siteTimers || {};
                            if (siteTimers[currentDistractingUrl]) {
                                delete siteTimers[currentDistractingUrl];
                            }
                            Object.keys(siteTimers).forEach((key) => {
                                if (
                                    key.startsWith(
                                        `${currentDistractingUrl}_notified_`
                                    )
                                ) {
                                    delete siteTimers[key];
                                }
                            });
                            chrome.storage.local.set({ siteTimers });
                        });
                    }
                    distractingStartTime = null;
                    currentDistractingUrl = null;
                }
            });
        }
    );
}

setInterval(checkDistractingTime, 1000);
