// Analytics Main Controller
// Handles data fetching, tab switching, and visualization

// Global analytics state
var AnalyticsState = {
    currentCategoryTab: 'energy',
    currentPeriod: 'week',
    periodOffset: 0, // 0 = current period, -1 = one period ago, etc.
    cachedData: null,
    lastFetch: null,
    cacheExpiry: 5 * 60 * 1000, // 5 minutes
    isLoading: false
};

/**
 * Initialize analytics when page 7 loads
 */
function initAnalytics() {
    console.log('Initializing analytics...');

    // Check authentication
    if (!currentUser) {
        showAnalyticsMessage('Please log in to view analytics.');
        setTimeout(function() { goToPage(0); }, 2000);
        return;
    }

    // Set up event listeners
    setupAnalyticsEventListeners();

    // Load initial data
    loadAnalyticsData();
}

/**
 * Set up event listeners for tabs and periods
 */
function setupAnalyticsEventListeners() {
    // Category tab buttons
    var categoryTabs = document.querySelectorAll('[data-category-tab]');
    for (var i = 0; i < categoryTabs.length; i++) {
        categoryTabs[i].addEventListener('click', handleCategoryTabClick);
    }

    // Period buttons
    var periodButtons = document.querySelectorAll('[data-period]');
    for (var j = 0; j < periodButtons.length; j++) {
        periodButtons[j].addEventListener('click', handlePeriodClick);
    }

    // Period navigator prev/next buttons
    var navPrev = document.getElementById('periodNavPrev');
    var navNext = document.getElementById('periodNavNext');
    if (navPrev) navPrev.addEventListener('click', function() { navigatePeriod(-1); });
    if (navNext) navNext.addEventListener('click', function() { navigatePeriod(1); });

    // Set initial navigator label
    updatePeriodNavigator();
}

/**
 * Handle category tab click (Energy/Mood/Other)
 */
function handleCategoryTabClick(event) {
    var categoryTab = event.target.dataset.categoryTab;
    if (!categoryTab || AnalyticsState.isLoading) return;

    // Update active tab button
    var allTabs = document.querySelectorAll('[data-category-tab]');
    for (var i = 0; i < allTabs.length; i++) {
        allTabs[i].classList.remove('active');
    }
    event.target.classList.add('active');

    // Update state and render
    AnalyticsState.currentCategoryTab = categoryTab;
    renderCurrentView();
}

/**
 * Handle period button click (Week/Month/3 Months/Year)
 */
function handlePeriodClick(event) {
    var period = event.target.dataset.period;
    if (!period || AnalyticsState.isLoading) return;

    // Update active period button
    var allPeriods = document.querySelectorAll('[data-period]');
    for (var i = 0; i < allPeriods.length; i++) {
        allPeriods[i].classList.remove('active');
    }
    event.target.classList.add('active');

    // Update state and render (reset offset to current period)
    AnalyticsState.currentPeriod = period;
    AnalyticsState.periodOffset = 0;
    renderCurrentView();
}

/**
 * Navigate the period calendar by `direction` steps (-1 = back, +1 = forward).
 */
function navigatePeriod(direction) {
    if (AnalyticsState.isLoading) return;
    var newOffset = AnalyticsState.periodOffset + direction;
    if (newOffset > 0) return; // Cannot navigate into the future
    AnalyticsState.periodOffset = newOffset;
    renderCurrentView();
}

/**
 * Update the period navigator label and disable the next button when at current period.
 */
function updatePeriodNavigator() {
    var label = document.getElementById('periodNavLabel');
    if (label) label.textContent = getPeriodLabel(AnalyticsState.currentPeriod, AnalyticsState.periodOffset);
    var nextBtn = document.getElementById('periodNavNext');
    if (nextBtn) nextBtn.disabled = AnalyticsState.periodOffset >= 0;
}

/**
 * Return start/end Date objects for a given period and offset.
 * offset=0 is the current period; offset=-1 is one period ago; etc.
 */
