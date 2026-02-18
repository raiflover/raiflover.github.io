// Analytics Insights
// Statistical analysis and insight generation

/**
 * Calculate all insights for a specific metric
 * @param {Array} data - Array of entry objects
 * @param {string} metric - 'energy', 'mood', 'anxiety', or 'irritability'
 * @returns {Object} - Insights object with formatted strings
 */
function calculateInsights(data, metric) {
    if (!data || data.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">No data available.</p>'
        };
    }

    // Filter out missing data for calculations
    const validData = data.filter(entry => !entry.isMissing);

    if (validData.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">No valid data available.</p>'
        };
    }

    let insights = [];

    if (metric === 'energy' || metric === 'mood') {
        // Extract highest and lowest values
        const highestValues = validData.map(e => (e[metric] && e[metric].highest) || 4);
        const lowestValues = validData.map(e => (e[metric] && e[metric].lowest) || 4);

        const avgHighest = calculateAverage(highestValues);
        const avgLowest = calculateAverage(lowestValues);

        insights.push('Average highest: <strong>' + avgHighest.toFixed(1) + '/7</strong>');
        insights.push('Average lowest: <strong>' + avgLowest.toFixed(1) + '/7</strong>');

        // Find best day of week
        const bestDay = findBestDayOfWeek(validData, metric, 'highest');
        if (bestDay) {
            insights.push('Best day: <strong>' + bestDay.day + '</strong> (avg ' + bestDay.avg.toFixed(1) + ')');
        }

        // Find trend
        const trend = findTrend(highestValues);
        const trendIcon = trend === 'Increasing' ? '&uarr;' : trend === 'Decreasing' ? '&darr;' : '&rarr;';
        insights.push('Trend: <strong>' + trend + ' ' + trendIcon + '</strong>');

        // Calculate volatility (average gap between high and low)
        const volatility = calculateVolatility(validData, metric);
        insights.push('Average range: <strong>' + volatility.toFixed(1) + '</strong> points');

    } else {
        // Anxiety or Irritability
        const values = validData.map(e => e[metric] || 4);

        const avg = calculateAverage(values);
        insights.push('Average level: <strong>' + avg.toFixed(1) + '/7</strong>');

        // Find best (lowest) day
        const bestEntry = validData.reduce((min, entry) =>
            (entry[metric] || 4) < (min[metric] || 4) ? entry : min
        );
        insights.push('Lowest on: <strong>' + formatDate(bestEntry.date, 'MMM DD') + '</strong> (' + bestEntry[metric] + '/7)');

        // Find worst (highest) day
        const worstEntry = validData.reduce((max, entry) =>
            (entry[metric] || 4) > (max[metric] || 4) ? entry : max
        );
        insights.push('Highest on: <strong>' + formatDate(worstEntry.date, 'MMM DD') + '</strong> (' + worstEntry[metric] + '/7)');

        // Find trend
        const trend = findTrend(values);
        const trendIcon = trend === 'Increasing' ? '&uarr;' : trend === 'Decreasing' ? '&darr;' : '&rarr;';
        const trendLabel = metric === 'anxiety' || metric === 'irritability'
            ? (trend === 'Increasing' ? 'Rising' : trend === 'Decreasing' ? 'Declining' : 'Stable')
            : trend;
        insights.push('Trend: <strong>' + trendLabel + ' ' + trendIcon + '</strong>');

        // Days below average
        const belowAvg = values.filter(v => v < avg).length;
        const pctBelow = (belowAvg / values.length * 100).toFixed(0);
        insights.push('Days below average: <strong>' + pctBelow + '%</strong>');
    }

    // Format as HTML
    const html = '<div class="insights-list">' +
        insights.map(insight => '<div class="insight-item">&bull; ' + insight + '</div>').join('') +
        '</div>';

    return { html: html, insights: insights };
}

/**
 * Calculate simple average
 * @param {Array} values - Array of numbers
 * @returns {number} - Average value
 */
