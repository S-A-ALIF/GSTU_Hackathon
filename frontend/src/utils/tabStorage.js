export const getActiveTab = (key, defaultTab) => {
    const data = localStorage.getItem(key);
    if (!data) return defaultTab;
    
    // Check if it's the old format (just a plain string)
    if (!data.startsWith('{')) {
        // Upgrade it to the new format
        setActiveTab(key, data);
        return data;
    }

    try {
        const parsed = JSON.parse(data);
        const { tab, timestamp } = parsed;
        const now = Date.now();
        const FIVE_MINUTES = 5 * 60 * 1000;
        
        if (now - timestamp > FIVE_MINUTES) {
            localStorage.removeItem(key);
            return defaultTab;
        }
        
        return tab;
    } catch (e) {
        return defaultTab;
    }
};

export const setActiveTab = (key, tab) => {
    const data = JSON.stringify({
        tab,
        timestamp: Date.now()
    });
    localStorage.setItem(key, data);
};

export const clearAllTabs = () => {
    const keys = ['hackathon_active_tab', 'hackathon_admin_tab', 'hackathon_mentor_tab', 'hackathon_project_tab'];
    keys.forEach(key => localStorage.removeItem(key));
};