function getOffsetDateRange(period, offset) {
    var now = new Date();
    var startDate, endDate;

    if (period === 'week') {
        // Calendar week Mon–Sun
        var dayOfWeek = now.getDay(); // 0=Sun
        var daysFromMonday = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
        var monday = new Date(now);
        monday.setDate(now.getDate() - daysFromMonday + offset * 7);
        monday.setHours(0, 0, 0, 0);
        var sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        startDate = monday;
        endDate = sunday;
    } else if (period === 'month') {
        // Calendar month
        var year = now.getFullYear();
        var month = now.getMonth() + offset;
        // Normalize month overflow/underflow
        year += Math.floor(month / 12);
        month = ((month % 12) + 12) % 12;
        startDate = new Date(year, month, 1, 0, 0, 0, 0);
        endDate   = new Date(year, month + 1, 0, 23, 59, 59, 999);
    } else if (period === '3months') {
        // Calendar quarter (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
        var currentQuarter = Math.floor(now.getMonth() / 3); // 0-3
        var targetQuarter = currentQuarter + offset;
        // Normalize across year boundaries
        var qYear = now.getFullYear() + Math.floor(targetQuarter / 4);
        targetQuarter = ((targetQuarter % 4) + 4) % 4;
        var startMonth = targetQuarter * 3; // 0, 3, 6, or 9
        startDate = new Date(qYear, startMonth, 1, 0, 0, 0, 0);
        endDate   = new Date(qYear, startMonth + 3, 0, 23, 59, 59, 999); // last day of quarter
    } else {
        // Calendar year
        var targetYear = now.getFullYear() + offset;
        startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
        endDate   = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    }

    return { startDate: startDate, endDate: endDate };
}

/**
 * Return a human-readable label for the given period and offset.
 */
function getPeriodLabel(period, offset) {
    var range = getOffsetDateRange(period, offset);
    var s = range.startDate;
    var e = range.endDate;
    var SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    if (period === 'week') {
        if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
            return SHORT[s.getMonth()] + ' ' + s.getDate() + ' \u2013 ' + e.getDate() + ', ' + s.getFullYear();
        }
        return SHORT[s.getMonth()] + ' ' + s.getDate() + ' \u2013 ' + SHORT[e.getMonth()] + ' ' + e.getDate() + ', ' + e.getFullYear();
    } else if (period === 'month') {
        return LONG[s.getMonth()] + ' ' + s.getFullYear();
    } else if (period === '3months') {
        return SHORT[s.getMonth()] + ' \u2013 ' + SHORT[e.getMonth()] + ' ' + e.getFullYear();
    } else {
        return '' + s.getFullYear();
    }
}

/**
 * Load analytics data
 */
function loadAnalyticsData() {
    AnalyticsState.isLoading = true;
    showLoadingIndicator();

    // Check if we need to fetch data
    var now = Date.now();
    var cacheValid = AnalyticsState.cachedData &&
                      AnalyticsState.lastFetch &&
                      (now - AnalyticsState.lastFetch) < AnalyticsState.cacheExpiry;

    if (!cacheValid) {
        fetchAnalyticsData().then(function() {
            renderCurrentView();
            AnalyticsState.isLoading = false;
        }).catch(function(error) {
            console.error('Error loading analytics:', error);
            showAnalyticsMessage('Error loading data: ' + error.message);
            AnalyticsState.isLoading = false;
        });
    } else {
        renderCurrentView();
        AnalyticsState.isLoading = false;
    }
}

/**
 * Fetch analytics data from Firestore
 */
