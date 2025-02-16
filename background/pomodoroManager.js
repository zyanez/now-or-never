const FOCUS_DURATION = 25 * 60;
const SHORT_BREAK_DURATION = 5 * 60;
const LONG_BREAK_DURATION = 15 * 60;

let pomodoroState = {
    enabled: false,
    mode: "focus",
    remainingTime: FOCUS_DURATION,
    focusSessionsCompleted: 0,
};

let pomodoroInterval = null;

function startPomodoroCycle() {
    pomodoroState.enabled = true;

    if (!pomodoroState.remainingTime || pomodoroState.remainingTime <= 0) {
        if (pomodoroState.mode === "focus") {
            pomodoroState.remainingTime = FOCUS_DURATION;
        } else if (pomodoroState.mode === "shortBreak") {
            pomodoroState.remainingTime = SHORT_BREAK_DURATION;
        } else if (pomodoroState.mode === "longBreak") {
            pomodoroState.remainingTime = LONG_BREAK_DURATION;
        }
    }

    chrome.storage.local.set({ pomodoroEnabled: true });
    updateFocusModeForPomodoro();

    if (pomodoroInterval) clearInterval(pomodoroInterval);
    pomodoroInterval = setInterval(() => {
        if (!pomodoroState.enabled) return;
        pomodoroState.remainingTime--;

        let totalTime =
            pomodoroState.mode === "focus"
                ? FOCUS_DURATION
                : pomodoroState.mode === "shortBreak"
                ? SHORT_BREAK_DURATION
                : LONG_BREAK_DURATION;

        chrome.runtime.sendMessage({
            action: "pomodoroTick",
            remainingTime: pomodoroState.remainingTime,
            totalTime: totalTime,
        });

        if (pomodoroState.remainingTime <= 0) {
            clearInterval(pomodoroInterval);
            pomodoroInterval = null;
            pomodoroState.enabled = false;
            chrome.storage.local.set({ pomodoroEnabled: false });
            if (pomodoroState.mode === "focus") {
                pomodoroState.focusSessionsCompleted++;
            }

            let nextMode;
            if (pomodoroState.mode === "focus") {
                nextMode =
                    pomodoroState.focusSessionsCompleted % 4 === 0
                        ? "longBreak"
                        : "shortBreak";
            } else {
                nextMode = "focus";
            }

            let notifOptions = {
                type: "basic",
                iconUrl: "icons/icon128.png",
                title:
                    pomodoroState.mode === "focus"
                        ? "Focus Session Complete!"
                        : "Break Time Over!",
                message:
                    pomodoroState.mode === "focus"
                        ? `Time for a ${
                              nextMode === "longBreak" ? "long" : "short"
                          } break! Click "Start" when you're ready.`
                        : 'Ready for another focus session? Click "Start" when you want to begin.',
            };
            chrome.notifications.create("", notifOptions);

            pomodoroState.mode = nextMode;
            pomodoroState.remainingTime =
                nextMode === "focus"
                    ? FOCUS_DURATION
                    : nextMode === "shortBreak"
                    ? SHORT_BREAK_DURATION
                    : LONG_BREAK_DURATION;

            chrome.runtime.sendMessage({
                action: "pomodoroComplete",
                nextMode: nextMode,
                remainingTime: pomodoroState.remainingTime,
                totalTime: pomodoroState.remainingTime,
            });
        }
    }, 1000);
}

function stopPomodoroCycle() {
    pomodoroState.enabled = false;
    chrome.storage.local.set({ pomodoroEnabled: false });
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
    chrome.storage.local.set({ focusModeEnabled: false });
    removeBlur();
    chrome.runtime.sendMessage({
        action: "pomodoroTick",
        remainingTime: pomodoroState.remainingTime,
        totalTime:
            pomodoroState.mode === "focus"
                ? FOCUS_DURATION
                : pomodoroState.mode === "shortBreak"
                ? SHORT_BREAK_DURATION
                : LONG_BREAK_DURATION,
    });
}

function resetPomodoroCycle() {
    stopPomodoroCycle();
    pomodoroState.mode = "focus";
    pomodoroState.remainingTime = FOCUS_DURATION;
    pomodoroState.focusSessionsCompleted = 0;
    chrome.storage.local.set({
        pomodoroEnabled: false,
        focusModeEnabled: false,
    });
    removeBlur();
    chrome.runtime.sendMessage({
        action: "pomodoroTick",
        remainingTime: pomodoroState.remainingTime,
        totalTime: FOCUS_DURATION,
    });
}

function updateFocusModeForPomodoro() {
    const enableFocus = pomodoroState.mode === "focus";
    chrome.storage.local.set({ focusModeEnabled: enableFocus });
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            chrome.tabs.reload(tab.id);
        });
    });
}

function removeBlur() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: () => {
                    const overlay = document.getElementById("will-overlay");
                    if (overlay) {
                        overlay.remove();
                    }
                    Array.from(document.body.children).forEach((child) => {
                        child.style.filter = "";
                        child.style.userSelect = "";
                        child.style.pointerEvents = "";
                    });
                },
            });
        }
    });
}

function getPomodoroState() {
    return pomodoroState;
}

export {
    startPomodoroCycle,
    stopPomodoroCycle,
    resetPomodoroCycle,
    getPomodoroState,
};
