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
    isLoading: false,
    printLanguage: 'en',
    printMonth: '',
    printSections: {
        weeklyAverages: true,
        energyChart: true,
        moodChart: true,
        anxietyChart: true,
        irritabilityChart: true
    }
};

var analyticsListenersBound = false;
var chartAnimationSafetyTimeout = null;
var chartAnimationForceTimeout = null;
var analyticsRevealObserver = null;

function afterTwoFrames(callback) {
    if (typeof requestAnimationFrame !== 'function') {
        setTimeout(callback, 34);
        return;
    }
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            callback();
        });
    });
}

function disconnectAnalyticsRevealObserver() {
    if (analyticsRevealObserver && typeof analyticsRevealObserver.disconnect === 'function') {
        analyticsRevealObserver.disconnect();
    }
    analyticsRevealObserver = null;
}

/**
 * Initialize analytics when page 7 loads
 */
function initAnalytics() {
    console.log('Initializing analytics...');
    currentUser = currentUser || window.currentUser;

    // Check authentication
    if (!currentUser) {
        showAnalyticsMessage('Please log in to view analytics.');
        setTimeout(function() { goToPage(0); }, 2000);
        return;
    }

    // Set up event listeners
    setupAnalyticsEventListeners();

    if (!AnalyticsState.printMonth) {
        var now = new Date();
        AnalyticsState.printMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }

    // Load initial data
    loadAnalyticsData();
}

/**
 * Set up event listeners for tabs and periods
 */
