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
        colorHighNeg = 'rgba(120,140,180,0.8)'
    } = options;

    // Clear container
    container.innerHTML = '';

    // Handle empty data
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: #DFE4EB; text-align: center; padding: 40px;">No data available for this period.</p>';
        return;
    }

    // Chart dimensions - LARGER
    const width = 1000;
    const height = 400;
    const padding = { top: 30, right: 60, bottom: 80, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const baseline = 4;

    // Calculate bar width based on data points
    const barGroupWidth = chartWidth / data.length;
    const barWidth = Math.min(Math.max(barGroupWidth * 0.35, 4), 25);
    const barGap = Math.max(barWidth * 0.3, 2);

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
            'font-size': '12',
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
        const barColor = isAboveBaseline ? colorHigh : colorHighNeg;

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
            <stop offset="0%" style="stop-color:${colorHigh};stop-opacity:0.9" />
            <stop offset="100%" style="stop-color:${colorLow};stop-opacity:0.6" />
        `;

        // Add gradient to defs if not exists
        let chartDefs = svg.querySelector('defs');
        if (!chartDefs) {
            chartDefs = createSVGElement('defs');
            svg.insertBefore(chartDefs, svg.firstChild);
        }
        chartDefs.appendChild(gradient);

        // Create rounded bar - MORE ROUNDED
        const bar = createSVGElement('rect', {
            x: x - barWidth / 2,
            y: barY,
            width: barWidth * 1.5,
            height: Math.max(barHeight, 3),
            fill: 'url(#' + gradientId + ')',
            stroke: entry.isMissing ? 'rgba(255,255,255,0.2)' : 'rgba(180,200,255,0.3)',
            'stroke-width': entry.isMissing ? 1 : 2,
            'stroke-dasharray': entry.isMissing ? '3,3' : 'none',
            rx: Math.min(barWidth * 1.2, 15),
            ry: Math.min(barWidth * 1.2, 15),
            class: 'chart-bar',
            style: 'cursor: pointer; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); opacity: 0; -webkit-animation-delay: ' + (index * staggerDelay) + 's; animation-delay: ' + (index * staggerDelay) + 's;'
        });

        bar.addEventListener('mouseenter', (e) => {
            showTooltip(e, entry, metric, containerId);
        });
        bar.addEventListener('mouseleave', hideTooltip);

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
                'font-size': '11',
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
                'font-size': '10',
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
        rx: 2
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

    // Clear container
    container.innerHTML = '';

    // Handle empty data
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: #DFE4EB; text-align: center; padding: 40px;">No data available for this period.</p>';
        return;
    }

    // Chart dimensions - LARGER
    const width = 1000;
    const height = 400;
    const padding = { top: 30, right: 60, bottom: 80, left: 70 };
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
            'font-size': '12',
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
        const x = (index / (data.length - 1)) * chartWidth;
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
                'font-size': '11',
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
                'font-size': '10',
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
        background: linear-gradient(135deg, rgba(20,20,31,0.95), rgba(15,22,29,0.95));
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 10px 14px;
        color: #DFE4EB;
        font-size: 13px;
        pointer-events: none;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
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

/**
 * Render pie chart for activities or people
 * @param {string} containerId - ID of container element
 * @param {Array} data - Array of data entries
 * @param {string} field - 'activities' or 'people'
 */
function renderPieChart(containerId, data, field) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Clear container
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

    // Sort by count
    items.sort(function(a, b) {
        return counts[b] - counts[a];
    });

    // Calculate total
    var total = 0;
    for (var k = 0; k < items.length; k++) {
        total += counts[items[k]];
    }

    // Colors for pie slices - semi-transparent for glassy look
    var colors = [
        'rgba(180,200,255,0.65)',
        'rgba(237,191,231,0.65)',
        'rgba(244,227,179,0.65)',
        'rgba(200,180,255,0.65)',
        'rgba(180,255,220,0.65)',
        'rgba(255,180,200,0.65)',
        'rgba(220,220,255,0.65)',
        'rgba(255,220,180,0.8)'
    ];

    // Chart dimensions (smaller size for better layout)
    var size = 240;
    var radius = 95;
    var centerX = size / 2;
    var centerY = size / 2;

    // Create SVG
    var svg = createSVGElement('svg', {
        viewBox: '0 0 ' + size + ' ' + size,
        class: 'chart-svg',
        style: 'max-width: 300px; margin: 0 auto;'
    });

    // Create defs for gradients to add glassy depth
    var defs = createSVGElement('defs', {});
    for (var gradIdx = 0; gradIdx < colors.length; gradIdx++) {
        var baseColor = colors[gradIdx];
        var gradient = createSVGElement('radialGradient', {
            id: 'pieGrad' + containerId + gradIdx,
            cx: '40%',
            cy: '40%',
            r: '80%'
        });

        var stop1 = createSVGElement('stop', {
            offset: '0%',
            style: 'stop-color:' + baseColor.replace('0.65', '0.85') + ';stop-opacity:1'
        });
        var stop2 = createSVGElement('stop', {
            offset: '100%',
            style: 'stop-color:' + baseColor + ';stop-opacity:1'
        });

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
    }
    svg.appendChild(defs);

    // Calculate stagger delay to fit animation within fixed duration (1.2s total)
    var totalAnimationDuration = 1.2; // seconds
    var pieStaggerDelay = items.length > 1 ? totalAnimationDuration / items.length : 0;

    // Draw pie slices
    var currentAngle = -90; // Start at top

    for (var m = 0; m < items.length; m++) {
        var item = items[m];
        var count = counts[item];
        var percentage = (count / total) * 100;
        var sliceAngle = (count / total) * 360;

        // Calculate arc path
        var startAngle = currentAngle * (Math.PI / 180);
        var endAngle = (currentAngle + sliceAngle) * (Math.PI / 180);

        var x1 = centerX + radius * Math.cos(startAngle);
        var y1 = centerY + radius * Math.sin(startAngle);
        var x2 = centerX + radius * Math.cos(endAngle);
        var y2 = centerY + radius * Math.sin(endAngle);

        var largeArcFlag = sliceAngle > 180 ? 1 : 0;

        var pathData = 'M ' + centerX + ' ' + centerY +
                      ' L ' + x1 + ' ' + y1 +
                      ' A ' + radius + ' ' + radius + ' 0 ' + largeArcFlag + ' 1 ' + x2 + ' ' + y2 +
                      ' Z';

        var slice = createSVGElement('path', {
            d: pathData,
            fill: 'url(#pieGrad' + containerId + (m % colors.length) + ')',
            stroke: 'rgba(255,255,255,0.4)',
            'stroke-width': '2',
            class: 'chart-pie-slice',
            style: 'cursor: pointer; opacity: 0; -webkit-transform-origin: center; transform-origin: center; -webkit-animation-delay: ' + (m * pieStaggerDelay) + 's; animation-delay: ' + (m * pieStaggerDelay) + 's; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)) drop-shadow(0 0 4px rgba(255,255,255,0.15));'
        });

        (function(itemName, itemCount, itemPercentage) {
            slice.addEventListener('mouseenter', function(e) {
                var tooltipContent = {
                    date: itemName,
                    [field]: itemPercentage.toFixed(1) + '% (' + itemCount + ' times)'
                };
                showPieTooltip(e, itemName, itemCount, itemPercentage);
            });
            slice.addEventListener('mouseleave', hideTooltip);
        })(item, count, percentage);

        svg.appendChild(slice);

        currentAngle += sliceAngle;
    }

    container.appendChild(svg);

    // Add legend
    var legend = document.createElement('div');
    legend.style.cssText = 'margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;';

    for (var n = 0; n < items.length; n++) {
        var item = items[n];
        var count = counts[item];
        var percentage = (count / total) * 100;

        var legendItem = document.createElement('div');
        legendItem.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px;';

        var colorBox = document.createElement('div');
        colorBox.style.cssText = 'width: 12px; height: 12px; border-radius: 2px; background: ' + colors[n % colors.length] + ';';

        var label = document.createElement('span');
        label.style.cssText = 'color: #DFE4EB; font-size: 0.85em;';
        label.textContent = item + ' (' + percentage.toFixed(0) + '%)';

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legend.appendChild(legendItem);
    }

    container.appendChild(legend);
}

/**
 * Show tooltip for pie chart
 */
function showPieTooltip(event, name, count, percentage) {
    hideTooltip(); // Hide any existing tooltip

    var tooltip = document.createElement('div');
    tooltip.id = 'chart-tooltip';
    tooltip.style.cssText = 'position: fixed; background: linear-gradient(135deg, rgba(20,20,31,0.95), rgba(15,22,29,0.95)); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; color: #DFE4EB; font-size: 13px; pointer-events: none; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.5);';

    var content = '<div style="margin-bottom: 4px; color: #EDBFE7; font-weight: bold;">' + name + '</div>' +
                 '<div>Count: ' + count + '</div>' +
                 '<div>Percentage: ' + percentage.toFixed(1) + '%</div>';

    tooltip.innerHTML = content;
    document.body.appendChild(tooltip);

    // Position tooltip
    var rect = tooltip.getBoundingClientRect();
    tooltip.style.left = (event.clientX - rect.width / 2) + 'px';
    tooltip.style.top = (event.clientY - rect.height - 10) + 'px';
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

    // Process sleep data
    var sleepDataProcessed = [];
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

    if (sleepDataProcessed.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No sleep data recorded in this period.</p>';
        return;
    }

    // Chart dimensions - LARGER
    var width = 1000;
    var barHeight = 40;
    var barGap = 12;
    var padding = { top: 30, right: 60, bottom: 60, left: 140 };
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
    sleepGradient.innerHTML = '<stop offset="0%" style="stop-color:rgba(180,200,255,0.8);stop-opacity:1" />' +
                              '<stop offset="50%" style="stop-color:rgba(237,191,231,0.7);stop-opacity:1" />' +
                              '<stop offset="100%" style="stop-color:rgba(244,227,179,0.7);stop-opacity:1" />';
    defs.appendChild(sleepGradient);
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
            rx: 12
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

        // Sleep bar with gradient
        var sleepBar = createSVGElement('rect', {
            x: barX,
            y: y + 2,
            width: Math.max(barWidth, 5),
            height: barHeight - 4,
            fill: 'url(#sleepGradient-' + containerId + ')',
            stroke: 'rgba(180,200,255,0.6)',
            'stroke-width': 2,
            rx: 12,
            class: 'chart-sleep-bar',
            style: 'cursor: pointer; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); opacity: 0; -webkit-animation-delay: ' + (j * sleepStaggerDelay) + 's; animation-delay: ' + (j * sleepStaggerDelay) + 's;'
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
            'font-size': '12',
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
            'font-size': '12',
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
    tooltip.style.cssText = 'position: fixed; background: linear-gradient(135deg, rgba(20,20,31,0.95), rgba(15,22,29,0.95)); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; color: #DFE4EB; font-size: 13px; pointer-events: none; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.5); line-height: 1.6;';

    tooltip.innerHTML = htmlContent;
    document.body.appendChild(tooltip);

    var rect = tooltip.getBoundingClientRect();
    tooltip.style.left = (event.clientX - rect.width / 2) + 'px';
    tooltip.style.top = (event.clientY - rect.height - 10) + 'px';
}
