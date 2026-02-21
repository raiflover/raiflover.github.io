// Analytics Charts
// SVG rendering for bar charts (energy/mood) and line charts (anxiety/irritability)

/**
 * Create SVG element with attributes
 * @param {string} type - SVG element type (svg, rect, path, etc.)
 * @param {Object} attributes - Object with attribute key-value pairs
 * @returns {SVGElement} - Created SVG element
 */
function createSVGElement(type, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', type);
    Object.keys(attributes).forEach(key => {
        element.setAttribute(key, attributes[key]);
    });
    return element;
}

/**
 * Aggregate daily data into N-day chunks, averaging each metric.
 * Used to display weekly (chunkSize=7) or bi-weekly (chunkSize=14) averages.
 */
function _aggregateByDays(data, chunkSize) {
    function mean(arr) {
        var valid = arr.filter(function(v) { return v != null && !isNaN(v); });
        if (!valid.length) return 4;
        return Math.round(valid.reduce(function(s, v) { return s + v; }, 0) / valid.length * 10) / 10;
    }
    var result = [];
    for (var i = 0; i < data.length; i += chunkSize) {
        var chunk = data.slice(i, Math.min(i + chunkSize, data.length));
        var nonMissing = chunk.filter(function(e) { return !e.isMissing; });
        if (nonMissing.length === 0) {
            result.push({ date: chunk[0].date, isMissing: true,
                energy: { highest: 4, lowest: 4 }, mood: { highest: 4, lowest: 4 },
                anxiety: 4, irritability: 4 });
            continue;
        }
        result.push({
            date: chunk[0].date,
            isMissing: false,
            energy: {
                highest: mean(nonMissing.map(function(e) { return e.energy ? e.energy.highest : null; })),
                lowest:  mean(nonMissing.map(function(e) { return e.energy ? e.energy.lowest  : null; }))
            },
            mood: {
                highest: mean(nonMissing.map(function(e) { return e.mood ? e.mood.highest : null; })),
                lowest:  mean(nonMissing.map(function(e) { return e.mood ? e.mood.lowest  : null; }))
            },
            anxiety:      mean(nonMissing.map(function(e) { return e.anxiety; })),
            irritability: mean(nonMissing.map(function(e) { return e.irritability; }))
        });
    }
    return result;
}

/**
 * Aggregate raw day-data into N-day chunks for the sleep chart.
 * Returns pre-processed sleep entries with averaged metrics.
 */
