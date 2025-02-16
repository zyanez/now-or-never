document.addEventListener("DOMContentLoaded", () => {
    const startPauseButton = document.getElementById("startPausePomodoro");
    const resetButton = document.getElementById("resetPomodoro");
    const pomodoroBar = document.getElementById("pomodoroBar");
    const pomodoroTime = document.getElementById("pomodoroTime");
    const sessionTypeEl = document.getElementById("sessionType");
    let pomodoroRunning = false;
    
    chrome.runtime.sendMessage({ action: "getPomodoroState" }, (state) => {
        if (state) {
            pomodoroRunning = state.enabled;
            startPauseButton.textContent = pomodoroRunning ? "Pause" : "Start";

            if (state.mode === "focus") {
                sessionTypeEl.textContent = "Focus Session";
            } else if (state.mode === "shortBreak") {
                sessionTypeEl.textContent = "Short Break";
            } else if (state.mode === "longBreak") {
                sessionTypeEl.textContent = "Long Break";
            }

            const minutes = Math.floor(state.remainingTime / 60);
            const seconds = state.remainingTime % 60;
            pomodoroTime.textContent = `${minutes
                .toString()
                .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

            let totalTime = 0;
            if (state.mode === "focus") {
                totalTime = 25;
            } else if (state.mode === "shortBreak") {
                totalTime = 5;
            } else if (state.mode === "longBreak") {
                totalTime = 15;
            }

            const progressPercent =
                ((totalTime - state.remainingTime) / totalTime) * 100;
            pomodoroBar.style.width = progressPercent + "%";
        }
    });

    startPauseButton.addEventListener("click", () => {
        if (pomodoroRunning) {
            chrome.runtime.sendMessage({ action: "stopPomodoro" });
            startPauseButton.textContent = "Start";
            pomodoroRunning = false;
        } else {
            chrome.runtime.sendMessage({ action: "startPomodoro" });
            startPauseButton.textContent = "Pause";
            pomodoroRunning = true;
        }
    });

    resetButton.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "resetPomodoro" });
        pomodoroRunning = false;
        startPauseButton.textContent = "Start";
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "pomodoroTick") {
            const { remainingTime, totalTime } = message;
            const progressPercent =
                ((totalTime - remainingTime) / totalTime) * 100;
            pomodoroBar.style.width = progressPercent + "%";
            const minutes = Math.floor(remainingTime / 60);
            const seconds = remainingTime % 60;
            pomodoroTime.textContent = `${minutes
                .toString()
                .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        } else if (message.action === "pomodoroComplete") {
            const { nextMode, remainingTime } = message;
            let label = "";
            if (nextMode === "focus") {
                label = "Focus Session";
            } else if (nextMode === "shortBreak") {
                label = "Short Break";
            } else if (nextMode === "longBreak") {
                label = "Long Break";
            }
            sessionTypeEl.textContent = label;
            const minutes = Math.floor(remainingTime / 60);
            const seconds = remainingTime % 60;
            pomodoroTime.textContent = `${minutes
                .toString()
                .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            pomodoroBar.style.width = "0%";
            startPauseButton.textContent = "Start";
            pomodoroRunning = false;
        }
    });
});
