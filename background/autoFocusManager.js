import { isProductiveDomain } from "./domainChecker.js";

async function autoFocusTasks() {
    const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve));
    const sortedTabs = tabs.sort((a, b) => b.lastAccesed - a.lastAccesed);
    for (const tab of sortedTabs) {
        try {
            if (isProductiveDomain(tab.url)){
                if (!tab.active) {
                    await chrome.tabs.update(tab.id, {active:true});
                }
                return;
            }
        } catch (e) {

        }
    }
    await chrome.tabs.create({url: "https://google.com"});
}

export { autoFocusTasks };