function fetchAnalyticsData() {
    if (!window.firebaseDb || !window.firebaseQuery) {
        return Promise.reject(new Error('Firebase is not initialized'));
    }

    if (!currentUser) {
        return Promise.reject(new Error('User not authenticated'));
    }

    console.log('Fetching analytics data from Firestore...');

    // Query Firestore for all of the user's entries (cached locally; date filtering done per-view)
    var entriesRef = window.firebaseCollection(window.firebaseDb, 'entries');
    var q = window.firebaseQuery(
        entriesRef,
        window.firebaseWhere('userId', '==', currentUser.uid)
    );

    return window.firebaseGetDocs(q).then(function(querySnapshot) {
        var entries = [];
        querySnapshot.forEach(function(doc) {
            entries.push(doc.data());
        });

        console.log('Fetched ' + entries.length + ' entries from Firestore');

        // Sort by date ascending
        entries.sort(function(a, b) {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            return 0;
        });

        // Store all entries in cache
        AnalyticsState.cachedData = entries;
        AnalyticsState.lastFetch = Date.now();
    }).catch(function(error) {
        console.error('Firestore query error:', error);
        throw new Error('Failed to fetch data from database');
    });
}

/**
 * Render current view based on category tab and period
 */
function renderCurrentView() {
    if (!AnalyticsState.cachedData) {
        showAnalyticsMessage('No data available. Start tracking to see analytics!');
        return;
    }

    // Get filtered data for the current period (with offset for calendar navigation)
    var dateRange = getOffsetDateRange(AnalyticsState.currentPeriod, AnalyticsState.periodOffset);
    var filteredData = filterDataByRange(AnalyticsState.cachedData, dateRange.startDate, dateRange.endDate);

    // Update navigator label and button states
    updatePeriodNavigator();
    filteredData = fillMissingDates(filteredData, dateRange.startDate, dateRange.endDate);

    if (filteredData.length === 0) {
        showAnalyticsMessage('No data for this time period.');
        return;
    }

    // Render based on current category tab
    var container = document.getElementById('analyticsContent');
    if (!container) return;

    if (AnalyticsState.currentCategoryTab === 'energy') {
        renderEnergyTab(container, filteredData);
    } else if (AnalyticsState.currentCategoryTab === 'mood') {
        renderMoodTab(container, filteredData);
    } else if (AnalyticsState.currentCategoryTab === 'other') {
        renderOtherTab(container, filteredData);
    }

    // Trigger animations after rendering
    setTimeout(function() {
        triggerChartAnimations();
    }, 50);
}

/**
 * Render Energy tab content
 */
function renderEnergyTab(container, data) {
    container.innerHTML = '<div class="chart-wrapper"><div id="energyInsights"></div></div>' +
        '<div class="chart-wrapper"><h3>Energy Levels</h3><div id="energyChart" class="chart-container"></div></div>' +
        '<div class="chart-wrapper"><h3>Caffeine Insights</h3><div id="caffeineInsights"></div></div>' +
        '<div class="chart-wrapper"><h3>Sleep Patterns</h3><div id="sleepInsights"></div><div id="sleepChart" class="chart-container"></div></div>';

    // Render energy insights
    var energyInsightsHtml = renderInsightsHTML('energy', data);
    document.getElementById('energyInsights').innerHTML = energyInsightsHtml;

    // Render energy chart
    renderBarChart('energyChart', data, {
        metric: 'energy',
        colorLow: 'rgba(180,200,255,0.6)',
        colorHigh: 'rgba(180,200,255,0.9)',
        colorLowNeg: 'rgba(120,140,180,0.5)',
        colorHighNeg: 'rgba(120,140,180,0.8)'
    });

    // Render caffeine insights
    var caffeineInsights = calculateCaffeineInsights(data);
    var caffeineInsightsContainer = document.getElementById('caffeineInsights');
    if (caffeineInsightsContainer) {
        caffeineInsightsContainer.innerHTML = '<div class="insights-section">' +
            '<div class="insights-title" style="display: none;">Caffeine Insights</div>' +
            caffeineInsights.html +
            '</div>';
    }

    // Render sleep insights
    var sleepInsights = calculateSleepInsights(data);
    var sleepInsightsContainer = document.getElementById('sleepInsights');
    if (sleepInsightsContainer) {
        sleepInsightsContainer.innerHTML = '<div class="insights-section">' +
            sleepInsights.html +
            '</div>';
    }

    // Render sleep bar chart
    renderSleepBarChart('sleepChart', data);
}

/**
 * Render Mood tab content
 */