function calculateAverage(values) {
    if (!values || values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}

/**
 * Find trend in values using linear regression
 * @param {Array} values - Array of numbers
 * @returns {string} - 'Increasing', 'Decreasing', or 'Stable'
 */
function findTrend(values) {
    if (!values || values.length < 2) return 'Stable';

    // Simple linear regression
    const n = values.length;
    const indices = values.map((_, i) => i);

    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = indices.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Threshold for determining trend (0.05 per day)
    const threshold = 0.05;

    if (slope > threshold) return 'Increasing';
    if (slope < -threshold) return 'Decreasing';
    return 'Stable';
}

/**
 * Find best day of week for a metric
 * @param {Array} data - Array of entry objects
 * @param {string} metric - 'energy' or 'mood'
 * @param {string} valueType - 'highest' or 'lowest'
 * @returns {Object} - { day, avg }
 */
function findBestDayOfWeek(data, metric, valueType) {
    if (!valueType) valueType = 'highest';
    const byDay = groupByDayOfWeek(data);

    let bestDay = null;
    let bestAvg = -1;

    Object.keys(byDay).forEach(day => {
        const entries = byDay[day];
        const values = entries.map(e => (e[metric] && e[metric][valueType]) || 4);
        const avg = calculateAverage(values);

        if (avg > bestAvg) {
            bestAvg = avg;
            bestDay = day;
        }
    });

    return bestDay ? { day: bestDay, avg: bestAvg } : null;
}

/**
 * Group data by day of week
 * @param {Array} data - Array of entry objects
 * @returns {Object} - Object with day names as keys
 */
function groupByDayOfWeek(data) {
    const grouped = {
        'Monday': [],
        'Tuesday': [],
        'Wednesday': [],
        'Thursday': [],
        'Friday': [],
        'Saturday': [],
        'Sunday': []
    };

    data.forEach(entry => {
        const dayName = getDayOfWeek(entry.date, true);
        if (grouped[dayName]) {
            grouped[dayName].push(entry);
        }
    });

    return grouped;
}

/**
 * Calculate volatility (average range for energy/mood)
 * @param {Array} data - Array of entry objects
 * @param {string} metric - 'energy' or 'mood'
 * @returns {number} - Average volatility
 */
function calculateVolatility(data, metric) {
    const ranges = data.map(entry => {
        const highest = (entry[metric] && entry[metric].highest) || 4;
        const lowest = (entry[metric] && entry[metric].lowest) || 4;
        return Math.abs(highest - lowest);
    });

    return calculateAverage(ranges);
}

/**
 * Calculate correlation between two value arrays (Pearson correlation)
 * @param {Array} values1 - First array of values
 * @param {Array} values2 - Second array of values
 * @returns {number} - Correlation coefficient (-1 to 1)
 */
function calculateCorrelation(values1, values2) {
    if (!values1 || !values2 || values1.length !== values2.length || values1.length < 2) {
        return null;
    }

    const n = values1.length;
    const mean1 = calculateAverage(values1);
    const mean2 = calculateAverage(values2);

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (let i = 0; i < n; i++) {
        const diff1 = values1[i] - mean1;
        const diff2 = values2[i] - mean2;

        numerator += diff1 * diff2;
        denominator1 += diff1 * diff1;
        denominator2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denominator1 * denominator2);

    if (denominator === 0) return null;

    return numerator / denominator;
}

/**
 * Generate summary statistics for all metrics
 * @param {Array} data - Array of entry objects
 * @returns {Object} - Summary object
 */
function generateSummary(data) {
    const validData = data.filter(e => !e.isMissing);

    if (validData.length === 0) {
        return {
            totalDays: 0,
            trackedDays: 0,
            missingDays: 0,
            message: 'No data available'
        };
    }

    const energyHighest = validData.map(e => (e.energy && e.energy.highest) || 4);
    const moodHighest = validData.map(e => (e.mood && e.mood.highest) || 4);
    const anxiety = validData.map(e => e.anxiety || 4);
    const irritability = validData.map(e => e.irritability || 4);

    return {
        totalDays: data.length,
        trackedDays: validData.length,
        missingDays: data.length - validData.length,
        averages: {
            energy: calculateAverage(energyHighest).toFixed(1),
            mood: calculateAverage(moodHighest).toFixed(1),
            anxiety: calculateAverage(anxiety).toFixed(1),
            irritability: calculateAverage(irritability).toFixed(1)
        },
        trends: {
            energy: findTrend(energyHighest),
            mood: findTrend(moodHighest),
            anxiety: findTrend(anxiety),
            irritability: findTrend(irritability)
        }
    };
}

/**
 * Render insights HTML for a category
 * @param {string} category - 'energy', 'mood', 'anxiety', or 'irritability'
 * @param {Array} data - Array of entry objects
 * @returns {string} - HTML string
 */
function renderInsightsHTML(category, data) {
    const insights = calculateInsights(data, category);

    const titles = {
        energy: 'Energy Insights',
        mood: 'Mood Insights',
        anxiety: 'Anxiety Insights',
        irritability: 'Irritability Insights'
    };

    return '<div class="insights-section" id="insights-' + category + '">' +
        '<h4 class="insights-title">' + titles[category] + '</h4>' +
        insights.html +
        '</div>';
}

/**
 * Calculate caffeine insights
 * @param {Array} data - Array of entry objects
 * @returns {Object} - Insights object with formatted strings
 */
function calculateCaffeineInsights(data) {
    if (!data || data.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">Not enough data to generate insights.</p>'
        };
    }

    var validData = data.filter(function(entry) { return !entry.isMissing; });

    if (validData.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">No valid data available for this period.</p>'
        };
    }

    var insights = [];

    // Calculate caffeine stats
    var caffeineValues = validData.map(function(e) { return e.caffeine || 0; });
    var totalCaffeine = caffeineValues.reduce(function(sum, val) { return sum + val; }, 0);
    var avgCaffeine = calculateAverage(caffeineValues);
    var maxCaffeine = Math.max.apply(null, caffeineValues);
    var daysWithCaffeine = caffeineValues.filter(function(v) { return v > 0; }).length;
    var pctDaysWithCaffeine = (daysWithCaffeine / validData.length * 100).toFixed(0);

    insights.push('Average daily: <strong>' + avgCaffeine.toFixed(0) + ' mg</strong>');
    insights.push('Peak day: <strong>' + maxCaffeine + ' mg</strong>');
    insights.push('Days with caffeine: <strong>' + pctDaysWithCaffeine + '%</strong>');

    // Find trend
    var trend = findTrend(caffeineValues);
    var trendIcon = trend === 'Increasing' ? '&uarr;' : trend === 'Decreasing' ? '&darr;' : '&rarr;';
    insights.push('Trend: <strong>' + trend + ' ' + trendIcon + '</strong>');

    // Format as HTML
    var html = '<div class="insights-list">' +
        insights.map(function(insight) { return '<div class="insight-item">&bull; ' + insight + '</div>'; }).join('') +
        '</div>';

    return { html: html, insights: insights };
}