function _aggregateSleepRaw(data, chunkSize) {
    function tMin(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
    function tStr(m) { var n = ((Math.round(m) % 1440) + 1440) % 1440; return (n/60|0).toString().padStart(2,'0') + ':' + (n%60).toString().padStart(2,'0'); }
    var result = [];
    for (var i = 0; i < data.length; i += chunkSize) {
        var chunk = data.slice(i, Math.min(i + chunkSize, data.length));
        var entries = [];
        for (var j = 0; j < chunk.length; j++) {
            var e = chunk[j];
            if (!e.isMissing && e.sleep && Array.isArray(e.sleep)) {
                var an = analyzeSleepData(e.sleep);
                if (an.duration > 0) entries.push({ dur: an.duration, bed: tMin(an.bedtime), wake: tMin(an.wakeTime), hasNaps: an.hasNaps, napCount: an.napCount || 0 });
            }
        }
        if (!entries.length) continue;
        var avgDur  = entries.reduce(function(s,e){return s+e.dur;},0) / entries.length;
        // Circular bedtime average: times before 6am treated as next-day
        var normBed = entries.map(function(e){return e.bed < 360 ? e.bed + 1440 : e.bed;});
        var avgBed  = normBed.reduce(function(s,v){return s+v;},0) / normBed.length;
        var avgWake = entries.reduce(function(s,e){return s+e.wake;},0) / entries.length;
        result.push({ date: chunk[0].date, duration: avgDur,
            bedtime: tStr(avgBed), wakeTime: tStr(avgWake),
            hasNaps: entries.some(function(e){return e.hasNaps;}),
            napCount: entries.reduce(function(s,e){return s+e.napCount;},0),
            bedtimeMinutes: avgBed % 1440, wakeTimeMinutes: avgWake });
    }
    return result;
}

/**
 * Aggregate daily data into calendar months, averaging each metric.
 * Used to display monthly averages for the year view.
 */
function _aggregateByMonth(data) {
    function mean(arr) {
        var valid = arr.filter(function(v) { return v != null && !isNaN(v); });
        if (!valid.length) return 4;
        return Math.round(valid.reduce(function(s, v) { return s + v; }, 0) / valid.length * 10) / 10;
    }
    var groups = {}, order = [];
    for (var i = 0; i < data.length; i++) {
        var mk = data[i].date.substring(0, 7);
        if (!groups[mk]) { groups[mk] = []; order.push(mk); }
        groups[mk].push(data[i]);
    }
    var result = [];
    for (var k = 0; k < order.length; k++) {
        var key = order[k], chunk = groups[key];
        var nonMissing = chunk.filter(function(e) { return !e.isMissing; });
        if (nonMissing.length === 0) {
            result.push({ date: key + '-01', isMissing: true,
                energy: { highest: 4, lowest: 4 }, mood: { highest: 4, lowest: 4 },
                anxiety: 4, irritability: 4 });
            continue;
        }
        result.push({
            date: key + '-01', isMissing: false,
            energy: {
                highest: mean(nonMissing.map(function(e) { return e.energy ? e.energy.highest : null; })),
                lowest:  mean(nonMissing.map(function(e) { return e.energy ? e.energy.lowest  : null; }))
            },
            mood: {
                highest: mean(nonMissing.map(function(e) { return e.mood ? e.mood.highest : null; })),
                lowest:  mean(nonMissing.map(function(e) { return e.mood ? e.mood.lowest  : null; }))
            },
            anxiety:      mean(nonMissing.map(function(e) { return e.anxiety; })),
            irritability: mean(nonMissing.map(function(e) { return e.irritability; }))
        });
    }
    return result;
}

/**
 * Aggregate raw day-data into calendar months for the sleep chart.
 */
function _aggregateSleepByMonth(data) {
    function tMin(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
    function tStr(m) { var n = ((Math.round(m) % 1440) + 1440) % 1440; return (n/60|0).toString().padStart(2,'0') + ':' + (n%60).toString().padStart(2,'0'); }
    var groups = {}, order = [];
    for (var i = 0; i < data.length; i++) {
        var mk = data[i].date.substring(0, 7);
        if (!groups[mk]) { groups[mk] = []; order.push(mk); }
        groups[mk].push(data[i]);
    }
    var result = [];
    for (var k = 0; k < order.length; k++) {
        var key = order[k], chunk = groups[key];
        var entries = [];
        for (var j = 0; j < chunk.length; j++) {
            var e = chunk[j];
            if (!e.isMissing && e.sleep && Array.isArray(e.sleep)) {
                var an = analyzeSleepData(e.sleep);
                if (an.duration > 0) entries.push({ dur: an.duration, bed: tMin(an.bedtime), wake: tMin(an.wakeTime), hasNaps: an.hasNaps, napCount: an.napCount || 0 });
            }
        }
        if (!entries.length) continue;
        var avgDur  = entries.reduce(function(s,e){return s+e.dur;},0) / entries.length;
        var normBed = entries.map(function(e){return e.bed < 360 ? e.bed + 1440 : e.bed;});
        var avgBed  = normBed.reduce(function(s,v){return s+v;},0) / normBed.length;
        var avgWake = entries.reduce(function(s,e){return s+e.wake;},0) / entries.length;
        result.push({ date: key + '-01', duration: avgDur,
            bedtime: tStr(avgBed), wakeTime: tStr(avgWake),
            hasNaps: entries.some(function(e){return e.hasNaps;}),
            napCount: entries.reduce(function(s,e){return s+e.napCount;},0),
            bedtimeMinutes: avgBed % 1440, wakeTimeMinutes: avgWake });
    }
    return result;
}

/**
 * Render bar chart for energy or mood
 * @param {string} containerId - ID of container element
 * @param {Array} data - Array of data entries
 * @param {Object} options - Chart options (metric, color, etc.)
 */
function renderBarChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const {
        metric = 'energy', // 'energy' or 'mood'
        colorLow = 'rgba(180,200,255,0.6)',
        colorHigh = 'rgba(180,200,255,0.9)',
        colorLowNeg = 'rgba(120,140,180,0.5)',
        colorHighNeg = 'rgba(120,140,180,0.8)',
        outlineColor = 'rgba(255,255,255,0.24)'
    } = options;

    // Aggregate into weekly/monthly averages for longer periods
    var _period = (typeof AnalyticsState !== 'undefined') ? AnalyticsState.currentPeriod : 'week';
    if (_period === '3months') data = _aggregateByDays(data, 7);
    else if (_period === 'year') data = _aggregateByMonth(data);

    // Period-aware bar styling (4 tiers)
    var barGapFrac, barRx;
    // bars-week
    if (_period === 'week')         { barGapFrac = 0.28; barRx = 18; }
    // bars-3months
    else if (_period === '3months') { barGapFrac = 0.12; barRx = 12; }
    // bars-month
    else if (_period === 'month')   { barGapFrac = 0.22; barRx = 16; }
    // bars-year
    else                            { barGapFrac = 0.22; barRx = 14; }

    // Clear container
    container.innerHTML = '';

    // Handle empty data
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: #DFE4EB; text-align: center; padding: 40px;">No data available for this period.</p>';
        return;
    }

    // Narrower viewBox → each unit maps to more screen pixels → everything renders larger
    const width = 700;
    const height = 380;
    const padding = { top: 30, right: 50, bottom: 80, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const baseline = 4;

    const barGroupWidth = chartWidth / data.length;

    // Create SVG
    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        class: 'chart-svg'
    });

    // Add glow filter
    const defs = createSVGElement('defs');
    const filter = createSVGElement('filter', { id: `glow-${containerId}` });
    filter.innerHTML = `
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    `;
    defs.appendChild(filter);
    svg.appendChild(defs);

    // Main chart group
    const chartGroup = createSVGElement('g', {
        transform: `translate(${padding.left}, ${padding.top})`
    });

    // Draw Y-axis scale (1-7)
    for (let i = 1; i <= 7; i++) {
        const y = chartHeight - ((i - 1) / 6) * chartHeight;

        // Grid line
        const gridLine = createSVGElement('line', {
            x1: 0,
            y1: y,
            x2: chartWidth,
            y2: y,
            stroke: i === baseline ? 'rgba(244,227,179,0.3)' : 'rgba(255,255,255,0.05)',
            'stroke-width': i === baseline ? 2 : 1,
            'stroke-dasharray': i === baseline ? '5,5' : 'none'
        });
        chartGroup.appendChild(gridLine);

        // Y-axis label
        const label = createSVGElement('text', {
            x: -10,
            y: y + 4,
            fill: '#DFE4EB',
            'font-size': '14',
            'text-anchor': 'end'
        });
        label.textContent = i;
        chartGroup.appendChild(label);
    }

    // Baseline reference line
    const baselineY = chartHeight - ((baseline - 1) / 6) * chartHeight;
    const baselineLine = createSVGElement('line', {
        x1: -5,
        y1: baselineY,
        x2: chartWidth + 5,
        y2: baselineY,
        stroke: 'rgba(244,227,179,0.5)',
        'stroke-width': 2
    });
    chartGroup.appendChild(baselineLine);

    // Calculate stagger delay to fit animation within fixed duration (1.2s total)
    // For large datasets (>30 points), use shorter total duration to avoid tiny delays
    const totalAnimationDuration = data.length > 30 ? 0.8 : 1.2; // seconds
    const calculatedDelay = data.length > 1 ? totalAnimationDuration / data.length : 0;
    // Ensure minimum delay of 0.01s to prevent animation issues
    const staggerDelay = Math.max(calculatedDelay, 0.01);

    // Draw bars for each data point
    data.forEach((entry, index) => {
        const x = (index / data.length) * chartWidth + barGroupWidth / 2;

        const highest = entry[metric]?.highest || baseline;
        const lowest = entry[metric]?.lowest || baseline;

        const barGroup = createSVGElement('g', {
            class: 'bar-group',
            'data-date': entry.date
        });

        // Single bar representing range from lowest to highest
        const unitHeight = chartHeight / 6;
        const lowestY = chartHeight - ((lowest - 1) / 6) * chartHeight;
        const highestY = chartHeight - ((highest - 1) / 6) * chartHeight;
        const barHeight = Math.abs(lowestY - highestY);
        const barY = Math.min(lowestY, highestY);

        // Determine color based on average position relative to baseline
        const average = (highest + lowest) / 2;
        const isAboveBaseline = average >= baseline;
        const barTopColor = isAboveBaseline ? colorHigh : colorHighNeg;
        const barBottomColor = isAboveBaseline ? colorLow : colorLowNeg;

        // Create gradient for the bar
        const gradientId = 'bar-gradient-' + containerId + '-' + index;
        const gradient = createSVGElement('linearGradient', {
            id: gradientId,
            x1: '0%',
            y1: '0%',
            x2: '0%',
            y2: '100%'
        });
        gradient.innerHTML = `
            <stop offset="0%" style="stop-color:${barTopColor};stop-opacity:0.92" />
            <stop offset="100%" style="stop-color:${barBottomColor};stop-opacity:0.78" />
        `;

        // Add gradient to defs if not exists
        let chartDefs = svg.querySelector('defs');
        if (!chartDefs) {
            chartDefs = createSVGElement('defs');
            svg.insertBefore(chartDefs, svg.firstChild);
        }
        chartDefs.appendChild(gradient);

        // Two-layer bar: outer outline + inner translucent fill (true inside-outline look)
        const outerX = x - barGroupWidth / 2 + barGroupWidth * barGapFrac / 2;
        const outerY = barY;
        const outerW = Math.max(barGroupWidth * (1 - barGapFrac), 2);
        const outerH = Math.max(barHeight, 3);
        const inset = entry.isMissing ? 1.2 : 2.4;

        const barOutline = createSVGElement('rect', {
            x: outerX,
            y: outerY,
            width: outerW,
            height: outerH,
            fill: 'none',
            stroke: entry.isMissing ? 'rgba(255,255,255,0.2)' : outlineColor,
            'stroke-width': entry.isMissing ? 1 : 2.4,
            'stroke-dasharray': entry.isMissing ? '3,3' : 'none',
            rx: barRx,
            ry: barRx,
            class: 'chart-bar',
            style: 'pointer-events: none; opacity: 0; -webkit-animation-delay: ' + (index * staggerDelay) + 's; animation-delay: ' + (index * staggerDelay) + 's;'
        });

        const bar = createSVGElement('rect', {
            x: outerX + inset,
            y: outerY + inset,
            width: Math.max(outerW - inset * 2, 2),
            height: Math.max(outerH - inset * 2, 3),
            fill: 'url(#' + gradientId + ')',
            stroke: 'none',
            rx: Math.max(barRx - 2, 2),
            ry: Math.max(barRx - 2, 2),
            class: 'chart-bar',
            style: 'cursor: pointer; filter: url(#glow-' + containerId + ') drop-shadow(0 0 10px rgba(237,191,231,0.35)) drop-shadow(0 2px 4px rgba(0,0,0,0.2)); opacity: 0; -webkit-animation-delay: ' + (index * staggerDelay) + 's; animation-delay: ' + (index * staggerDelay) + 's;'
        });

        bar.addEventListener('mouseenter', (e) => {
            showTooltip(e, entry, metric, containerId);
        });
        bar.addEventListener('mouseleave', hideTooltip);

        barGroup.appendChild(barOutline);
        barGroup.appendChild(bar);
        chartGroup.appendChild(barGroup);

        // X-axis label (date)
        if (data.length <= 31) {
            // Show all labels for month view or less
            const labelX = x;
            const labelY = chartHeight + 20;
            const dateLabel = createSVGElement('text', {
                x: labelX,
                y: labelY,
                fill: entry.isMissing ? '#888' : '#DFE4EB',
                'font-size': '13',
                'text-anchor': 'middle',
                transform: `rotate(-45, ${labelX}, ${labelY})`
            });
            dateLabel.textContent = formatDate(entry.date, 'M/D');
            chartGroup.appendChild(dateLabel);
        } else if (index % Math.ceil(data.length / 20) === 0) {
            // Show every Nth label for longer ranges
            const labelX = x;
            const labelY = chartHeight + 20;
            const dateLabel = createSVGElement('text', {
                x: labelX,
                y: labelY,
                fill: '#DFE4EB',
                'font-size': '12',
                'text-anchor': 'middle',
                transform: `rotate(-45, ${labelX}, ${labelY})`
            });
            dateLabel.textContent = formatDate(entry.date, 'MMM DD');
            chartGroup.appendChild(dateLabel);
        }
    });

    svg.appendChild(chartGroup);
    container.appendChild(svg);
}

