function clearOverlayAndResetStyles() {
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

function applyWillOverlay() {
    if (document.getElementById("will-overlay")) return;
    Array.from(document.body.children).forEach((child) => {
        child.style.filter = "blur(5px)";
        child.style.userSelect = "none";
        child.style.pointerEvents = "none";
    });
    if (!document.getElementById("will-style")) {
        const style = document.createElement("style");
        style.id = "will-style";
        style.textContent = `
        #will-overlay {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 70%;
            max-width: 400px;
            background-color: #ffffff;
            border: 1px solid #f1f1f1;
            border-radius: 8px;
            padding: 20px;
            z-index: 999;
            text-align: center;
        }
        #will-overlay h1 {
            color: #1e293b;
            font-size: 32px;
            margin: 0 0 15px 0;
        }
        #will-overlay p {
            color: #1e293b;
            font-size: 16px;
            margin-bottom: 10px;
        }
        #will-overlay button {
            margin: 5px;
            outline: none;
            padding: 10px 20px;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            color: #1e293b;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.2s ease-in-out;
        }
        #will-overlay button:hover {
            background-color: #f1f5f9;
        }`;
        document.head.appendChild(style);
    }
    const overlay = document.createElement("div");
    overlay.id = "will-overlay";
    overlay.innerHTML = `
        <h1>Are you sure you want to enter this page?</h1>
        <p>You should be focusing right now!</p>
        <button id="only5min">Just 5 min</button>
        <button id="backFocus">Back to Focus</button>`;
    document.body.appendChild(overlay);
    document.getElementById("only5min").addEventListener("click", function () {
        const currentTime = Date.now();
        const fiveMinutesFromNow = currentTime + 5 * 60 * 1000;
        chrome.storage.local.set({
            temporaryAccess: {
                url: window.location.href,
                expiresAt: fiveMinutesFromNow,
            },
        });
        chrome.runtime.sendMessage({
            action: "createFiveMinuteTimer",
            url: window.location.href,
        });
        const overlay = document.getElementById("will-overlay");
        if (overlay) {
            overlay.remove();
        }
        Array.from(document.body.children).forEach((child) => {
            child.style.filter = "";
            child.style.userSelect = "";
            child.style.pointerEvents = "";
        });
    });
    document.getElementById("backFocus").addEventListener("click", function () {
        chrome.runtime.sendMessage({ action: "backToFocus" });
    });
}

export { clearOverlayAndResetStyles, applyWillOverlay };