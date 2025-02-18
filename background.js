import {
    startPomodoroCycle,
    stopPomodoroCycle,
    resetPomodoroCycle,
    getPomodoroState,
} from "./background/pomodoroManager.js";
import {
    applyWillOverlay
} from "./background/overlayManager.js";
import { isDistractingDomain } from "./background/domainChecker.js";
import { autoFocusTasks } from "./background/autoFocusManager.js";
import thresholdMessages from './messages.js';

let cachedSiteTimers = {};
let flushTimer = null;

chrome.storage.local.get("siteTimers", (data) => {
    cachedSiteTimers = data.siteTimers || {};
});

function flushSiteTimers(){
    chrome.storage.local.set({siteTimers: cachedSiteTimers}, () => {
        if (chrome.runtime.lastError){
            console.error("Error updating timers:",chrome.runtime.lastError);
        }
    });
    flushTimer = null;
}

function scheduleFlush(){
    if (!flushTimer){
        flushTimer = setTimeout(flushSiteTimers, 1000);
    }
}

function updateSiteTimers(hostname, elapsed){
    cachedSiteTimers[hostname] = (cachedSiteTimers[hostname] || 0) + elapsed;
    scheduleFlush();
}


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
    if (details.url.startsWith("chrome://") || details.url === "about:newtab") return;

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


function getRandomMessage(threshold) {
    const messages = thresholdMessages[threshold];
    if (messages && messages.length) {
      const index = Math.floor(Math.random() * messages.length);
      return messages[index];
    }
    return "";
}

async function checkDistractingTime() {

    const {antiProcrastinationEnabled} = await new Promise((resolve) =>
        chrome.storage.local.get(["antiProcrastinationEnabled"], resolve)
    );

    if (!antiProcrastinationEnabled){
        distractingStartTime = null;
        currentDistractingUrl = null;
        return;
    }

    const tabs = await new Promise((resolve) => 
        chrome.tabs.query({active: true, currentWindow: true}, resolve)
    );

    if (!tabs || !tabs[0] || !tabs[0].url){
        distractingStartTime = null;
        currentDistractingUrl = null;
        return;
    }

    let parsedUrl;
    try{
        parsedUrl = new URL(tabs[0].url);
    } catch (error) {
        distractingStartTime = null;
        currentDistractingUrl = null;
        return;
    }

    if (parsedUrl.protocol === "chrome:" || parsedUrl.hostname==="newtab"){
        distractingStartTime = null;
        currentDistractingUrl = null;
        return;
    }

    if (isDistractingDomain(tabs[0].url)){
        const hostname = parsedUrl.hostname;
        const now = Date.now();

        if (!currentDistractingUrl){
            currentDistractingUrl = hostname;
            distractingStartTime = now;
        } else if (currentDistractingUrl !== hostname){
            const elapsed = now - distractingStartTime;
            await updateSiteTimers(currentDistractingUrl, elapsed);
            checkThresholdNotifications(currentDistractingUrl);
            currentDistractingUrl = hostname;
            distractingStartTime = now;
        } else {
            const elapsed = now - distractingStartTime;
            await updateSiteTimers(hostname, elapsed);
            checkThresholdNotifications(hostname);
            distractingStartTime = now;
        }
    } else {
        if (currentDistractingUrl){
            delete cachedSiteTimers[currentDistractingUrl];
            Object.keys(cachedSiteTimers).forEach((key) => {
                delete cachedSiteTimers[key];
            });
            scheduleFlush();
        }
        distractingStartTime = null;
        currentDistractingUrl = null;
    }
}

function checkThresholdNotifications(hostname){
    const accumulatedTime = cachedSiteTimers[hostname] || 0;
    Object.keys(thresholdMessages).forEach((thresholdKey) => {
        const thresholdMs = parseInt(thresholdKey, 10) * 60 * 1000;
        if (
            accumulatedTime >= thresholdMs &&
            !cachedSiteTimers[`${hostname}_notified_${thresholdKey}`]
        ){
            const message = getRandomMessage(thresholdKey);
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icons/icon128.png",
                title: "Procastination Alert",
                message: message,
                priority: 2
            });
            cachedSiteTimers[`${hostname}_notified_${thresholdKey}`] = true;
            scheduleFlush();
        }
    });
}

chrome.alarms.create("distractingTimeCheck", {periodInMinutes: 0.1});
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "distractingTimeCheck"){
        checkDistractingTime();
    } 
});