function renderMoodTab(container, data) {
    container.innerHTML = '<div class="chart-wrapper"><div id="moodInsights"></div></div>' +
        '<div class="chart-wrapper"><h3>Mood Levels</h3><div id="moodChart" class="chart-container"></div></div>' +
        '<div class="chart-wrapper"><h3>Anxiety</h3><div id="anxietyChart" class="chart-container"></div></div>' +
        '<div class="chart-wrapper"><h3>Irritability</h3><div id="irritabilityChart" class="chart-container"></div></div>';

    // Render insights
    var insightsHtml = renderInsightsHTML('mood', data);
    document.getElementById('moodInsights').innerHTML = insightsHtml;

    // Render mood chart
    renderBarChart('moodChart', data, {
        metric: 'mood',
        colorLow: 'rgba(237,191,231,0.6)',
        colorHigh: 'rgba(237,191,231,0.9)',
        colorLowNeg: 'rgba(180,140,180,0.5)',
        colorHighNeg: 'rgba(180,140,180,0.8)'
    });

    // Render anxiety chart
    renderLineChart('anxietyChart', data, {
        metric: 'anxiety',
        color: 'rgba(244,227,179,0.8)',
        fillColor: 'rgba(244,227,179,0.2)'
    });

    // Render irritability chart
    renderLineChart('irritabilityChart', data, {
        metric: 'irritability',
        color: 'rgba(200,180,255,0.8)',
        fillColor: 'rgba(200,180,255,0.2)'
    });
}

/**
 * Render Other tab content (Notes, Pattern Insights, Activities, People)
 */
function renderOtherTab(container, data) {
    container.innerHTML = '<div class="chart-wrapper"><div id="notesDisplay" class="chart-container"></div></div>' +
        '<div class="chart-wrapper"><h3>Pattern Insights</h3><div id="patternInsights"></div></div>' +
        '<div class="chart-wrapper"><h3>Activities Distribution</h3><div id="activitiesPie" class="chart-container"></div></div>' +
        '<div class="chart-wrapper"><h3>People Distribution</h3><div id="peoplePie" class="chart-container"></div></div>';

    // Render notes
    renderNotes('notesDisplay', data);

    // Render pattern insights
    var patternInsights = analyzePatterns(data);
    var patternInsightsContainer = document.getElementById('patternInsights');
    if (patternInsightsContainer) {
        patternInsightsContainer.innerHTML = '<div class="insights-section">' +
            patternInsights.html +
            '</div>';
    }

    // Render activities pie chart
    renderPieChart('activitiesPie', data, 'activities');

    // Render people pie chart
    renderPieChart('peoplePie', data, 'people');
}

/**
 * Render tags visualization (activities or people)
 */
function renderTagsVisualization(containerId, data, field) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Count tag occurrences
    var tagCounts = {};
    for (var i = 0; i < data.length; i++) {
        var entry = data[i];
        if (entry[field] && entry[field].length > 0) {
            for (var j = 0; j < entry[field].length; j++) {
                var tag = entry[field][j];
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        }
    }

    // Sort by count
    var sortedTags = Object.keys(tagCounts).sort(function(a, b) {
        return tagCounts[b] - tagCounts[a];
    });

    if (sortedTags.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No ' + field + ' recorded in this period.</p>';
        return;
    }

    // Render as tag cloud
    var html = '<div style="display: flex; flex-wrap: wrap; gap: 10px; padding: 20px; justify-content: center;">';
    for (var k = 0; k < sortedTags.length; k++) {
        var tag = sortedTags[k];
        var count = tagCounts[tag];
        var fontSize = 0.9 + (count / data.length) * 1.5; // Scale font based on frequency
        html += '<div style="padding: 8px 14px; background: linear-gradient(135deg, rgba(237,191,231,0.15), rgba(244,227,179,0.1)); border: 1px solid rgba(237,191,231,0.3); border-radius: 16px; color: #EDBFE7; font-size: ' + fontSize + 'em;">' +
            tag + ' <span style="opacity: 0.6;">(' + count + ')</span></div>';
    }
    html += '</div>';

    container.innerHTML = html;
}