function setupAnalyticsEventListeners() {
    if (analyticsListenersBound) return;
    analyticsListenersBound = true;

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
        // Calendar week MonвЂ“Sun
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

    // Query Firestore for all of the user's symptom entries (user-scoped subcollection)
    var entriesRef = window.firebaseCollection(window.firebaseDb, 'users', currentUser.uid, 'entriesSymptoms');

    return window.firebaseGetDocs(entriesRef).then(function(querySnapshot) {
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

    if (AnalyticsState.currentCategoryTab !== 'print' && filteredData.length === 0) {
        showAnalyticsMessage('No data for this time period.');
        return;
    }

    if (AnalyticsState.currentCategoryTab !== 'print') {
        filteredData = fillMissingDates(filteredData, dateRange.startDate, dateRange.endDate);
    }

    // Render based on current category tab
    var container = document.getElementById('analyticsContent');
    if (!container) return;

    if (AnalyticsState.currentCategoryTab === 'print') {
        setAnalyticsPrintTabState(true);
        renderPrintTab(container);
    } else if (AnalyticsState.currentCategoryTab === 'energy') {
        setAnalyticsPrintTabState(false);
        renderEnergyTab(container, filteredData);
    } else if (AnalyticsState.currentCategoryTab === 'mood') {
        setAnalyticsPrintTabState(false);
        renderMoodTab(container, filteredData);
    }

    if (AnalyticsState.currentCategoryTab === 'print') return;

    // Trigger animations after rendering
    setTimeout(function() {
        triggerChartAnimations();
    }, 50);
}

function setAnalyticsPrintTabState(isPrintTab) {
    var page = document.getElementById('page7');
    if (!page) return;
    page.classList.toggle('print-tab-active', !!isPrintTab);
}

function renderPrintTab(container) {
    var t = getPrintI18n(AnalyticsState.printLanguage || 'en');
    var selectedMonth = AnalyticsState.printMonth || '';
    var s = AnalyticsState.printSections || {};
    container.innerHTML =
        '<div class="chart-wrapper animate-in">' +
            '<div class="print-panel">' +
                '<h3>' + t.printReportTitle + '</h3>' +
                '<p class="print-panel-note">' + t.printReportHint + '</p>' +
                '<div class="print-form-grid">' +
                    '<div class="print-form-field">' +
                        '<label for="printLanguageSelect">' + t.languageLabel + '</label>' +
                        '<select id="printLanguageSelect">' +
                            '<option value="en"' + ((AnalyticsState.printLanguage === 'en') ? ' selected' : '') + '>English</option>' +
                            '<option value="ru"' + ((AnalyticsState.printLanguage === 'ru') ? ' selected' : '') + '>Русский</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="print-form-field">' +
                        '<label for="printMonthInput">' + t.monthLabel + '</label>' +
                        '<input type="month" id="printMonthInput" value="' + selectedMonth + '">' +
                    '</div>' +
                '</div>' +
                '<div class="print-sections-wrap">' +
                    '<div class="print-sections-title">' + t.sectionsLabel + '</div>' +
                    '<div class="print-sections-grid">' +
                        '<label class="print-check"><input type="checkbox" id="printSectionWeekly" ' + (s.weeklyAverages ? 'checked' : '') + '><span>' + t.includeWeeklyAverages + '</span></label>' +
                        '<label class="print-check"><input type="checkbox" id="printSectionEnergy" ' + (s.energyChart ? 'checked' : '') + '><span>' + t.includeEnergyChart + '</span></label>' +
                        '<label class="print-check"><input type="checkbox" id="printSectionMood" ' + (s.moodChart ? 'checked' : '') + '><span>' + t.includeMoodChart + '</span></label>' +
                        '<label class="print-check"><input type="checkbox" id="printSectionAnxiety" ' + (s.anxietyChart ? 'checked' : '') + '><span>' + t.includeAnxietyChart + '</span></label>' +
                        '<label class="print-check"><input type="checkbox" id="printSectionIrritability" ' + (s.irritabilityChart ? 'checked' : '') + '><span>' + t.includeIrritabilityChart + '</span></label>' +
                    '</div>' +
                '</div>' +
                '<button type="button" class="print-generate-btn" onclick="generateAnalyticsMonthlyPdf()">' + t.generateButton + '</button>' +
            '</div>' +
        '</div>';
}

function getPrintI18n(lang) {
    if (lang === 'ru') {
        return {
            printReportTitle: 'Печать отчета',
            printReportHint: 'Выберите месяц и язык PDF. Отчет включает недельные средние и графики за месяц.',
            languageLabel: 'Язык PDF',
            monthLabel: 'Месяц',
            generateButton: 'Создать PDF',
            reportTitle: 'Аналитический отчет',
            generatedAt: 'Создан',
            monthHeading: 'Месяц',
            weeklyAverages: 'Недельные средние',
            week: 'Неделя',
            weekRange: 'Диапазон',
            avgEnergyHigh: 'Средняя высокая энергия',
            avgEnergyLow: 'Средняя низкая энергия',
            avgMoodHigh: 'Среднее высокое настроение',
            avgMoodLow: 'Среднее низкое настроение',
            avgSleep: 'Средний сон (ч)',
            avgAnxiety: 'Средняя тревожность',
            avgIrritability: 'Средняя раздражительность',
            monthlyCharts: 'Графики за месяц',
            energyChart: 'Диапазон энергии',
            moodChart: 'Диапазон настроения',
            anxietyChart: 'Тревожность',
            irritabilityChart: 'Раздражительность',
            sectionsLabel: 'Блоки отчета',
            includeWeeklyAverages: 'Недельные средние',
            includeEnergyChart: 'График энергии',
            includeMoodChart: 'График настроения',
            includeAnxietyChart: 'График тревожности',
            includeIrritabilityChart: 'График раздражительности',
            noData: 'Нет данных за выбранный месяц.',
            selectMonthAlert: 'Пожалуйста, выберите месяц.',
            popupBlockedAlert: 'Разрешите всплывающие окна для печати.',
            selectAtLeastOneBlock: 'Выберите хотя бы один блок отчета.'
        };
    }
    return {
        printReportTitle: 'Print Report',
        printReportHint: 'Choose PDF language and month. The report includes weekly averages and monthly charts.',
        languageLabel: 'PDF language',
        monthLabel: 'Month',
        generateButton: 'Generate PDF',
        reportTitle: 'Analytics Report',
        generatedAt: 'Generated',
        monthHeading: 'Month',
        weeklyAverages: 'Weekly Averages',
        week: 'Week',
        weekRange: 'Range',
        avgEnergyHigh: 'Avg High Energy',
        avgEnergyLow: 'Avg Low Energy',
        avgMoodHigh: 'Avg High Mood',
        avgMoodLow: 'Avg Low Mood',
        avgSleep: 'Avg Sleep (h)',
        avgAnxiety: 'Avg Anxiety',
        avgIrritability: 'Avg Irritability',
        monthlyCharts: 'Monthly Charts',
        energyChart: 'Energy Range',
        moodChart: 'Mood Range',
        anxietyChart: 'Anxiety',
        irritabilityChart: 'Irritability',
        sectionsLabel: 'Report blocks',
        includeWeeklyAverages: 'Weekly averages',
        includeEnergyChart: 'Energy chart',
        includeMoodChart: 'Mood chart',
        includeAnxietyChart: 'Anxiety chart',
        includeIrritabilityChart: 'Irritability chart',
        noData: 'No data for selected month.',
        selectMonthAlert: 'Please select a month.',
        popupBlockedAlert: 'Please allow popups to print.',
        selectAtLeastOneBlock: 'Select at least one report block.'
    };
}

function getMonthRangeFromInput(monthValue) {
    if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return null;
    var year = parseInt(monthValue.slice(0, 4), 10);
    var month = parseInt(monthValue.slice(5, 7), 10) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    var start = new Date(year, month, 1, 0, 0, 0, 0);
    var end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { startDate: start, endDate: end };
}

function buildWeeklyAveragesForMonth(monthData, startDate, endDate) {
    function avg(values) {
        if (!values.length) return 0;
        return Math.round((values.reduce(function(sum, v) { return sum + v; }, 0) / values.length) * 10) / 10;
    }
    function fmt(v) {
        return (Math.round(v * 10) / 10).toFixed(1);
    }

    var rows = [];
    var cursor = new Date(startDate);
    var weekIndex = 1;
    while (cursor <= endDate) {
        var chunkStart = new Date(cursor);
        var chunkEnd = new Date(cursor);
        chunkEnd.setDate(chunkEnd.getDate() + 6);
        if (chunkEnd > endDate) chunkEnd = new Date(endDate);

        var chunk = filterDataByRange(monthData, chunkStart, chunkEnd);
        var valid = chunk.filter(function(e) { return !e.isMissing; });

        var energyHigh = [];
        var energyLow = [];
        var moodHigh = [];
        var moodLow = [];
        var sleepHours = [];
        var anx = [];
        var irr = [];

        for (var i = 0; i < valid.length; i++) {
            var e = valid[i];
            if (e.energy && Number.isFinite(e.energy.highest) && Number.isFinite(e.energy.lowest)) {
                energyHigh.push(e.energy.highest);
                energyLow.push(e.energy.lowest);
            }
            if (e.mood && Number.isFinite(e.mood.highest) && Number.isFinite(e.mood.lowest)) {
                moodHigh.push(e.mood.highest);
                moodLow.push(e.mood.lowest);
            }
            if (Number.isFinite(e.anxiety)) anx.push(e.anxiety);
            if (Number.isFinite(e.irritability)) irr.push(e.irritability);
            if (Array.isArray(e.sleep) && typeof analyzeSleepData === 'function') {
                var s = analyzeSleepData(e.sleep);
                if (s && Number.isFinite(s.duration) && s.duration > 0) sleepHours.push(s.duration);
            }
        }

        rows.push({
            week: weekIndex,
            start: formatDate(chunkStart, 'M/D'),
            end: formatDate(chunkEnd, 'M/D'),
            avgEnergyHigh: fmt(avg(energyHigh)),
            avgEnergyLow: fmt(avg(energyLow)),
            avgMoodHigh: fmt(avg(moodHigh)),
            avgMoodLow: fmt(avg(moodLow)),
            avgSleep: fmt(avg(sleepHours)),
            avgAnxiety: fmt(avg(anx)),
            avgIrritability: fmt(avg(irr))
        });

        cursor.setDate(cursor.getDate() + 7);
        weekIndex += 1;
    }
    return rows;
}

function makeMonthChartsSvg(monthData) {
    var holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-99999px';
    holder.style.top = '-99999px';
    holder.style.width = '900px';
    holder.style.pointerEvents = 'none';
    document.body.appendChild(holder);

    var suffix = String(Date.now());
    var ids = {
        energy: 'print_energy_' + suffix,
        mood: 'print_mood_' + suffix,
        anxiety: 'print_anxiety_' + suffix,
        irritability: 'print_irritability_' + suffix
    };

    holder.innerHTML =
        '<div id="' + ids.energy + '"></div>' +
        '<div id="' + ids.mood + '"></div>' +
        '<div id="' + ids.anxiety + '"></div>' +
        '<div id="' + ids.irritability + '"></div>';

    var prevPeriod = AnalyticsState.currentPeriod;
    AnalyticsState.currentPeriod = 'month';
    try {
        renderBarChart(ids.energy, monthData, {
            metric: 'energy',
            colorLow: '#8d95b7',
            colorHigh: '#8d95b7',
            colorLowNeg: '#8d95b7',
            colorHighNeg: '#8d95b7',
            outlineColor: '#a2a9c8'
        });
        renderBarChart(ids.mood, monthData, {
            metric: 'mood',
            colorLow: '#8d95b7',
            colorHigh: '#8d95b7',
            colorLowNeg: '#8d95b7',
            colorHighNeg: '#8d95b7',
            outlineColor: '#a2a9c8'
        });
        renderLineChart(ids.anxiety, monthData, {
            metric: 'anxiety',
            color: '#6f7899',
            fillColor: 'rgba(0,0,0,0)'
        });
        renderLineChart(ids.irritability, monthData, {
            metric: 'irritability',
            color: '#6f7899',
            fillColor: 'rgba(0,0,0,0)'
        });
    } finally {
        AnalyticsState.currentPeriod = prevPeriod;
    }

    function getSvg(id) {
        var node = document.getElementById(id);
        if (!node) return '';
        var svg = node.querySelector('svg');
        return svg ? svg.outerHTML : '';
    }

    function normalizePdfChartSvg(svgMarkup) {
        if (!svgMarkup) return '';
        var host = document.createElement('div');
        host.innerHTML = svgMarkup;
        var svg = host.querySelector('svg');
        if (!svg) return svgMarkup;

        // Keep all chart dots small and uniform.
        var points = svg.querySelectorAll('circle.chart-point');
        for (var i = 0; i < points.length; i++) {
            points[i].setAttribute('r', '3');
        }

        // For x-axis labels only (rotated date labels), keep day number only.
        var labels = svg.querySelectorAll('text');
        for (var j = 0; j < labels.length; j++) {
            var txt = labels[j];
            var transform = txt.getAttribute('transform') || '';
            if (transform.indexOf('rotate(-45') === -1) continue;
            var raw = (txt.textContent || '').trim();
            if (!raw) continue;
            var dayOnly = raw;
            var slashMatch = raw.match(/(\d{1,2})\s*\/\s*(\d{1,2})$/);
            if (slashMatch) {
                dayOnly = slashMatch[2];
            } else {
                var dayMatch = raw.match(/(\d{1,2})$/);
                if (dayMatch) dayOnly = dayMatch[1];
            }
            txt.textContent = dayOnly;
        }

        return svg.outerHTML;
    }

    var svgs = {
        energy: getSvg(ids.energy),
        mood: getSvg(ids.mood),
        anxiety: getSvg(ids.anxiety),
        irritability: getSvg(ids.irritability)
    };
    svgs.energy = normalizePdfChartSvg(svgs.energy);
    svgs.mood = normalizePdfChartSvg(svgs.mood);
    svgs.anxiety = normalizePdfChartSvg(svgs.anxiety);
    svgs.irritability = normalizePdfChartSvg(svgs.irritability);
    holder.remove();
    return svgs;
}

function generateAnalyticsMonthlyPdf() {
    if (!AnalyticsState.cachedData) {
        showAnalyticsMessage('No data available. Start tracking to see analytics!');
        return;
    }

    var langSel = document.getElementById('printLanguageSelect');
    var monthInput = document.getElementById('printMonthInput');
    var lang = langSel ? langSel.value : (AnalyticsState.printLanguage || 'en');
    var monthValue = monthInput ? monthInput.value : AnalyticsState.printMonth;
    AnalyticsState.printLanguage = (lang === 'ru') ? 'ru' : 'en';
    AnalyticsState.printMonth = monthValue;
    var t = getPrintI18n(AnalyticsState.printLanguage);
    AnalyticsState.printSections = {
        weeklyAverages: !!(document.getElementById('printSectionWeekly') && document.getElementById('printSectionWeekly').checked),
        energyChart: !!(document.getElementById('printSectionEnergy') && document.getElementById('printSectionEnergy').checked),
        moodChart: !!(document.getElementById('printSectionMood') && document.getElementById('printSectionMood').checked),
        anxietyChart: !!(document.getElementById('printSectionAnxiety') && document.getElementById('printSectionAnxiety').checked),
        irritabilityChart: !!(document.getElementById('printSectionIrritability') && document.getElementById('printSectionIrritability').checked)
    };
    var sections = AnalyticsState.printSections;
    if (!sections.weeklyAverages && !sections.energyChart && !sections.moodChart && !sections.anxietyChart && !sections.irritabilityChart) {
        alert(t.selectAtLeastOneBlock);
        return;
    }

    var range = getMonthRangeFromInput(monthValue);
    if (!range) {
        alert(t.selectMonthAlert);
        return;
    }

    var monthDataRaw = filterDataByRange(AnalyticsState.cachedData, range.startDate, range.endDate);
    if (!monthDataRaw.length) {
        alert(t.noData);
        return;
    }
    var monthData = fillMissingDates(monthDataRaw, range.startDate, range.endDate);
    var weeklyRows = buildWeeklyAveragesForMonth(monthData, range.startDate, range.endDate);
    var charts = makeMonthChartsSvg(monthData);

    var customMonthName = formatDate(range.startDate, 'MMM DD').split(' ')[0] + ' ' + range.startDate.getFullYear();
    if (/^\d{4}-\d{2}$/.test(monthValue)) {
        var parts = monthValue.split('-');
        var dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        customMonthName = dt.toLocaleDateString((lang === 'ru' ? 'ru-RU' : 'en-US'), { month: 'long', year: 'numeric' });
    }

    var rowsHtml = weeklyRows.map(function(r) {
        return '<tr>' +
            '<td>' + r.week + '</td>' +
            '<td>' + r.start + ' - ' + r.end + '</td>' +
            '<td>' + r.avgEnergyHigh + '</td>' +
            '<td>' + r.avgEnergyLow + '</td>' +
            '<td>' + r.avgMoodHigh + '</td>' +
            '<td>' + r.avgMoodLow + '</td>' +
            '<td>' + r.avgSleep + '</td>' +
            '<td>' + r.avgAnxiety + '</td>' +
            '<td>' + r.avgIrritability + '</td>' +
        '</tr>';
    }).join('');

    var weeklySectionHtml = '';
    if (sections.weeklyAverages) {
        weeklySectionHtml =
            '<h3>' + t.weeklyAverages + '</h3>' +
            '<table><thead><tr>' +
                '<th>' + t.week + '</th>' +
                '<th>' + t.weekRange + '</th>' +
                '<th>' + t.avgEnergyHigh + '</th>' +
                '<th>' + t.avgEnergyLow + '</th>' +
                '<th>' + t.avgMoodHigh + '</th>' +
                '<th>' + t.avgMoodLow + '</th>' +
                '<th>' + t.avgSleep + '</th>' +
                '<th>' + t.avgAnxiety + '</th>' +
                '<th>' + t.avgIrritability + '</th>' +
            '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';
    }

    var chartBlocks = [];
    if (sections.energyChart) {
        chartBlocks.push('<div class="chart-block"><div class="chart-title">' + t.energyChart + '</div>' + charts.energy + '</div>');
    }
    if (sections.moodChart) {
        chartBlocks.push('<div class="chart-block"><div class="chart-title">' + t.moodChart + '</div>' + charts.mood + '</div>');
    }
    if (sections.anxietyChart) {
        chartBlocks.push('<div class="chart-block"><div class="chart-title">' + t.anxietyChart + '</div>' + charts.anxiety + '</div>');
    }
    if (sections.irritabilityChart) {
        chartBlocks.push('<div class="chart-block"><div class="chart-title">' + t.irritabilityChart + '</div>' + charts.irritability + '</div>');
    }
    var chartSectionHtml = chartBlocks.length ? ('<h3>' + t.monthlyCharts + '</h3>' + chartBlocks.join('')) : '';

    var popup = window.open('', '_blank');
    if (!popup) {
        alert(t.popupBlockedAlert);
        return;
    }

    popup.document.write(
        '<!doctype html><html><head><meta charset="UTF-8"><title>' + t.reportTitle + '</title>' +
        '<style>' +
        'body{font-family:Arial,sans-serif;color:#1f2430;padding:22px;background:#fff;}' +
        'h1,h2,h3{margin:0 0 10px;color:#1d2230;}' +
        '.meta{margin:0 0 16px;color:#4d556f;font-size:13px;}' +
        'table{width:100%;border-collapse:collapse;margin:8px 0 20px;page-break-inside:auto;}' +
        'tr{page-break-inside:avoid;break-inside:avoid;}' +
        'th,td{border:1px solid #d7dcea;padding:7px 8px;font-size:12px;text-align:left;}' +
        'th{background:#f5f7fc;}' +
        '.chart-block{margin:0 0 18px;padding:10px;border:1px solid #d7dcea;border-radius:8px;page-break-inside:avoid;break-inside:avoid;}' +
        '.chart-title{font-weight:700;margin:0 0 8px;}' +
        '.chart-block svg{width:100%;height:auto;display:block;}' +
        '.chart-block svg .chart-bar,.chart-block svg .chart-sleep-bar{fill:#8d95b7 !important;stroke:#a2a9c8 !important;opacity:1 !important;filter:none !important;}' +
        '.chart-block svg .chart-line{stroke:#5f6688 !important;stroke-width:2.2 !important;opacity:1 !important;filter:none !important;}' +
        '.chart-block svg .chart-point{fill:#5f6688 !important;stroke:#e5e8f2 !important;stroke-width:1.1 !important;opacity:1 !important;}' +
        '.chart-block svg text{fill:#6e7697 !important;opacity:1 !important;}' +
        '.chart-block svg line{stroke:#d0d5e5 !important;opacity:1 !important;}' +
        '.chart-block svg .baseline-line{stroke:#9aa2bf !important;opacity:1 !important;}' +
        '.chart-block svg path[fill^=\"url(\"]{fill:#cfd4e6 !important;opacity:0.2 !important;}' +
        '@page{size:A4 portrait;margin:12mm;}' +
        '</style></head><body>' +
        '<h1>' + t.reportTitle + '</h1>' +
        '<p class="meta">' + t.generatedAt + ': ' + new Date().toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US') + '</p>' +
        '<h2>' + t.monthHeading + ': ' + customMonthName + '</h2>' +
        weeklySectionHtml +
        chartSectionHtml +
        '<script>window.onload=function(){setTimeout(function(){window.print();},120);};<\/script>' +
        '</body></html>'
    );
    popup.document.close();
}

window.generateAnalyticsMonthlyPdf = generateAnalyticsMonthlyPdf;

/**
 * Render Energy tab content
 */
function renderEnergyTab(container, data) {
    container.innerHTML = '<div class="chart-wrapper"><div id="energyInsights"></div><div id="energyChart" class="chart-container"></div></div>' +
        '<div class="chart-wrapper"><h3>Sleep Patterns</h3><div id="sleepInsights"></div><div id="sleepChart" class="chart-container"></div></div>';

    // Render energy insights
    var energyInsightsHtml = renderInsightsHTML('energy', data);
    document.getElementById('energyInsights').innerHTML = energyInsightsHtml;

    // Render energy chart
    renderBarChart('energyChart', data, {
        metric: 'energy',
        colorLow: 'rgba(197,230,168,0.66)',
        colorHigh: 'rgba(197,230,168,0.88)',
        colorLowNeg: 'rgba(197,230,168,0.66)',
        colorHighNeg: 'rgba(197,230,168,0.88)',
        outlineColor: 'rgba(197,230,168,0.38)'
    });

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
    container.innerHTML = '<div class="chart-wrapper"><div id="moodInsights"></div><div id="moodChart" class="chart-container"></div></div>' +
        '<div class="chart-wrapper"><div id="anxietyInsights"></div><div id="anxietyChart" class="chart-container"></div></div>' +
        '<div class="chart-wrapper"><div id="irritabilityInsights"></div><div id="irritabilityChart" class="chart-container"></div></div>';

    // Render insights
    var insightsHtml = renderInsightsHTML('mood', data);
    document.getElementById('moodInsights').innerHTML = insightsHtml;

    // Render anxiety insights
    var anxietyInsightsHtml = renderInsightsHTML('anxiety', data);
    var anxietyInsightsEl = document.getElementById('anxietyInsights');
    if (anxietyInsightsEl) anxietyInsightsEl.innerHTML = anxietyInsightsHtml;

    // Render irritability insights
    var irritabilityInsightsHtml = renderInsightsHTML('irritability', data);
    var irritabilityInsightsEl = document.getElementById('irritabilityInsights');
    if (irritabilityInsightsEl) irritabilityInsightsEl.innerHTML = irritabilityInsightsHtml;

    // Render mood chart
    renderBarChart('moodChart', data, {
        metric: 'mood',
        colorLow: 'rgba(237,191,231,0.66)',
        colorHigh: 'rgba(237,191,231,0.88)',
        colorLowNeg: 'rgba(237,191,231,0.66)',
        colorHighNeg: 'rgba(237,191,231,0.88)',
        outlineColor: 'rgba(237,191,231,0.38)'
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
        'Notes (' + notesEntries.length + ') <span id="notesToggleIcon" class="notes-toggle-arrow open">&#8250;</span>' +
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
        icon.classList.add('open');
    } else {
        content.style.display = 'none';
        icon.classList.remove('open');
    }
}

// Make toggleNotesSection available globally
window.toggleNotesSection = toggleNotesSection;

/**
 * Initialize intersection observer for typing animations
 */
function initInsightAnimations() {
    var insightSections = document.querySelectorAll('.insights-section');
    for (var i = 0; i < insightSections.length; i++) {
        insightSections[i].classList.remove('animate-in');
        insightSections[i].style.transitionDelay = '';
        var itemsReset = insightSections[i].querySelectorAll('.insight-item');
        for (var j = 0; j < itemsReset.length; j++) {
            itemsReset[j].classList.remove('typing');
            itemsReset[j].style.transitionDelay = '';
        }
    }
}

/**
 * Initialize intersection observer for chart animations
 */
function initChartAnimations() {
    if (chartAnimationSafetyTimeout) {
        clearTimeout(chartAnimationSafetyTimeout);
        chartAnimationSafetyTimeout = null;
    }
    if (chartAnimationForceTimeout) {
        clearTimeout(chartAnimationForceTimeout);
        chartAnimationForceTimeout = null;
    }

    var chartContainers = document.querySelectorAll('.chart-container');
    for (var i = 0; i < chartContainers.length; i++) {
        chartContainers[i].classList.remove('animate-in');
    }
}

function observeAnalyticsAnimationsOnScroll() {
    disconnectAnalyticsRevealObserver();

    var wrappers = document.querySelectorAll('.chart-wrapper');
    var sections = document.querySelectorAll('.insights-section');
    var containers = document.querySelectorAll('.chart-container');
    var allTargets = [];
    for (var i = 0; i < wrappers.length; i++) allTargets.push(wrappers[i]);
    for (var j = 0; j < sections.length; j++) allTargets.push(sections[j]);
    for (var k = 0; k < containers.length; k++) allTargets.push(containers[k]);

    if (!allTargets.length) return;

    if (!window.IntersectionObserver) {
        for (var f = 0; f < wrappers.length; f++) wrappers[f].classList.add('animate-in');
        for (var g = 0; g < sections.length; g++) {
            sections[g].classList.add('animate-in');
            var itemsNow = sections[g].querySelectorAll('.insight-item');
            for (var h = 0; h < itemsNow.length; h++) itemsNow[h].classList.add('typing');
        }
        for (var m = 0; m < containers.length; m++) containers[m].classList.add('animate-in');
        return;
    }

    analyticsRevealObserver = new IntersectionObserver(function(entries, observer) {
        for (var e = 0; e < entries.length; e++) {
            var entry = entries[e];
            if (!entry.isIntersecting) continue;
            var target = entry.target;

            if (target.classList.contains('chart-wrapper')) {
                target.classList.add('animate-in');
            } else if (target.classList.contains('insights-section')) {
                target.classList.add('animate-in');
                var items = target.querySelectorAll('.insight-item');
                for (var q = 0; q < items.length; q++) {
                    items[q].style.transitionDelay = (0.22 + q * 0.12) + 's';
                    items[q].classList.add('typing');
                }
            } else if (target.classList.contains('chart-container')) {
                target.classList.add('animate-in');
            }

            observer.unobserve(target);
        }
    }, {
        root: null,
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.12
    });

    for (var t = 0; t < allTargets.length; t++) {
        analyticsRevealObserver.observe(allTargets[t]);
    }
}

/**
 * Re-trigger animations when tab is switched
 */
function triggerChartAnimations() {
    // Reset card wrappers for scroll-triggered reveal.
    var chartWrappers = document.querySelectorAll('.chart-wrapper');
    for (var i = 0; i < chartWrappers.length; i++) {
        chartWrappers[i].classList.remove('animate-in');
        chartWrappers[i].style.transitionDelay = (i * 0.08) + 's';
    }

    // Re-initialize animations immediately (delay is in the observer itself)
    initInsightAnimations();
    initChartAnimations();
    afterTwoFrames(function() {
        observeAnalyticsAnimationsOnScroll();
    });
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