/**
 * Analyze patterns between factors and metrics
 * @param {Array} data - Array of entry objects
 * @returns {Object} - Pattern insights with formatted HTML
 */
function analyzePatterns(data) {
    if (!data || data.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">No data to analyze.</p>'
        };
    }

    var validData = data.filter(function(entry) { return !entry.isMissing; });

    if (validData.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">No valid data available.</p>'
        };
    }

    var insights = [];

    // Analyze caffeine impact
    var caffeineInsights = analyzeCaffeineImpact(validData);
    insights = insights.concat(caffeineInsights);

    // Analyze sleep impact
    var sleepInsights = analyzeSleepImpact(validData);
    insights = insights.concat(sleepInsights);

    // Analyze activity impact
    var activityInsights = analyzeActivityImpact(validData);
    insights = insights.concat(activityInsights);

    // Analyze people impact
    var peopleInsights = analyzePeopleImpact(validData);
    insights = insights.concat(peopleInsights);

    if (insights.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">No significant patterns found.</p>'
        };
    }

    // Format as HTML
    var html = '<div class="insights-list">' +
        insights.map(function(insight) { return '<div class="insight-item">&bull; ' + insight + '</div>'; }).join('') +
        '</div>';

    return { html: html, insights: insights };
}

/**
 * Analyze caffeine impact on metrics
 */
