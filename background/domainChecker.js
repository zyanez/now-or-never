import domains from "../domains.js";

const distractingDomains = domains.distractingDomains.map(domain => domain.toLowerCase());
const productiveDomains = domains.productiveDomains.map(domain => domain.toLowerCase());

function normalizeHostName(hostname){
    return hostname.replace(/^www\./, '').toLowerCase();
}

function isDistractingDomain(url) {
    try {
        const hostname = normalizeHostName(new URL(url).hostname);
        return distractingDomains.some(domain =>
            hostname === domain || hostname.endsWith(`.${domain}`)
        );
    } catch (error) {
        return false;
    }
}

function isProductiveDomain(url) {
    try {
        const hostname = normalizeHostName(new URL(url).hostname);
        return productiveDomains.some(domain =>
            hostname === domain || hostname.endsWith(`.${domain}`)
        );
    } catch (error) {
        return false;
    }
}

export { distractingDomains, productiveDomains, isDistractingDomain, isProductiveDomain };