/**
 * Render notes display
 */
function renderNotes(containerId, data) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Filter entries with non-empty notes
    var notesEntries = [];
    for (var i = 0; i < data.length; i++) {
        if (data[i].note && data[i].note.trim() !== '') {
            notesEntries.push(data[i]);
        }
    }

    if (notesEntries.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No notes recorded in this period.</p>';
        return;
    }

    // For week: show all, for longer periods: show 7 random
    var displayNotes = notesEntries;
    if (AnalyticsState.currentPeriod !== 'week' && notesEntries.length > 7) {
        // Shuffle and take 7
        displayNotes = notesEntries.slice().sort(function() { return 0.5 - Math.random(); }).slice(0, 7);
        // Sort by date
        displayNotes.sort(function(a, b) {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            return 0;
        });
    }

    // Build notes content
    var notesContent = '<div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 0 4px;">';
    for (var j = 0; j < displayNotes.length; j++) {
        var entry = displayNotes[j];
        notesContent += '<div style="background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; padding: 15px;">' +
            '<div style="color: #EDBFE7; font-weight: 600; margin-bottom: 8px;">' + formatDate(entry.date, 'MMM DD') + '</div>' +
            '<div style="color: #DFE4EB; line-height: 1.6;">' + entry.note + '</div>' +
            '</div>';
    }
    notesContent += '</div>';

    if (AnalyticsState.currentPeriod !== 'week' && notesEntries.length > 7) {
        notesContent += '<p style="color: #888; text-align: center; font-size: 0.9em; font-style: italic; margin-top: 10px;">Showing 7 random notes from ' + notesEntries.length + ' total</p>';
    }

    // Create collapsible structure
    var html = '<div class="notes-collapsible">' +
        '<button class="notes-toggle-btn" onclick="toggleNotesSection()">' +
        'Notes (' + notesEntries.length + ') <span id="notesToggleIcon">▼</span>' +
        '</button>' +
        '<div id="notesContent" style="display: block;">' +
        notesContent +
        '</div>' +
        '</div>';

    container.innerHTML = html;
}

/**
 * Toggle notes section visibility
 */
function toggleNotesSection() {
    var content = document.getElementById('notesContent');
    var icon = document.getElementById('notesToggleIcon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
    } else {
        content.style.display = 'none';
        icon.textContent = '▶';
    }
}

// Make toggleNotesSection available globally
window.toggleNotesSection = toggleNotesSection;

/**
 * Initialize intersection observer for typing animations
 */
function initInsightAnimations() {
    // Check if IntersectionObserver is supported
    if (!window.IntersectionObserver) {
        // Fallback: just show all insights without animation
        var insights = document.querySelectorAll('.insights-section, .insight-item');
        for (var i = 0; i < insights.length; i++) {
            insights[i].style.opacity = '1';
        }
        return;
    }

    var observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2
    };

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var target = entry.target;

                if (target.classList.contains('insights-section')) {
                    target.classList.add('animate-in');

                    // Trigger typing effect on child insight items
                    var insightItems = target.querySelectorAll('.insight-item');
                    for (var i = 0; i < insightItems.length; i++) {
                        insightItems[i].classList.add('typing');
                    }
                }

                // Unobserve after animation is triggered
                observer.unobserve(target);
            }
        });
    }, observerOptions);

    // Observe all insights sections
    var insightsSections = document.querySelectorAll('.insights-section');
    for (var j = 0; j < insightsSections.length; j++) {
        observer.observe(insightsSections[j]);
    }
}

/**
 * Initialize intersection observer for chart animations
 */