function analyzeCaffeineImpact(data) {
    var insights = [];
    var caffeineData = data.filter(function(e) { return (e.caffeine || 0) > 0; });
    var noCaffeineData = data.filter(function(e) { return (e.caffeine || 0) === 0; });

    if (caffeineData.length < 1 || noCaffeineData.length < 1) {
        return insights;
    }

    // Compare metrics
    var metrics = ['energy', 'mood', 'anxiety', 'irritability'];
    metrics.forEach(function(metric) {
        var withCaffeine = caffeineData.map(function(e) {
            if (metric === 'energy' || metric === 'mood') {
                return (e[metric] && e[metric].highest) || 4;
            }
            return e[metric] || 4;
        });
        var withoutCaffeine = noCaffeineData.map(function(e) {
            if (metric === 'energy' || metric === 'mood') {
                return (e[metric] && e[metric].highest) || 4;
            }
            return e[metric] || 4;
        });

        var avgWith = calculateAverage(withCaffeine);
        var avgWithout = calculateAverage(withoutCaffeine);
        var diff = avgWith - avgWithout;
        var pctDiff = ((diff / avgWithout) * 100).toFixed(0);

        if (Math.abs(diff) >= 0.5) {
            var direction = diff > 0 ? 'higher' : 'lower';
            var metricName = metric.charAt(0).toUpperCase() + metric.slice(1);

            if (metric === 'anxiety' || metric === 'irritability') {
                direction = diff > 0 ? 'worse' : 'better';
            }

            insights.push('<strong>Caffeine impact:</strong> ' + metricName + ' is ' +
                Math.abs(pctDiff) + '% ' + direction + ' on days with caffeine');
        }
    });

    return insights;
}

/**
 * Analyze sleep impact on metrics
 */