/**
 * Create a single bar element
 */
function createBarElement(x, baseY, width, normalizedValue, unitHeight, color, isMissing) {
    const height = Math.abs(normalizedValue) * unitHeight;
    const y = normalizedValue >= 0 ? baseY - height : baseY;

    return createSVGElement('rect', {
        x: x,
        y: y,
        width: width,
        height: height,
        fill: color,
        'stroke': isMissing ? 'rgba(255,255,255,0.2)' : 'none',
        'stroke-dasharray': isMissing ? '3,3' : 'none',
        rx: 10,
        ry: 10
    });
}

/**
 * Render line chart for anxiety or irritability
 * @param {string} containerId - ID of container element
 * @param {Array} data - Array of data entries
 * @param {Object} options - Chart options (metric, color, etc.)
 */
function renderLineChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const {
        metric = 'anxiety', // 'anxiety' or 'irritability'
        color = 'rgba(244,227,179,0.8)',
        fillColor = 'rgba(244,227,179,0.2)'
    } = options;

    // Aggregate into weekly/monthly averages for longer periods
    var _period2 = (typeof AnalyticsState !== 'undefined') ? AnalyticsState.currentPeriod : 'week';
    if (_period2 === '3months') data = _aggregateByDays(data, 7);
    else if (_period2 === 'year') data = _aggregateByMonth(data);

    // Clear container
    container.innerHTML = '';

    // Handle empty data
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: #DFE4EB; text-align: center; padding: 40px;">No data available for this period.</p>';
        return;
    }

    // Chart dimensions
    const width = 700;
    const height = 380;
    const padding = { top: 30, right: 50, bottom: 80, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Create SVG
    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        class: 'chart-svg'
    });

    // Add glow filter
    const defs = createSVGElement('defs');
    const filter = createSVGElement('filter', { id: `glow-line-${containerId}` });
    filter.innerHTML = `
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    `;
    const gradient = createSVGElement('linearGradient', {
        id: `gradient-${containerId}`,
        x1: '0%',
        y1: '0%',
        x2: '0%',
        y2: '100%'
    });
    gradient.innerHTML = `
        <stop offset="0%" style="stop-color:${fillColor};stop-opacity:0.4" />
        <stop offset="100%" style="stop-color:${fillColor};stop-opacity:0" />
    `;
    defs.appendChild(filter);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Main chart group
    const chartGroup = createSVGElement('g', {
        transform: `translate(${padding.left}, ${padding.top})`
    });

    // Draw Y-axis scale (1-7)
    for (let i = 1; i <= 7; i++) {
        const y = chartHeight - ((i - 1) / 6) * chartHeight;

        // Grid line
        const gridLine = createSVGElement('line', {
            x1: 0,
            y1: y,
            x2: chartWidth,
            y2: y,
            stroke: 'rgba(255,255,255,0.05)',
            'stroke-width': 1
        });
        chartGroup.appendChild(gridLine);

        // Y-axis label
        const label = createSVGElement('text', {
            x: -10,
            y: y + 4,
            fill: '#DFE4EB',
            'font-size': '14',
            'text-anchor': 'end'
        });
        label.textContent = i;
        chartGroup.appendChild(label);
    }

    // Calculate stagger delay to fit animation within fixed duration (1.2s total)
    // For large datasets (>30 points), use shorter total duration to avoid tiny delays
    const totalAnimationDuration = data.length > 30 ? 0.8 : 1.2; // seconds
    const calculatedDelay = data.length > 1 ? totalAnimationDuration / data.length : 0;
    // Ensure minimum delay of 0.01s to prevent animation issues
    const staggerDelay = Math.max(calculatedDelay, 0.01);

    // Calculate points
    const points = data.map((entry, index) => {
        const x = data.length > 1 ? (index / (data.length - 1)) * chartWidth : chartWidth / 2;
        const value = entry[metric] || 4;
        const y = chartHeight - ((value - 1) / 6) * chartHeight;
        return { x, y, value, date: entry.date, isMissing: entry.isMissing };
    });

    // Create smooth curve path
    const pathData = createSmoothPath(points);
    const linePath = createSVGElement('path', {
        d: pathData,
        stroke: color,
        'stroke-width': 3,
        fill: 'none',
        filter: `url(#glow-line-${containerId})`,
        class: 'chart-line',
        style: 'opacity: 0;'
    });
    chartGroup.appendChild(linePath);

    // Create fill area under line
    const fillPathData = `${pathData} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
    const fillPath = createSVGElement('path', {
        d: fillPathData,
        fill: `url(#gradient-${containerId})`,
        stroke: 'none'
    });
    chartGroup.insertBefore(fillPath, linePath);

    // Add data points - LARGER
    points.forEach((point, index) => {
        const circle = createSVGElement('circle', {
            cx: point.x,
            cy: point.y,
            r: point.isMissing ? 4 : 7,
            fill: point.isMissing ? 'rgba(255,255,255,0.3)' : color,
            stroke: point.isMissing ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.5)',
            'stroke-width': point.isMissing ? 1 : 3,
            filter: point.isMissing ? 'none' : `url(#glow-line-${containerId})`,
            class: 'chart-point',
            style: 'cursor: pointer; opacity: 0; -webkit-animation-delay: ' + (index * staggerDelay) + 's; animation-delay: ' + (index * staggerDelay) + 's;'
        });

        circle.addEventListener('mouseenter', (e) => {
            showTooltip(e, data[index], metric, containerId);
        });
        circle.addEventListener('mouseleave', hideTooltip);

        chartGroup.appendChild(circle);

        // X-axis label (date)
        if (data.length <= 31) {
            const labelX = point.x;
            const labelY = chartHeight + 20;
            const dateLabel = createSVGElement('text', {
                x: labelX,
                y: labelY,
                fill: point.isMissing ? '#888' : '#DFE4EB',
                'font-size': '13',
                'text-anchor': 'middle',
                transform: `rotate(-45, ${labelX}, ${labelY})`
            });
            dateLabel.textContent = formatDate(data[index].date, 'M/D');
            chartGroup.appendChild(dateLabel);
        } else if (index % Math.ceil(data.length / 20) === 0) {
            const labelX = point.x;
            const labelY = chartHeight + 20;
            const dateLabel = createSVGElement('text', {
                x: labelX,
                y: labelY,
                fill: '#DFE4EB',
                'font-size': '12',
                'text-anchor': 'middle',
                transform: `rotate(-45, ${labelX}, ${labelY})`
            });
            dateLabel.textContent = formatDate(data[index].date, 'MMM DD');
            chartGroup.appendChild(dateLabel);
        }
    });

    svg.appendChild(chartGroup);
    container.appendChild(svg);
}