function initChartAnimations() {
    // Check if IntersectionObserver is supported
    if (!window.IntersectionObserver) {
        // Fallback: just show all charts without animation
        var chartContainers = document.querySelectorAll('.chart-container');
        for (var i = 0; i < chartContainers.length; i++) {
            chartContainers[i].classList.add('animate-in');
        }
        return;
    }

    var observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var target = entry.target;

                if (target.classList.contains('chart-container')) {
                    // Delay animation by 500ms
                    setTimeout(function() {
                        target.classList.add('animate-in');
                    }, 500);
                }

                // Unobserve after animation is triggered
                observer.unobserve(target);
            }
        });
    }, observerOptions);

    // Observe all chart containers
    var chartContainers = document.querySelectorAll('.chart-container');
    for (var j = 0; j < chartContainers.length; j++) {
        var container = chartContainers[j];
        observer.observe(container);

        // Immediate check: If container is already visible, trigger animation after delay
        // This handles cases where observer might not fire right away
        var rect = container.getBoundingClientRect();
        var isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (isVisible) {
            // Delay animation by 500ms to match observer delay
            setTimeout(function(cont) {
                // Only trigger if observer hasn't already done so
                if (!cont.classList.contains('animate-in')) {
                    cont.classList.add('animate-in');
                }
            }, 500, container);
        }
    }

    // Safety fallback: If charts are still not animated after 2 seconds, trigger the animation
    // This handles edge cases where observer doesn't trigger (browser bugs, timing issues, etc.)
    setTimeout(function() {
        var containers = document.querySelectorAll('.chart-container');
        for (var k = 0; k < containers.length; k++) {
            // Add animate-in class if not present (this will trigger CSS animations)
            if (!containers[k].classList.contains('animate-in')) {
                containers[k].classList.add('animate-in');
            }
        }

        // Final emergency fallback: After another second, if elements are still invisible, force them visible
        // This only happens if CSS animations completely fail
        setTimeout(function() {
            var allContainers = document.querySelectorAll('.chart-container');
            for (var i = 0; i < allContainers.length; i++) {
                var chartElements = allContainers[i].querySelectorAll('.chart-bar, .chart-line, .chart-point, .chart-pie-slice, .chart-sleep-bar, .jar-star');
                for (var j = 0; j < chartElements.length; j++) {
                    var element = chartElements[j];
                    var computedOpacity = window.getComputedStyle(element).opacity;
                    // Only force visibility if element is still invisible (opacity < 0.1)
                    if (parseFloat(computedOpacity) < 0.1) {
                        element.style.opacity = '1';
                    }
                }
            }
        }, 1000);
    }, 2000);
}

/**
 * Re-trigger animations when tab is switched
 */
function triggerChartAnimations() {
    // Remove and re-add animation class to chart wrappers
    var chartWrappers = document.querySelectorAll('.chart-wrapper');
    for (var i = 0; i < chartWrappers.length; i++) {
        var wrapper = chartWrappers[i];
        wrapper.style.animation = 'none';
        wrapper.offsetHeight; // Trigger reflow
        wrapper.style.animation = '';
    }

    // Remove animate-in class from all chart containers
    var chartContainers = document.querySelectorAll('.chart-container');
    for (var j = 0; j < chartContainers.length; j++) {
        chartContainers[j].classList.remove('animate-in');
    }

    // Re-initialize animations immediately (delay is in the observer itself)
    initInsightAnimations();
    initChartAnimations();
}


/**
 * Refresh analytics data
 */
function refreshAnalyticsData() {
    console.log('Refreshing analytics data...');
    AnalyticsState.cachedData = null;
    AnalyticsState.lastFetch = null;
    loadAnalyticsData();
}

/**
 * Show loading indicator
 */
function showLoadingIndicator() {
    var container = document.getElementById('analyticsContent');
    if (container) {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; padding: 60px; color: #EDBFE7;"><div class="loading-spinner"></div><span style="margin-left: 12px;">Loading data...</span></div>';
    }
}

/**
 * Show message in analytics area
 */
function showAnalyticsMessage(message) {
    var container = document.getElementById('analyticsContent');
    if (container) {
        container.innerHTML = '<p style="color: #DFE4EB; text-align: center; padding: 40px;">' + message + '</p>';
    }
}

// Make refreshAnalyticsData available globally for the onclick handler
window.refreshAnalyticsData = refreshAnalyticsData;

console.log('Analytics module loaded');