function analyzeSleepImpact(data) {
    var insights = [];
    var sleepData = data.filter(function(e) {
        return e.sleepDuration !== undefined && e.sleepDuration !== null;
    });

    if (sleepData.length < 1) {
        return insights;
    }

    // Divide into three categories: little/no sleep (0-4), average (5-8), a lot (8+)
    var littleSleep = sleepData.filter(function(e) { return e.sleepDuration >= 0 && e.sleepDuration <= 4; });
    var averageSleep = sleepData.filter(function(e) { return e.sleepDuration >= 5 && e.sleepDuration <= 8; });
    var lotsSleep = sleepData.filter(function(e) { return e.sleepDuration > 8; });

    if (littleSleep.length < 1 && averageSleep.length < 1 && lotsSleep.length < 1) {
        return insights;
    }

    var metrics = ['energy', 'mood', 'anxiety', 'irritability'];

    metrics.forEach(function(metric) {
        var groups = [];
        var labels = [];

        if (littleSleep.length >= 1) {
            groups.push({
                data: littleSleep,
                label: 'little sleep (0-4h)'
            });
        }
        if (averageSleep.length >= 1) {
            groups.push({
                data: averageSleep,
                label: 'average sleep (5-8h)'
            });
        }
        if (lotsSleep.length >= 1) {
            groups.push({
                data: lotsSleep,
                label: 'lots of sleep (8+h)'
            });
        }

        if (groups.length < 1) return;

        // Calculate averages for each group
        var groupAverages = groups.map(function(group) {
            var values = group.data.map(function(e) {
                if (metric === 'energy' || metric === 'mood') {
                    return (e[metric] && e[metric].highest) || 4;
                }
                return e[metric] || 4;
            });
            return {
                label: group.label,
                avg: calculateAverage(values)
            };
        });

        // Sort groups by metric performance
        groupAverages.sort(function(a, b) {
            if (metric === 'anxiety' || metric === 'irritability') {
                return a.avg - b.avg; // Lower is better
            }
            return b.avg - a.avg; // Higher is better
        });

        var best = groupAverages[0];
        var metricName = metric.charAt(0).toUpperCase() + metric.slice(1);

        if (groupAverages.length >= 2) {
            var worst = groupAverages[groupAverages.length - 1];
            var diff = Math.abs(best.avg - worst.avg);

            if (diff >= 0.3) {
                insights.push('<strong>Sleep impact:</strong> ' + metricName + ' is best with ' + best.label +
                    ' (avg ' + best.avg.toFixed(1) + ' vs ' + worst.avg.toFixed(1) + ' with ' + worst.label + ')');
            }
        } else {
            // Only one sleep category - just show the average
            insights.push('<strong>Sleep pattern:</strong> ' + metricName + ' averages ' + best.avg.toFixed(1) +
                ' with ' + best.label);
        }
    });

    return insights;
}

/**
 * Analyze activity impact on metrics
 */
function analyzeActivityImpact(data) {
    var insights = [];

    // Collect all activities
    var activityCounts = {};
    data.forEach(function(e) {
        if (e.activities && Array.isArray(e.activities)) {
            e.activities.forEach(function(activity) {
                if (!activityCounts[activity]) {
                    activityCounts[activity] = 0;
                }
                activityCounts[activity]++;
            });
        }
    });

    // Find activities that appear at least once
    var commonActivities = Object.keys(activityCounts).filter(function(activity) {
        return activityCounts[activity] >= 1;
    });

    if (commonActivities.length === 0) {
        return insights;
    }

    // Analyze top 3 most common activities
    commonActivities.sort(function(a, b) {
        return activityCounts[b] - activityCounts[a];
    });

    var topActivities = commonActivities.slice(0, 3);

    topActivities.forEach(function(activity) {
        var withActivity = data.filter(function(e) {
            return e.activities && Array.isArray(e.activities) && e.activities.indexOf(activity) !== -1;
        });
        var withoutActivity = data.filter(function(e) {
            return !e.activities || !Array.isArray(e.activities) || e.activities.indexOf(activity) === -1;
        });

        if (withActivity.length < 1 || withoutActivity.length < 1) {
            return;
        }

        // Check mood impact
        var moodWith = withActivity.map(function(e) {
            return (e.mood && e.mood.highest) || 4;
        });
        var moodWithout = withoutActivity.map(function(e) {
            return (e.mood && e.mood.highest) || 4;
        });

        var avgWith = calculateAverage(moodWith);
        var avgWithout = calculateAverage(moodWithout);
        var diff = avgWith - avgWithout;

        if (Math.abs(diff) >= 0.7) {
            var direction = diff > 0 ? 'boosts' : 'lowers';
            var pctDiff = Math.abs(((diff / avgWithout) * 100)).toFixed(0);

            insights.push('<strong>Activity pattern:</strong> "' + activity + '" ' + direction +
                ' mood by ' + pctDiff + '%');
        }
    });

    return insights;
}

/**
 * Analyze people impact on metrics
 */