/**
 * Create smooth curve path from points using quadratic bezier
 */
function createSmoothPath(points) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];

        // Control point for smooth curve
        const cpX = (current.x + next.x) / 2;
        const cpY = (current.y + next.y) / 2;

        path += ` Q ${current.x} ${current.y}, ${cpX} ${cpY}`;
    }

    // Add final point
    const last = points[points.length - 1];
    path += ` T ${last.x} ${last.y}`;

    return path;
}

/**
 * Show tooltip on hover
 */
function showTooltip(event, entry, metric, containerId) {
    hideTooltip(); // Hide any existing tooltip

    const tooltip = document.createElement('div');
    tooltip.id = 'chart-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        background:
            linear-gradient(165deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06) 58%, rgba(255,255,255,0.02)),
            linear-gradient(135deg, rgba(20,20,31,0.88), rgba(15,22,29,0.86));
        -webkit-backdrop-filter: blur(16px) saturate(140%);
        backdrop-filter: blur(16px) saturate(140%);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 16px;
        padding: 11px 15px;
        color: #DFE4EB;
        font-size: 13px;
        pointer-events: none;
        z-index: 10000;
        box-shadow: 0 14px 28px rgba(5, 12, 28, 0.42), inset 0 1px 0 rgba(255,255,255,0.28);
    `;

    let content = `<div style="margin-bottom: 4px; color: #EDBFE7; font-weight: bold;">${formatDate(entry.date, 'MMM DD')}</div>`;

    if (metric === 'energy' || metric === 'mood') {
        const highest = entry[metric]?.highest || 4;
        const lowest = entry[metric]?.lowest || 4;
        content += `<div>Highest: ${highest}/7</div>`;
        content += `<div>Lowest: ${lowest}/7</div>`;
    } else {
        const value = entry[metric] || 4;
        content += `<div>Level: ${value}/7</div>`;
    }

    if (entry.isMissing) {
        content += `<div style="color: #888; font-size: 11px; margin-top: 4px;">No data</div>`;
    }

    tooltip.innerHTML = content;
    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = `${event.clientX - rect.width / 2}px`;
    tooltip.style.top = `${event.clientY - rect.height - 10}px`;
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    const tooltip = document.getElementById('chart-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

/* ── Jar live-physics ────────────────────────────────────────────────────── */

/** Gravity vector (px/frame²) — updated by device-orientation listener */
var _jarMobile = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
var _jarGravity = { x: 0, y: _jarMobile ? 0.45 : 0.25 };
var _jarOrientationInited = false;

/**
 * One-time setup for DeviceOrientation → gravity.
 * Must be called from inside a user-gesture handler (iOS 13+ permission).
 */
function _initJarOrientation() {
    if (_jarOrientationInited) return;
    _jarOrientationInited = true;
    if (typeof DeviceOrientationEvent === 'undefined') return;
    function handle(e) {
        var g = e.gamma || 0;                               // left/right tilt  –90…+90  (degrees)
        var b = e.beta != null ? e.beta : 90;               // forward tilt     –180…+180 (degrees)
        var gammaRad = g * Math.PI / 180;
        var betaRad  = b * Math.PI / 180;
        var scale = _jarMobile ? 0.45 : 0.25;
        // sin() projection: gy = +scale when upright (beta=90°), 0 when flat, −scale when upside down
        // gx = 0 when level, ±scale when fully sideways (gamma=±90°)
        _jarGravity.x = scale * Math.sin(gammaRad);
        _jarGravity.y = scale * Math.sin(betaRad);
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ — requestPermission must run inside a user gesture
        DeviceOrientationEvent.requestPermission()
            .then(function(r) { if (r === 'granted') window.addEventListener('deviceorientation', handle); })
            .catch(function() {});
    } else {
        window.addEventListener('deviceorientation', handle);
    }
}

/** Cancel a running physics instance (safe to call with null). */
function _destroyJarPhysics(ph) {
    if (!ph) return;
    ph.active = false;
    if (ph.rafId)     { cancelAnimationFrame(ph.rafId); ph.rafId = null; }
    if (ph.timeoutId) { clearTimeout(ph.timeoutId);     ph.timeoutId = null; }
}

/** Apply a random velocity burst to all particles (shake effect). */
function _shakeJar(ph) {
    if (!ph || !ph.active) return;
    ph.particles.forEach(function(p) {
        p.vx   += (Math.random() - 0.5) * 10;
        p.vy   += (Math.random() - 0.5) * 10 - 3; // slight upward bias
        p.rvel += (Math.random() - 0.5) * 12;      // spin burst on shake
    });
}

/**
 * Start a live physics simulation for jar stars.
 * Waits for the CSS fall animation to finish, then drives star positions via JS.
 * Uses CSS transform (composited) instead of left/top for better performance.
 *
 * @param {HTMLElement}   jarBody    - the .jar-body div
 * @param {Array<{x,y}>} positions  - initial star centre positions from gravityPack
 * @param {number}        R         - star radius (px)
 * @param {number}        W         - jar body width  (px, must match CSS)
 * @param {number}        H         - jar body height (px, must match CSS)
 * @returns physics-state object (pass to _destroyJarPhysics / _shakeJar)
 */
function _initJarPhysics(jarBody, positions, R, W, H, PAD) {
    PAD = PAD || 0;
    var starEls = Array.prototype.slice.call(jarBody.querySelectorAll('.jar-star'));
    if (!starEls.length) return null;

    var particles = starEls.map(function(el, i) {
        var pos = positions[i] || { x: W * 0.5, y: H - R };
        return { el: el, x: pos.x, y: pos.y, vx: 0, vy: 0,
                 rot: 0, rvel: 0 };
    });

    // Find when the last CSS animation ends
    var maxEnd = 0;
    starEls.forEach(function(el) {
        var d = parseFloat(el.style.animationDelay || 0);
        if (d + 0.55 > maxEnd) maxEnd = d + 0.55;
    });

    var ph = { particles: particles, active: false, rafId: null, timeoutId: null };

    ph.timeoutId = setTimeout(function() {
        // Switch star positioning from CSS animation → JS transform
        starEls.forEach(function(el, i) {
            var pos = positions[i] || { x: W * 0.5, y: H - R };
            el.style.animation        = 'none';
            el.style.webkitAnimation  = 'none';
            el.style.opacity          = '0.78';
            // Reset left/top to 0; transform will handle the position
            el.style.left = '0';
            el.style.top  = '0';
            var tx = 'translate(' + (pos.x - R) + 'px,' + (pos.y - R) + 'px) rotate(0deg)';
            el.style.transform        = tx;
            el.style.webkitTransform  = tx;
        });

        ph.active = true;
        var minDist = 2 * R + 1;
        var xMin = R + PAD, xMax = W - R - PAD;
        var yMin = R + PAD, yMax = H - R - PAD;

        // Pre-settle: resolve any initial overlaps synchronously before first paint.
        // Runs pure position-correction (no velocity) so the first rendered frame is clean.
        (function preSolve() {
            var ps = particles, pn = ps.length;
            for (var iter = 0; iter < 100; iter++) {
                var anyOverlap = false;
                for (var pi = 0; pi < pn - 1; pi++) {
                    for (var pj = pi + 1; pj < pn; pj++) {
                        var pdx = ps[pj].x - ps[pi].x, pdy = ps[pj].y - ps[pi].y;
                        var pd2 = pdx * pdx + pdy * pdy;
                        if (pd2 < minDist * minDist && pd2 > 0.001) {
                            anyOverlap = true;
                            var pd = Math.sqrt(pd2);
                            var pnx = pdx / pd, pny = pdy / pd;
                            var pov = (minDist - pd) * 0.52;
                            ps[pi].x -= pnx * pov; ps[pi].y -= pny * pov;
                            ps[pj].x += pnx * pov; ps[pj].y += pny * pov;
                            if (ps[pi].x < xMin) ps[pi].x = xMin; if (ps[pi].x > xMax) ps[pi].x = xMax;
                            if (ps[pi].y < yMin) ps[pi].y = yMin; if (ps[pi].y > yMax) ps[pi].y = yMax;
                            if (ps[pj].x < xMin) ps[pj].x = xMin; if (ps[pj].x > xMax) ps[pj].x = xMax;
                            if (ps[pj].y < yMin) ps[pj].y = yMin; if (ps[pj].y > yMax) ps[pj].y = yMax;
                        }
                    }
                }
                if (!anyOverlap) break; // converged early
            }
            // Apply settled positions to DOM immediately (before RAF starts)
            particles.forEach(function(pt) {
                var tx = 'translate(' + (pt.x - R) + 'px,' + (pt.y - R) + 'px) rotate(0deg)';
                pt.el.style.transform = pt.el.style.webkitTransform = tx;
            });
        }());

        function tick() {
            if (!ph.active) return;
            // Auto-stop when jar is removed from DOM (tab switch, etc.)
            if (!jarBody.isConnected) { ph.active = false; return; }
            var p = ph.particles, n = p.length;
            var gx = _jarGravity.x, gy = _jarGravity.y;

            // Gravity + friction damping; also advance rotation this frame
            for (var i = 0; i < n; i++) {
                p[i].vx   = (p[i].vx + gx) * 0.94;
                p[i].vy   = (p[i].vy + gy) * 0.94;
                p[i].x   += p[i].vx;
                p[i].y   += p[i].vy;
                p[i].rvel *= 0.975; // angular damping — fades slightly slower than translation
                p[i].rot  += p[i].rvel;
            }

            // Wall collisions — low bounce + spin from the sliding velocity component
            for (var i = 0; i < n; i++) {
                if (p[i].x < xMin) { p[i].x = xMin; p[i].vx = Math.abs(p[i].vx) < 0.3 ? 0 :  Math.abs(p[i].vx) * 0.4; }
                if (p[i].x > xMax) { p[i].x = xMax; p[i].vx = Math.abs(p[i].vx) < 0.3 ? 0 : -Math.abs(p[i].vx) * 0.4; }
                if (p[i].y < yMin) { p[i].y = yMin; p[i].vy = Math.abs(p[i].vy) < 0.3 ? 0 :  Math.abs(p[i].vy) * 0.4; }
                if (p[i].y > yMax) { p[i].y = yMax; p[i].vy = Math.abs(p[i].vy) < 0.3 ? 0 : -Math.abs(p[i].vy) * 0.4; }
            }

            // Star-star collision — 4 position-correction passes + 1 velocity impulse.
            // Multiple passes are essential for dense packs: one pass leaves residual
            // overlaps that the next frame's gravity immediately recreates.
            for (var iter = 0; iter < 4; iter++) {
                for (var i = 0; i < n - 1; i++) {
                    for (var j = i + 1; j < n; j++) {
                        var dx = p[j].x - p[i].x, dy = p[j].y - p[i].y;
                        var d2 = dx * dx + dy * dy;
                        if (d2 < minDist * minDist && d2 > 0.001) {
                            var d  = Math.sqrt(d2);
                            var nx = dx / d, ny = dy / d;
                            var ov = (minDist - d) * 0.52;
                            p[i].x -= nx * ov; p[i].y -= ny * ov;
                            p[j].x += nx * ov; p[j].y += ny * ov;
                            // Velocity + spin impulse only on first pass
                            if (iter === 0) {
                                var imp = (p[i].vx - p[j].vx) * nx + (p[i].vy - p[j].vy) * ny;
                                if (imp > 0) {
                                    p[i].vx -= 0.45 * imp * nx; p[i].vy -= 0.45 * imp * ny;
                                    p[j].vx += 0.45 * imp * nx; p[j].vy += 0.45 * imp * ny;
                                }
                            }
                        }
                    }
                }
            }

            // Write position + rotation via composited transform (no layout triggers)
            for (var i = 0; i < n; i++) {
                var tx = 'translate(' + (p[i].x - R) + 'px,' + (p[i].y - R) + 'px) rotate(' + p[i].rot + 'deg)';
                p[i].el.style.transform       = tx;
                p[i].el.style.webkitTransform = tx;
            }

            ph.rafId = requestAnimationFrame(tick);
        }

        ph.rafId = requestAnimationFrame(tick);
    }, (maxEnd + 0.15) * 1000);

    return ph;
}

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Gravity-based circle packing simulation.
 * Stars fall from the top one at a time and settle on the floor or on each other.
 * @param {number} n      - number of circles to pack
 * @param {number} w      - container width  (px)
 * @param {number} h      - container height (px)
 * @param {number} r      - circle radius    (px)
 * @returns {Array<{x,y}>} center positions
 */
function gravityPack(n, w, h, r) {
    var circles = [];
    var minDist = 2 * r + 2; // comfortable gap — reduces initial overlap for physics to resolve

    for (var i = 0; i < n; i++) {
        var placed = false;

        for (var attempt = 0; attempt < 40 && !placed; attempt++) {
            // Random horizontal start, fall from top
            var cx = r + Math.random() * (w - 2 * r);
            var cy = r;
            var prevCy = r;

            // Step downward until blocked
            for (var s = 0; s < h * 2; s++) {
                prevCy = cy;
                cy += 0.6;

                // Floor
                if (cy >= h - r) { cy = h - r; break; }

                // Other circles
                var hit = false;
                for (var j = 0; j < circles.length; j++) {
                    var dx = cx - circles[j].x;
                    var dy = cy - circles[j].y;
                    if (dx * dx + dy * dy < minDist * minDist) {
                        cy = prevCy;
                        hit = true;
                        break;
                    }
                }
                if (hit) break;
            }

            // Validate — no overlap
            var ok = cy >= r && cy <= h - r;
            for (var k = 0; k < circles.length && ok; k++) {
                var dx2 = cx - circles[k].x;
                var dy2 = cy - circles[k].y;
                if (dx2 * dx2 + dy2 * dy2 < minDist * minDist) ok = false;
            }

            if (ok) { circles.push({ x: cx, y: cy }); placed = true; }
        }

        // Fallback: grid using the same minDist so fallback positions never overlap
        if (!placed) {
            var gcols = Math.max(1, Math.floor((w - 2 * r) / minDist) + 1);
            var grows = Math.max(1, Math.floor((h - 2 * r) / minDist) + 1);
            circles.push({
                x: r + (i % gcols) * minDist,
                y: h - r - (Math.floor(i / gcols) % grows) * minDist
            });
        }
    }
    return circles;
}

/**
 * Render jar chart for activities or people
 * One shaker jar per chart, all tags as mixed colored stars inside
 * @param {string} containerId - ID of container element
 * @param {Array} data - Array of data entries
 * @param {string} field - 'activities' or 'people'
 */
function renderPieChart(containerId, data, field) {
    var container = document.getElementById(containerId);
    if (!container) return;
    // Destroy previous physics loop before clearing DOM
    if (container._jarPhysics) {
        _destroyJarPhysics(container._jarPhysics);
        container._jarPhysics = null;
    }
    container.innerHTML = '';

    // Count occurrences
    var counts = {};
    for (var i = 0; i < data.length; i++) {
        var entry = data[i];
        if (entry[field] && Array.isArray(entry[field])) {
            for (var j = 0; j < entry[field].length; j++) {
                var item = entry[field][j];
                counts[item] = (counts[item] || 0) + 1;
            }
        }
    }

    var items = Object.keys(counts);
    if (items.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No ' + field + ' recorded in this period.</p>';
        return;
    }

    items.sort(function(a, b) { return counts[b] - counts[a]; });

    // 8-color palette (hue-rotate on star3.svg)
    var starFilters = [
        'hue-rotate(0deg)   saturate(1.3) brightness(1.1)',   // pink
        'hue-rotate(40deg)  saturate(1.4) brightness(1.1)',   // orange
        'hue-rotate(65deg)  saturate(1.3) brightness(1.15)',  // yellow
        'hue-rotate(120deg) saturate(1.3) brightness(1.1)',   // green
        'hue-rotate(175deg) saturate(1.4) brightness(1.1)',   // cyan
        'hue-rotate(210deg) saturate(1.4) brightness(1.1)',   // blue
        'hue-rotate(270deg) saturate(1.3) brightness(1.1)',   // purple
        'hue-rotate(315deg) saturate(1.4) brightness(1.15)',  // magenta
    ];

    var tagFilters = {};
    items.forEach(function(item, idx) {
        tagFilters[item] = starFilters[idx % starFilters.length];
    });

    // Star pool — size depends on the selected time period
    var period = (typeof AnalyticsState !== 'undefined') ? AnalyticsState.currentPeriod : 'week';
    var totalCount = items.reduce(function(s, item) { return s + counts[item]; }, 0);
    var allocated = {};
    var poolSize, big;

    if (period === 'week') {
        // 1 : 1  — one star per tag occurrence.
        // Cap at 20: physics inner area is 100×110 px with R=9;
        // hex-packing maximum ≈ 35, so 20 stays well clear and never overlaps.
        items.forEach(function(item) { allocated[item] = counts[item]; });
        poolSize = totalCount;
        while (poolSize > 20) {
            big = items.reduce(function(a, b) { return allocated[a] > allocated[b] ? a : b; });
            allocated[big]--; poolSize--;
        }
    } else {
        // Proportional — well below hex-pack limit so pre-settle always converges.
        // 3 months: 26 stars  |  year: 32 stars
        var MAX_STARS = period === 'year' ? 32 : 26; // year=32, 3months=26
        items.forEach(function(item) {
            allocated[item] = Math.max(1, Math.round(counts[item] / totalCount * MAX_STARS));
        });
        poolSize = items.reduce(function(s, item) { return s + allocated[item]; }, 0);
        while (poolSize > MAX_STARS) {
            big = items.reduce(function(a, b) { return allocated[a] > allocated[b] ? a : b; });
            allocated[big]--; poolSize--;
        }
    }

    // Build + shuffle pool (Fisher-Yates)
    var starPool = [];
    items.forEach(function(item) {
        for (var k = 0; k < allocated[item]; k++) starPool.push(tagFilters[item]);
    });
    for (var si = starPool.length - 1; si > 0; si--) {
        var sj = Math.floor(Math.random() * (si + 1));
        var tmp = starPool[si]; starPool[si] = starPool[sj]; starPool[sj] = tmp;
    }

    // CSS jar body dimensions (must match .jar-body in analytics.css)
    var JAR_BODY_W = 130;
    var JAR_BODY_H = 140;
    var STAR_R = 9;             // physics radius — star image is 2*R = 18px
    var STAR_SIZE = STAR_R * 2;
    var PHYS_PAD = 6;           // inner margin so stars never touch the glass walls

    // Gravity-pack into the padded inner area, then offset to jar coordinates
    var rawPos = gravityPack(starPool.length, JAR_BODY_W - 2 * PHYS_PAD, JAR_BODY_H - 2 * PHYS_PAD, STAR_R);
    var positions = rawPos.map(function(p) { return { x: p.x + PHYS_PAD, y: p.y + PHYS_PAD }; });

    // Container: centered column
    container.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px 0 20px;';

    // Jar: lid + glass body (pure CSS — no SVG image needed)
    var jarShaker = document.createElement('div');
    jarShaker.className = 'jar-shaker';

    var jarLid = document.createElement('div');
    jarLid.className = 'jar-lid';

    var jarBody = document.createElement('div');
    jarBody.className = 'jar-body';

    // Place stars at physics-computed positions
    starPool.forEach(function(filterStyle, s) {
        var pos = positions[s] || { x: STAR_R, y: JAR_BODY_H - STAR_R };
        var delay = 0.05 + s * 0.04;
        var startRot = Math.floor(Math.random() * 50) - 25; // –25 … +25 deg

        var star = document.createElement('img');
        star.src = '../star3.svg';
        star.className = 'jar-star';
        star.style.cssText = [
            'position: absolute',
            'width: '  + STAR_SIZE + 'px',
            'height: ' + STAR_SIZE + 'px',
            'left: '   + (pos.x - STAR_R) + 'px',
            'top: '    + (pos.y - STAR_R) + 'px',
            'filter: ' + filterStyle,
            'opacity: 0',
            '-webkit-animation-delay: ' + delay + 's',
            'animation-delay: '         + delay + 's',
        ].join('; ');
        // CSS custom property for per-star random start rotation
        star.style.setProperty('--startRot', startRot + 'deg');
        jarBody.appendChild(star);
    });

    jarShaker.appendChild(jarLid);
    jarShaker.appendChild(jarBody);

    // Click/tap: request orientation permission (iOS 13+) + shake stars
    jarShaker.addEventListener('click', function() {
        _initJarOrientation();
        _shakeJar(container._jarPhysics);
        // Brief visual tap feedback on the jar wrapper
        jarShaker.classList.add('shaking');
        setTimeout(function() { jarShaker.classList.remove('shaking'); }, 460);
    });

    container.appendChild(jarShaker);

    // Legend: colored star icon + "tag ×count"
    var legend = document.createElement('div');
    legend.className = 'jar-legend';
    items.forEach(function(item) {
        var li = document.createElement('div');
        li.className = 'jar-legend-item';

        var dot = document.createElement('img');
        dot.src = '../star3.svg';
        dot.style.cssText = 'width: 13px; height: 13px; flex-shrink: 0; filter: ' + tagFilters[item] + ';';

        var label = document.createElement('span');
        label.textContent = item + ' \u00d7' + counts[item];

        li.appendChild(dot);
        li.appendChild(label);
        legend.appendChild(li);
    });
    container.appendChild(legend);

    // Start live physics — takes over star positions after CSS fall animation
    container._jarPhysics = _initJarPhysics(jarBody, positions, STAR_R, JAR_BODY_W, JAR_BODY_H, PHYS_PAD);
}

/**
 * Render horizontal bar chart for sleep hours (timeline based)
 * @param {string} containerId - ID of container element
 * @param {Array} data - Array of data entries with sleep arrays
 */
function renderSleepBarChart(containerId, data) {
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No data available for this period.</p>';
        return;
    }

    // Process sleep data — aggregate for longer periods
    var _slPeriod = (typeof AnalyticsState !== 'undefined') ? AnalyticsState.currentPeriod : 'week';
    var sleepDataProcessed;
    if (_slPeriod === 'year') {
        sleepDataProcessed = _aggregateSleepByMonth(data);
    } else if (_slPeriod === '3months') {
        sleepDataProcessed = _aggregateSleepRaw(data, 7);
    } else {
        sleepDataProcessed = [];
        for (var i = 0; i < data.length; i++) {
            var entry = data[i];
            if (!entry.isMissing && entry.sleep && Array.isArray(entry.sleep)) {
                var analysis = analyzeSleepData(entry.sleep);
                if (analysis.duration > 0) {
                    sleepDataProcessed.push({
                        date: entry.date,
                        duration: analysis.duration,
                        bedtime: analysis.bedtime,
                        wakeTime: analysis.wakeTime,
                        hasNaps: analysis.hasNaps,
                        napCount: analysis.napCount,
                        bedtimeMinutes: timeToMinutes(analysis.bedtime),
                        wakeTimeMinutes: timeToMinutes(analysis.wakeTime)
                    });
                }
            }
        }
    }

    if (sleepDataProcessed.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No sleep data recorded in this period.</p>';
        return;
    }

    // Chart dimensions - LARGER
    var width = 1000;
    var barHeight = 54;
    var barGap = 14;
    var padding = { top: 30, right: 115, bottom: 60, left: 95 };
    var height = padding.top + padding.bottom + (sleepDataProcessed.length * (barHeight + barGap));

    var chartWidth = width - padding.left - padding.right;

    // Create SVG
    var svg = createSVGElement('svg', {
        viewBox: '0 0 ' + width + ' ' + height,
        class: 'chart-svg'
    });

    // Create gradient
    var defs = createSVGElement('defs');
    var sleepGradient = createSVGElement('linearGradient', {
        id: 'sleepGradient-' + containerId,
        x1: '0%',
        y1: '0%',
        x2: '100%',
        y2: '0%'
    });
    sleepGradient.innerHTML = '<stop offset="0%" style="stop-color:rgba(168,230,217,0.9);stop-opacity:1" />' +
                              '<stop offset="100%" style="stop-color:rgba(168,230,217,0.7);stop-opacity:1" />';
    var sleepGlow = createSVGElement('filter', { id: 'glow-sleep-' + containerId });
    sleepGlow.innerHTML = '<feGaussianBlur stdDeviation="2" result="coloredBlur"/>' +
                          '<feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>';
    defs.appendChild(sleepGradient);
    defs.appendChild(sleepGlow);
    svg.appendChild(defs);

    var chartGroup = createSVGElement('g', {
        transform: 'translate(' + padding.left + ', ' + padding.top + ')'
    });

    // 24-hour timeline (00:00 to 24:00)
    var hoursInDay = 24;

    // Helper function to convert time to minutes
    function timeToMinutes(timeStr) {
        var parts = timeStr.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }

    // Calculate stagger delay to fit animation within fixed duration (1.2s total)
    var totalAnimationDuration = 1.2; // seconds
    var sleepStaggerDelay = sleepDataProcessed.length > 1 ? totalAnimationDuration / sleepDataProcessed.length : 0;

    // Draw bars
    for (var j = 0; j < sleepDataProcessed.length; j++) {
        var item = sleepDataProcessed[j];
        var y = j * (barHeight + barGap);

        // Background bar (24-hour timeline)
        var bgBar = createSVGElement('rect', {
            x: 0,
            y: y,
            width: chartWidth,
            height: barHeight,
            fill: 'rgba(255,255,255,0.02)',
            stroke: 'rgba(255,255,255,0.05)',
            'stroke-width': 1,
            rx: 18,
            ry: 18
        });
        chartGroup.appendChild(bgBar);

        // Calculate bar position and width based on bedtime and wake time
        var bedMinutes = item.bedtimeMinutes;
        var wakeMinutes = item.wakeTimeMinutes;

        // Handle sleep that crosses midnight
        var barX, barWidth;
        if (bedMinutes > wakeMinutes) {
            // Sleep crosses midnight (e.g., 22:00 to 07:00)
            barX = (bedMinutes / (hoursInDay * 60)) * chartWidth;
            barWidth = ((hoursInDay * 60 - bedMinutes + wakeMinutes) / (hoursInDay * 60)) * chartWidth;
        } else {
            // Sleep within same day (e.g., nap from 13:00 to 15:00)
            barX = (bedMinutes / (hoursInDay * 60)) * chartWidth;
            barWidth = ((wakeMinutes - bedMinutes) / (hoursInDay * 60)) * chartWidth;
        }

        // Sleep bar: outer outline + inset translucent fill
        var sleepOuterX = barX;
        var sleepOuterY = y + 2;
        var sleepOuterW = Math.max(barWidth, 5);
        var sleepOuterH = barHeight - 4;
        var sleepInset = 2.6;

        var sleepBarOutline = createSVGElement('rect', {
            x: sleepOuterX,
            y: sleepOuterY,
            width: sleepOuterW,
            height: sleepOuterH,
            fill: 'none',
            stroke: 'rgba(168,230,217,0.38)',
            'stroke-width': 3,
            rx: 18,
            ry: 18,
            class: 'chart-sleep-bar',
            style: 'pointer-events: none; opacity: 0; -webkit-animation-delay: ' + (j * sleepStaggerDelay) + 's; animation-delay: ' + (j * sleepStaggerDelay) + 's;'
        });

        var sleepBar = createSVGElement('rect', {
            x: sleepOuterX + sleepInset,
            y: sleepOuterY + sleepInset,
            width: Math.max(sleepOuterW - sleepInset * 2, 5),
            height: Math.max(sleepOuterH - sleepInset * 2, 4),
            fill: 'url(#sleepGradient-' + containerId + ')',
            stroke: 'none',
            rx: 15,
            ry: 15,
            class: 'chart-sleep-bar',
            style: 'cursor: pointer; filter: url(#glow-sleep-' + containerId + ') drop-shadow(0 0 10px rgba(168,230,217,0.32)) drop-shadow(0 2px 4px rgba(0,0,0,0.3)); opacity: 0; -webkit-animation-delay: ' + (j * sleepStaggerDelay) + 's; animation-delay: ' + (j * sleepStaggerDelay) + 's;'
        });

        (function(itemData) {
            sleepBar.addEventListener('mouseenter', function(e) {
                var tooltipText = itemData.date + '<br>' +
                                 'Sleep: ' + itemData.duration.toFixed(1) + ' hours<br>' +
                                 'Bedtime: ' + itemData.bedtime + '<br>' +
                                 'Wake: ' + itemData.wakeTime;
                if (itemData.hasNaps) {
                    tooltipText += '<br>Naps: ' + itemData.napCount;
                }
                showSleepTooltip(e, tooltipText);
            });
            sleepBar.addEventListener('mouseleave', hideTooltip);
        })(item);

        chartGroup.appendChild(sleepBarOutline);
        chartGroup.appendChild(sleepBar);

        // Date label (left side)
        var dateLabel = createSVGElement('text', {
            x: -10,
            y: y + barHeight / 2 + 5,
            fill: '#DFE4EB',
            'font-size': '13',
            'text-anchor': 'end'
        });
        dateLabel.textContent = formatDate(item.date, 'MMM DD');
        chartGroup.appendChild(dateLabel);

        // Duration label (right side)
        var durationLabel = createSVGElement('text', {
            x: chartWidth + 10,
            y: y + barHeight / 2 + 5,
            fill: '#DFE4EB',
            'font-size': '14',
            'text-anchor': 'start'
        });
        durationLabel.textContent = item.duration.toFixed(1) + 'h';
        chartGroup.appendChild(durationLabel);

        // Nap indicator
        if (item.hasNaps) {
            var napIndicator = createSVGElement('circle', {
                cx: barX + barWidth - 10,
                cy: y + barHeight / 2,
                r: 5,
                fill: 'rgba(244,227,179,0.9)',
                stroke: 'rgba(255,255,255,0.5)',
                'stroke-width': 2
            });
            chartGroup.appendChild(napIndicator);
        }
    }

    // X-axis (time scale - every 3 hours)
    for (var h = 0; h <= 24; h += 3) {
        var x = (h / hoursInDay) * chartWidth;
        var gridLine = createSVGElement('line', {
            x1: x,
            y1: -15,
            x2: x,
            y2: sleepDataProcessed.length * (barHeight + barGap),
            stroke: h === 0 || h === 12 || h === 24 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
            'stroke-width': h === 0 || h === 24 ? 2 : 1
        });
        chartGroup.appendChild(gridLine);

        var hourLabel = createSVGElement('text', {
            x: x,
            y: sleepDataProcessed.length * (barHeight + barGap) + 25,
            fill: '#DFE4EB',
            'font-size': '14',
            'text-anchor': 'middle'
        });
        hourLabel.textContent = String(h).padStart(2, '0') + ':00';
        chartGroup.appendChild(hourLabel);
    }

    svg.appendChild(chartGroup);
    container.appendChild(svg);
}

/**
 * Show tooltip for sleep chart
 */
function showSleepTooltip(event, htmlContent) {
    hideTooltip();

    var tooltip = document.createElement('div');
    tooltip.id = 'chart-tooltip';
    tooltip.style.cssText = 'position: fixed; background: linear-gradient(165deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06) 58%, rgba(255,255,255,0.02)), linear-gradient(135deg, rgba(20,20,31,0.88), rgba(15,22,29,0.86)); -webkit-backdrop-filter: blur(16px) saturate(140%); backdrop-filter: blur(16px) saturate(140%); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 11px 15px; color: #DFE4EB; font-size: 13px; pointer-events: none; z-index: 10000; box-shadow: 0 14px 28px rgba(5, 12, 28, 0.42), inset 0 1px 0 rgba(255,255,255,0.28); line-height: 1.6;';

    tooltip.innerHTML = htmlContent;
    document.body.appendChild(tooltip);

    var rect = tooltip.getBoundingClientRect();
    tooltip.style.left = (event.clientX - rect.width / 2) + 'px';
    tooltip.style.top = (event.clientY - rect.height - 10) + 'px';
}
