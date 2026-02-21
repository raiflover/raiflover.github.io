// Analytics Utilities
// Date manipulation and data processing helpers

/**
 * Get start and end dates for different time ranges
 * @param {string} rangeType - 'week', 'month', '3months', or 'year'
 * @returns {Object} - { startDate, endDate }
 */
function getDateRange(rangeType) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // End of today

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of day

    switch (rangeType) {
        case 'week':
            startDate.setDate(startDate.getDate() - 6); // Last 7 days (including today)
            break;
        case 'month':
            startDate.setDate(1); // First day of current month
            break;
        case '3months':
            startDate.setDate(startDate.getDate() - 89); // Last 90 days
            break;
        case 'year':
            startDate.setDate(startDate.getDate() - 364); // Last 365 days
            break;
        default:
            startDate.setDate(startDate.getDate() - 6); // Default to week
    }

    return { startDate, endDate };
}

/**
 * Format date to various string formats
 * @param {Date|string} date - Date object or date string
 * @param {string} format - 'YYYY-MM-DD', 'MMM DD', 'M/D', 'short'
 * @returns {string} - Formatted date string
 */
function formatDate(date, format = 'YYYY-MM-DD') {
    const d = typeof date === 'string'
        ? (date.length === 10 ? new Date(date + 'T00:00:00') : new Date(date))
        : date;

    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    switch (format) {
        case 'YYYY-MM-DD':
            return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        case 'MMM DD':
            return `${monthNames[month]} ${day}`;
        case 'M/D':
            return `${month + 1}/${day}`;
        case 'short':
            return `${monthNames[month]} ${day}`;
        default:
            return d.toLocaleDateString();
    }
}

/**
 * Get day of week from date
 * @param {Date|string} date - Date object or date string
 * @param {boolean} fullName - Return full name vs short name
 * @returns {string|number} - Day name or day number (0-6)
 */
function getDayOfWeek(date, fullName = false) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dayNum = d.getDay();

    if (fullName) {
        const fullNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return fullNames[dayNum];
    }

    const shortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return shortNames[dayNum];
}

/**
 * Filter data entries by date range
 * @param {Array} data - Array of entry objects
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @returns {Array} - Filtered entries
 */
function filterDataByRange(data, startDate, endDate) {
    if (!data || !Array.isArray(data)) return [];

    const startStr = formatDate(startDate, 'YYYY-MM-DD');
    const endStr = formatDate(endDate, 'YYYY-MM-DD');

    return data.filter(entry => {
        return entry.date >= startStr && entry.date <= endStr;
    });
}

/**
 * Fill missing dates in data range with baseline values
 * @param {Array} data - Array of entry objects
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} - Data with missing dates filled
 */
function fillMissingDates(data, startDate, endDate) {
    const filled = [];
    const dataMap = {};

    // Create map of existing data
    data.forEach(entry => {
        dataMap[entry.date] = entry;
    });

    // Iterate through date range
    const current = new Date(startDate);
    while (current <= endDate) {
        const dateStr = formatDate(current, 'YYYY-MM-DD');

        if (dataMap[dateStr]) {
            filled.push(dataMap[dateStr]);
        } else {
            // Create baseline entry for missing date
            filled.push({
                date: dateStr,
                energy: { highest: 4, lowest: 4 },
                mood: { highest: 4, lowest: 4 },
                anxiety: 4,
                irritability: 4,
                productivity: 4,
                satisfaction: 4,
                socialActivity: 4,
                isMissing: true // Flag for visual indication
            });
        }

        current.setDate(current.getDate() + 1);
    }

    return filled;
}

/**
 * Normalize value relative to baseline for chart positioning
 * @param {number} value - Value from 1-7 scale
 * @param {number} baseline - Baseline value (typically 4)
 * @returns {number} - Normalized value
 */
function normalizeValue(value, baseline = 4) {
    return value - baseline;
}

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, delay = 250) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Calculate days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} - Number of days
 */
function daysBetween(startDate, endDate) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((endDate - startDate) / oneDay));
}

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is today
 */
function isToday(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return formatDate(d, 'YYYY-MM-DD') === formatDate(today, 'YYYY-MM-DD');
}

/**
 * Parse date string to Date object
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} - Date object
 */
function parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}