function analyzePeopleImpact(data) {
    var insights = [];

    // Collect all people
    var peopleCounts = {};
    data.forEach(function(e) {
        if (e.people && Array.isArray(e.people)) {
            e.people.forEach(function(person) {
                if (!peopleCounts[person]) {
                    peopleCounts[person] = 0;
                }
                peopleCounts[person]++;
            });
        }
    });

    // Find people that appear at least once
    var commonPeople = Object.keys(peopleCounts).filter(function(person) {
        return peopleCounts[person] >= 1;
    });

    if (commonPeople.length === 0) {
        return insights;
    }

    // Analyze top 3 most common people
    commonPeople.sort(function(a, b) {
        return peopleCounts[b] - peopleCounts[a];
    });

    var topPeople = commonPeople.slice(0, 3);

    topPeople.forEach(function(person) {
        var withPerson = data.filter(function(e) {
            return e.people && Array.isArray(e.people) && e.people.indexOf(person) !== -1;
        });
        var withoutPerson = data.filter(function(e) {
            return !e.people || !Array.isArray(e.people) || e.people.indexOf(person) === -1;
        });

        if (withPerson.length < 1 || withoutPerson.length < 1) {
            return;
        }

        // Check mood and anxiety impact
        var moodWith = withPerson.map(function(e) {
            return (e.mood && e.mood.highest) || 4;
        });
        var moodWithout = withoutPerson.map(function(e) {
            return (e.mood && e.mood.highest) || 4;
        });

        var avgMoodWith = calculateAverage(moodWith);
        var avgMoodWithout = calculateAverage(moodWithout);
        var moodDiff = avgMoodWith - avgMoodWithout;

        if (Math.abs(moodDiff) >= 0.7) {
            var direction = moodDiff > 0 ? 'improves' : 'lowers';
            var pctDiff = Math.abs(((moodDiff / avgMoodWithout) * 100)).toFixed(0);

            insights.push('<strong>People pattern:</strong> Time with "' + person + '" ' + direction +
                ' mood by ' + pctDiff + '%');
        }
    });

    return insights;
}

/**
 * Analyze detailed sleep data from sleep array
 * @param {Array} sleepArray - Array of 48 boolean values (30-min intervals)
 * @returns {Object} - Detailed sleep analysis
 */
function analyzeSleepData(sleepArray) {
    if (!sleepArray || sleepArray.length !== 48) {
        return {
            duration: 0,
            bedtime: null,
            wakeTime: null,
            periods: [],
            hasNaps: false
        };
    }

    // Find all sleep periods (continuous true values)
    var periods = [];
    var currentPeriod = null;

    for (var i = 0; i < sleepArray.length; i++) {
        if (sleepArray[i]) {
            if (!currentPeriod) {
                currentPeriod = { start: i, end: i };
            } else {
                currentPeriod.end = i;
            }
        } else {
            if (currentPeriod) {
                periods.push(currentPeriod);
                currentPeriod = null;
            }
        }
    }

    // Don't forget the last period if it goes to the end
    if (currentPeriod) {
        periods.push(currentPeriod);
    }

    if (periods.length === 0) {
        return {
            duration: 0,
            bedtime: null,
            wakeTime: null,
            periods: [],
            hasNaps: false
        };
    }

    // Calculate duration for each period (in hours)
    periods.forEach(function(period) {
        period.duration = (period.end - period.start + 1) / 2; // Each slot is 30 min
    });

    // Sort by duration to find main sleep vs naps
    var sortedPeriods = periods.slice().sort(function(a, b) {
        return b.duration - a.duration;
    });

    var mainSleep = sortedPeriods[0];
    var naps = sortedPeriods.slice(1).filter(function(p) { return p.duration >= 0.5; }); // At least 30 min

    // Format times
    function formatTimeFromSlot(slot) {
        var hours = Math.floor(slot / 2);
        var minutes = (slot % 2) * 30;
        return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }

    var totalDuration = periods.reduce(function(sum, p) { return sum + p.duration; }, 0);

    return {
        duration: totalDuration,
        bedtime: formatTimeFromSlot(mainSleep.start),
        wakeTime: formatTimeFromSlot(mainSleep.end + 1), // +1 because end is inclusive
        mainSleepDuration: mainSleep.duration,
        periods: periods,
        naps: naps,
        hasNaps: naps.length > 0,
        napCount: naps.length,
        totalNapDuration: naps.reduce(function(sum, n) { return sum + n.duration; }, 0)
    };
}

