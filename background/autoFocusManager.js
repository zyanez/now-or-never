import { isProductiveDomain } from "./domainChecker.js";

function autoFocusTasks() {
    chrome.tabs.query({}, (tabs) => {
        let productiveTab = tabs.find((tab) => {
            try {
                return isProductiveDomain(tab.url);
            } catch (e) {
                return false;
            }
        });
        if (productiveTab) {
            chrome.tabs.update(productiveTab.id, { active: true });
        } else {
            chrome.tabs.create({ url: "https://google.com" });
        }
    });
}

export { autoFocusTasks };