/**
 * Calculate sleep insights from data array
 * @param {Array} data - Array of entry objects with sleep arrays
 * @returns {Object} - Sleep insights
 */
function calculateSleepInsights(data) {
    if (!data || data.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">Not enough data to generate insights.</p>'
        };
    }

    var validData = data.filter(function(entry) {
        return !entry.isMissing && entry.sleep && Array.isArray(entry.sleep);
    });

    if (validData.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">No valid sleep data available for this period.</p>'
        };
    }

    var insights = [];
    var bedtimes = [];
    var wakeTimes = [];
    var durations = [];
    var totalNaps = 0;
    var totalNapDuration = 0;
    var daysWithNaps = 0;

    validData.forEach(function(entry) {
        var analysis = analyzeSleepData(entry.sleep);

        if (analysis.duration > 0) {
            durations.push(analysis.duration);

            if (analysis.bedtime) {
                bedtimes.push(analysis.bedtime);
            }
            if (analysis.wakeTime) {
                wakeTimes.push(analysis.wakeTime);
            }

            if (analysis.hasNaps) {
                totalNaps += analysis.napCount;
                totalNapDuration += analysis.totalNapDuration;
                daysWithNaps++;
            }
        }
    });

    if (durations.length === 0) {
        return {
            html: '<p style="color: #888; font-style: italic;">No sleep data recorded in this period.</p>'
        };
    }

    // Average sleep duration
    var avgDuration = calculateAverage(durations);
    insights.push('Average sleep: <strong>' + avgDuration.toFixed(1) + ' hours</strong>');

    // Average bedtime (convert times to minutes, average, convert back)
    if (bedtimes.length > 0) {
        var avgBedtimeMinutes = calculateAverage(bedtimes.map(function(t) {
            var parts = t.split(':');
            var hours = parseInt(parts[0]);
            var minutes = parseInt(parts[1]);
            // Convert to minutes from midnight, handle times after midnight as next day
            var totalMinutes = hours * 60 + minutes;
            if (hours < 6) totalMinutes += 24 * 60; // If before 6am, assume it's late night
            return totalMinutes;
        }));

        var bedHours = Math.floor(avgBedtimeMinutes / 60) % 24;
        var bedMins = Math.round(avgBedtimeMinutes % 60);
        insights.push('Average bedtime: <strong>' + String(bedHours).padStart(2, '0') + ':' + String(bedMins).padStart(2, '0') + '</strong>');
    }

    // Average wake time
    if (wakeTimes.length > 0) {
        var avgWakeMinutes = calculateAverage(wakeTimes.map(function(t) {
            var parts = t.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }));

        var wakeHours = Math.floor(avgWakeMinutes / 60);
        var wakeMins = Math.round(avgWakeMinutes % 60);
        insights.push('Average wake time: <strong>' + String(wakeHours).padStart(2, '0') + ':' + String(wakeMins).padStart(2, '0') + '</strong>');
    }

    // Nap statistics (only if there were naps)
    if (totalNaps > 0) {
        insights.push('Total naps: <strong>' + totalNaps + '</strong> across <strong>' + daysWithNaps + '</strong> days');
        var avgNapDuration = totalNapDuration / totalNaps;
        insights.push('Average nap duration: <strong>' + avgNapDuration.toFixed(1) + ' hours</strong>');
    }

    // Format as HTML
    var html = '<div class="insights-list">' +
        insights.map(function(insight) { return '<div class="insight-item">&bull; ' + insight + '</div>'; }).join('') +
        '</div>';

    return { html: html, insights: insights, hasNaps: totalNaps > 0 };
}
