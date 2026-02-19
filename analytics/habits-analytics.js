// ── Habits Analytics ──────────────────────────────────────────────────────────
// Renders the "Habits" category tab on the analytics page (page 7).
// Depends on: analytics.js (AnalyticsState, getOffsetDateRange, updatePeriodNavigator),
//             utils.js (formatDate), firebase globals on window.

var _habitsCache = null;

var HA_IDS   = ['cleaning', 'exercise', 'reading', 'writing', 'second-language'];
var HA_NAMES = { cleaning: 'Cleaning', exercise: 'Exercise', reading: 'Reading', writing: 'Writing', 'second-language': 'Second Language' };
var HA_DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var HA_MONTHS= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

var HA_COLORS = {
    'cleaning':        { hex: '#A8E6D9', rgb: '168,230,217' },
    'exercise':        { hex: '#EDB68C', rgb: '237,182,140' },
    'reading':         { hex: '#C3A5F3', rgb: '195,165,243' },
    'writing':         { hex: '#f4e3b3', rgb: '244,227,179' },
    'second-language': { hex: '#EDBFE7', rgb: '237,191,231' }
};

// ── Data helpers ───────────────────────────────────────────────────────────────

function haToStr(date) {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
}

async function haEnsureData() {
    if (_habitsCache) return _habitsCache;
    var user = window.currentUser;
    if (!user || !window.firebaseDb || !window.firebaseGetDocs || !window.firebaseCollection) return [];
    try {
        var colRef = window.firebaseCollection(window.firebaseDb, 'users', user.uid, 'entriesHabits');
        var snap = await window.firebaseGetDocs(colRef);
        _habitsCache = [];
        snap.forEach(function(doc) {
            var d = doc.data();
            d.date = doc.id;
            _habitsCache.push(d);
        });
        _habitsCache.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
    } catch(e) {
        console.error('Habits analytics fetch error:', e);
        _habitsCache = [];
    }
    return _habitsCache;
}

function haFilter(data, startDate, endDate) {
    var s = haToStr(startDate), e = haToStr(endDate);
    return data.filter(function(d) { return d.date >= s && d.date <= e; });
}

function haDayMinutes(entry, id) {
    if (id === 'cleaning')        return entry.cleaning_time || 0;
    if (id === 'exercise')        return entry.exercise_time || 0;
    if (id === 'reading')         return (entry.reading_fiction || 0) + (entry.reading_nonfiction || 0) + (entry.reading_fanfic || 0) + (entry.reading_comic || 0);
    if (id === 'writing')         return (entry.writing_nonfiction || 0) + (entry.writing_poetry || 0) + (entry.writing_prose || 0) + (entry.writing_reflection || 0);
    if (id === 'second-language') return entry.second_language_time || 0;
    return 0;
}

function haIsDone(entry, id) {
    return haDayMinutes(entry, id) > 0 || entry[id] === true;
}

function haTotalMin(entries, id) {
    return entries.reduce(function(s, e) { return s + haDayMinutes(e, id); }, 0);
}

function haDoneDays(entries, id) {
    return entries.filter(function(e) { return haIsDone(e, id); }).length;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function haFmt(min) {
    if (!min || min <= 0) return '—';
    if (min < 60) return min + 'min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + 'h' + (m ? ' ' + m + 'min' : '');
}

function haTrend(cur, prev) {
    var diff = (cur || 0) - (prev || 0);
    if (!cur && !prev) return '';
    if (Math.abs(diff) < 1) return '<span class="ha-trend ha-neutral">→</span>';
    if (diff > 0) return '<span class="ha-trend ha-up">↑ +' + haFmt(diff) + '</span>';
    return '<span class="ha-trend ha-down">↓ ' + haFmt(Math.abs(diff)) + '</span>';
}

function haTrendNum(cur, prev) {
    var diff = (cur || 0) - (prev || 0);
    if (!cur && !prev) return '';
    if (diff === 0) return '<span class="ha-trend ha-neutral">→</span>';
    if (diff > 0) return '<span class="ha-trend ha-up">↑ +' + diff.toLocaleString() + '</span>';
    return '<span class="ha-trend ha-down">↓ ' + Math.abs(diff).toLocaleString() + '</span>';
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  INSIGHT MESSAGES                                                            ║
// ║  Organised by time period. Edit the returned strings to customise messages.  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── WEEK ─────────────────────────────────────────────────────────────────────────

/* WEEK — Cleaning */
function _msgW_Cleaning(t) {
    if (t < 20)   return 'Eeew... Go clean, NOW!';
    if (t <= 60)  return 'Good job, keep it up!';
    if (t <= 100) return 'Wow, are you a roomba? That\'s impressive time spent cleaning!';
    return 'Are you overcompensating or procrastinating?';
}
/* WEEK — Exercise */
function _msgW_Exercise(t) {
    if (t < 20)   return 'Get up and move! Your body will thank you!';
    if (t <= 60)  return 'Nice work, keep it up!';
    if (t <= 120) return 'Wow, are you a Chloe Ting? That\'s impressive time spent exercising!';
    return 'That\'s suspicious... Keep it up.';
}
/* WEEK — Reading */
function _msgW_Reading(t) {
    if (t < 20)    return 'What the fuck happened to you this week?';
    if (t <= 80)   return 'Go read something, NOW!';
    if (t <= 210)  return 'You should be reading more.';
    if (t <= 420)  return 'Nice, but you can do better!';
    if (t <= 840)  return 'Good job, little bookwormie! Knowledge is power even if the knowledge is questionable.';
    if (t <= 1260) return 'Are you studying, researching or binge-reading romance? Either way GOOD JOB!';
    return 'Holy fuck you\'re a bookworm. That is a compliment by the way.';
}
/* WEEK — Reading extra (genre breakdown, shown below main message) */
function _msgW_ReadingExtra(entries) {
    var f  = entries.reduce(function(s, e) { return s + (e.reading_fiction    || 0); }, 0);
    var nf = entries.reduce(function(s, e) { return s + (e.reading_nonfiction || 0); }, 0);
    var fc = entries.reduce(function(s, e) { return s + (e.reading_fanfic     || 0); }, 0);
    var co = entries.reduce(function(s, e) { return s + (e.reading_comic      || 0); }, 0);
    if (fc > 0 && fc > f + nf + co) return 'Mmm... yaoi';
    if (fc > 0 && fc === f + co)    return 'Woah, look at that equilibrium!';
    var mx = Math.max(f, nf, fc, co);
    if (mx === nf && nf > 0) return 'Big brain energy this week!';
    if (f > 0 && co > 0 && fc > 0 && Math.abs((f + co + fc) - nf) < 5) return 'Nice balance between entertainment and knowledge.';
    if (f > 0 && f >= nf && f >= fc && f >= co && f > 120) return 'Don\'t forget to log them books into Goodreads.';
    return null;
}
/* WEEK — Writing */
function _msgW_Writing(t, entries) {
    var prose  = entries.reduce(function(s, e) { return s + (e.writing_prose  || 0); }, 0);
    var poetry = entries.reduce(function(s, e) { return s + (e.writing_poetry || 0); }, 0);
    if (prose + poetry > 210) return 'Go, little writer, go!';
    if (t < 120)              return 'You should be writing more.';
    return null;
}
/* WEEK — Second Language */
function _msgW_SecondLang(t, done) {
    if (t < 30 || done < 2) return 'Idiota.';
    if (t <= 60)  return 'Nice, but you can do better!';
    if (t <= 120) return 'Good job, keep it up!';
    return 'Let\'s do this every week!';
}

// ── MONTH ─────────────────────────────────────────────────────────────────────────

/* MONTH — Cleaning */
function _msgM_Cleaning(t) {
    if (t < 80)   return 'Your place must be a biohazard at this point.';
    if (t <= 240) return 'Decent month — habitat remains habitable!';
    if (t <= 400) return 'Immaculate home, immaculate vibes.';
    return 'You\'ve been cleaning more than living. Go touch grass.';
}
/* MONTH — Exercise */
function _msgM_Exercise(t) {
    if (t < 80)   return 'One month of mostly sitting. Your body is sending distress signals.';
    if (t <= 240) return 'Consistent effort this month. Your future self approves.';
    if (t <= 480) return 'Solid month of movement. You\'re built different.';
    return 'Are you training for something or just thriving? Either way, wow.';
}
/* MONTH — Reading */
function _msgM_Reading(t) {
    if (t < 80)    return 'A whole month and barely a page. Shameful.';
    if (t <= 320)  return 'A little reading is better than none. But just a little.';
    if (t <= 840)  return 'You\'re keeping the habit alive. Respect.';
    if (t <= 1680) return 'A solid reading month! Your TBR pile is shrinking.';
    if (t <= 3360) return 'You read a lot this month. Like, a lot a lot.';
    if (t <= 5040) return 'At this point reading is your whole personality and that\'s okay.';
    return 'You have ascended. The books have chosen you.';
}
/* MONTH — Writing */
function _msgM_Writing(t, entries) {
    var prose  = entries.reduce(function(s, e) { return s + (e.writing_prose  || 0); }, 0);
    var poetry = entries.reduce(function(s, e) { return s + (e.writing_poetry || 0); }, 0);
    if (t < 480)              return 'The blank page awaits. It\'s patient. You shouldn\'t be.';
    if (prose + poetry > 840) return 'A creative month! Your characters are grateful.';
    return 'Writing is showing up. You showed up.';
}
/* MONTH — Second Language */
function _msgM_SecondLang(t, done) {
    if (t < 120 || done < 8) return '¿Hablas? Apparently not enough.';
    if (t <= 240) return 'Consistent enough to not forget everything. Barely.';
    if (t <= 480) return 'Solid language month! Neurons are firing.';
    return 'You\'re basically fluent at this rate. Keep going.';
}

// ── 3 MONTHS ─────────────────────────────────────────────────────────────────────

/* 3 MONTHS — Cleaning */
function _msgQ_Cleaning(t) {
    if (t < 240)  return 'Three months of mild chaos. Nothing wrong with that, I guess.';
    if (t <= 720) return 'Consistent enough to avoid embarrassment. Well done.';
    if (t <= 1300)return 'Your place must be spotless. Teach me your ways.';
    return 'You are the cleaning. The cleaning is you.';
}
/* 3 MONTHS — Exercise */
function _msgQ_Exercise(t) {
    if (t < 240)  return 'Three months is enough time to form a habit. Start now?';
    if (t <= 780) return 'You\'re moving! Not breaking records but definitely not breaking bones either.';
    if (t <= 1560)return 'A quarter of dedicated movement. That\'s genuinely impressive.';
    return 'You might actually be built different. Seriously.';
}
/* 3 MONTHS — Reading */
function _msgQ_Reading(t) {
    if (t < 240)  return 'Three months, minimal reading. The books are sad.';
    if (t <= 1000)return 'A gentle reader. Could be more, could be less.';
    if (t <= 2520)return 'Consistent reader! That\'s what matters.';
    if (t <= 5040)return 'A quarter of serious reading. Goodreads would be proud.';
    return 'You\'ve read more in 3 months than most read in a year. Legend.';
}
/* 3 MONTHS — Writing */
function _msgQ_Writing(t, entries) {
    var prose  = entries.reduce(function(s, e) { return s + (e.writing_prose  || 0); }, 0);
    var poetry = entries.reduce(function(s, e) { return s + (e.writing_poetry || 0); }, 0);
    if (t < 1440)              return 'Three months is enough time to write... something.';
    if (prose + poetry > 2520) return 'Three months of creative output. That\'s a whole draft.';
    return 'Keep the pen moving.';
}
/* 3 MONTHS — Second Language */
function _msgQ_SecondLang(t, done) {
    if (t < 360 || done < 24) return 'Three months of half-heartedness. The language noticed.';
    if (t <= 720)  return 'Regular practice over 3 months. That\'s real progress.';
    if (t <= 1440) return 'Impressive dedication. Your accent is getting better.';
    return 'You\'re fluent or getting dangerously close. Don\'t stop now.';
}

// ── YEAR ──────────────────────────────────────────────────────────────────────────

/* YEAR — Cleaning */
function _msgY_Cleaning(t) {
    if (t < 1040) return 'A whole year of questionable hygiene choices.';
    if (t <= 3120)return 'Steady, reliable, unglamorous. Just like cleaning itself.';
    if (t <= 5200)return 'Clean home, clear mind. You\'ve got this down.';
    return 'At this point just hire a cleaner and live a little.';
}
/* YEAR — Exercise */
function _msgY_Exercise(t) {
    if (t < 1040) return 'A year went by. Your gym membership is crying.';
    if (t <= 3120)return 'Consistent mover. You should be proud.';
    if (t <= 5200)return 'A whole year of real effort. Your body is a testament to it.';
    return 'This is not normal (compliment). An absolute unit.';
}
/* YEAR — Reading */
function _msgY_Reading(t) {
    if (t < 1040)  return 'A year passed. The library misses you.';
    if (t <= 4000) return 'You read. Not a lot, but you read. Counts.';
    if (t <= 10000)return 'A genuine reader with a genuine habit. Beautiful.';
    if (t <= 20000)return 'This is what a bibliophile looks like. Magnificent.';
    return 'You have transcended the physical plane through books.';
}
/* YEAR — Writing */
function _msgY_Writing(t, entries) {
    var prose  = entries.reduce(function(s, e) { return s + (e.writing_prose  || 0); }, 0);
    var poetry = entries.reduce(function(s, e) { return s + (e.writing_poetry || 0); }, 0);
    if (t < 5200)               return 'A year went by. What story didn\'t get written?';
    if (prose + poetry > 10000) return 'A year of real creative work. That\'s a body of work.';
    return 'Every word you wrote this year matters.';
}
/* YEAR — Second Language */
function _msgY_SecondLang(t, done) {
    if (t < 1440) return 'A year of sporadic language learning. Better than nothing, barely.';
    if (t <= 5000)return 'A year of consistent practice. You\'ve grown, linguistically.';
    return 'A whole year of language dedication. Stunning. Bilingual queen.';
}

// ── Dispatcher ───────────────────────────────────────────────────────────────────

function haGetMsg(id, period, total, done, entries) {
    if (id === 'cleaning') {
        if (period === 'week')    return _msgW_Cleaning(total);
        if (period === 'month')   return _msgM_Cleaning(total);
        if (period === '3months') return _msgQ_Cleaning(total);
        if (period === 'year')    return _msgY_Cleaning(total);
    }
    if (id === 'exercise') {
        if (period === 'week')    return _msgW_Exercise(total);
        if (period === 'month')   return _msgM_Exercise(total);
        if (period === '3months') return _msgQ_Exercise(total);
        if (period === 'year')    return _msgY_Exercise(total);
    }
    if (id === 'reading') {
        if (period === 'week')    return _msgW_Reading(total);
        if (period === 'month')   return _msgM_Reading(total);
        if (period === '3months') return _msgQ_Reading(total);
        if (period === 'year')    return _msgY_Reading(total);
    }
    if (id === 'writing') {
        if (period === 'week')    return _msgW_Writing(total, entries);
        if (period === 'month')   return _msgM_Writing(total, entries);
        if (period === '3months') return _msgQ_Writing(total, entries);
        if (period === 'year')    return _msgY_Writing(total, entries);
    }
    if (id === 'second-language') {
        if (period === 'week')    return _msgW_SecondLang(total, done);
        if (period === 'month')   return _msgM_SecondLang(total, done);
        if (period === '3months') return _msgQ_SecondLang(total, done);
        if (period === 'year')    return _msgY_SecondLang(total, done);
    }
    return null;
}

// ── Visual: week calendar (7 boxes) ────────────────────────────────────────────

function haWeekCal(id, entries, weekDays) {
    var color = HA_COLORS[id];
    var html = '<div class="ha-week-cal">';
    weekDays.forEach(function(day) {
        var entry = entries.find(function(e) { return e.date === day.dateStr; });
        var min   = entry ? haDayMinutes(entry, id) : 0;
        var done  = entry ? haIsDone(entry, id) : false;
        var bg    = done ? 'style="--hc:rgba(' + color.rgb + ',0.18)"' : '';
        html += '<div class="ha-day-box' + (done ? ' ha-done' : '') + '" ' + bg + '>';
        html += '<span class="ha-day-lbl">' + day.label + '</span>';
        html += '<span class="ha-day-val">' + (min > 0 ? haFmt(min) : (done ? '✓' : '—')) + '</span>';

        if (id === 'exercise' && entry && entry.exercise_types && entry.exercise_types.length) {
            var abbr = entry.exercise_types.slice(0, 3).map(function(t) { return t.substring(0, 5); }).join(' ');
            html += '<span class="ha-day-tags">' + abbr + '</span>';
        }
        if (id === 'reading' && entry && min > 0) {
            var cats = [];
            if (entry.reading_fiction     > 0) cats.push('fic');
            if (entry.reading_nonfiction  > 0) cats.push('nonfic');
            if (entry.reading_fanfic      > 0) cats.push('fanfic');
            if (entry.reading_comic       > 0) cats.push('comic');
            if (cats.length) html += '<span class="ha-day-tags">' + cats.slice(0,2).join(' ') + '</span>';
        }
        if (id === 'writing' && entry && min > 0) {
            var wt = [];
            if (entry.writing_nonfiction > 0) wt.push('nonfic');
            if (entry.writing_poetry     > 0) wt.push('poetry');
            if (entry.writing_prose      > 0) wt.push('prose');
            if (entry.writing_reflection > 0) wt.push('reflect');
            if (wt.length) html += '<span class="ha-day-tags">' + wt.slice(0,2).join(' ') + '</span>';
        }
        html += '</div>';
    });
    html += '</div>';
    return html;
}

// ── Visual: month star grid ─────────────────────────────────────────────────────

function haMonthGrid(id, entries, year, month) {
    var firstDay   = new Date(year, month, 1);
    var lastDay    = new Date(year, month + 1, 0);
    var startOffset= firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon-based
    var rgb        = HA_COLORS[id].rgb;

    var html = '<div class="ha-month-grid">';
    ['M','T','W','T','F','S','S'].forEach(function(d) {
        html += '<div class="ha-month-hdr">' + d + '</div>';
    });
    for (var b = 0; b < startOffset; b++) html += '<div class="ha-month-cell"></div>';
    for (var day = 1; day <= lastDay.getDate(); day++) {
        var ds    = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
        var entry = entries.find(function(e) { return e.date === ds; });
        var done  = entry ? haIsDone(entry, id) : false;
        var starBg = done ? 'rgba(' + rgb + ',0.85)' : 'rgba(' + rgb + ',0.2)';
        html += '<div class="ha-month-cell"><div class="ha-star ' + (done ? 'ha-star-done' : 'ha-star-empty') + '" style="background:' + starBg + '"></div></div>';
    }
    html += '</div>';
    return html;
}

// ── Visual: week block grid (3-months view) ─────────────────────────────────────

function haWeekBlocks(id, entries, startDate, endDate) {
    var weeks = [];
    var cur = new Date(startDate);
    var dow = cur.getDay();
    cur.setDate(cur.getDate() + (dow === 0 ? -6 : 1 - dow)); // align to Monday

    while (cur <= endDate) {
        var wEnd = new Date(cur); wEnd.setDate(cur.getDate() + 6);
        var wEntries = entries.filter(function(e) { return e.date >= haToStr(cur) && e.date <= haToStr(wEnd); });
        weeks.push({ label: HA_MONTHS[cur.getMonth()] + ' ' + cur.getDate(), total: haTotalMin(wEntries, id), done: haDoneDays(wEntries, id) });
        cur.setDate(cur.getDate() + 7);
    }

    var maxVal = Math.max.apply(null, weeks.map(function(w) { return w.total; })) || 1;
    var rgb = HA_COLORS[id].rgb;
    var html = '<div class="ha-block-grid">';
    weeks.forEach(function(w) {
        var intensity = w.total > 0 ? (w.total / maxVal) : (w.done > 0 ? 0.2 : 0);
        var alpha = (0.06 + intensity * 0.55).toFixed(2);
        html += '<div class="ha-block" title="' + w.label + ' · ' + haFmt(w.total) + '" style="background:rgba(' + rgb + ',' + alpha + ')"></div>';
    });
    html += '</div>';
    return html;
}

// ── Visual: month block grid (year view) ────────────────────────────────────────

function haMonthBlocks(id, entries, startDate, endDate) {
    var months = [];
    var cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cur <= endDate) {
        var mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        var mEntries = entries.filter(function(e) { return e.date >= haToStr(cur) && e.date <= haToStr(mEnd); });
        months.push({ label: HA_MONTHS[cur.getMonth()] + ' ' + cur.getFullYear(), mon: HA_MONTHS[cur.getMonth()], total: haTotalMin(mEntries, id), done: haDoneDays(mEntries, id) });
        cur.setMonth(cur.getMonth() + 1);
    }

    var maxVal = Math.max.apply(null, months.map(function(m) { return m.total; })) || 1;
    var rgb = HA_COLORS[id].rgb;
    var html = '<div class="ha-block-grid ha-month-blocks">';
    months.forEach(function(m) {
        var intensity = m.total > 0 ? (m.total / maxVal) : (m.done > 0 ? 0.2 : 0);
        var alpha = (0.06 + intensity * 0.55).toFixed(2);
        html += '<div class="ha-block ha-mblock" title="' + m.label + ' · ' + haFmt(m.total) + '" style="background:rgba(' + rgb + ',' + alpha + ')">' + m.mon + '</div>';
    });
    html += '</div>';
    return html;
}

// ── Visual: bar chart for tags/categories ───────────────────────────────────────

function haBarChart(id, entries) {
    var bars = [];

    if (id === 'reading') {
        var cats = [
            { label: 'Fiction',     val: entries.reduce(function(s,e){ return s+(e.reading_fiction||0); },0) },
            { label: 'Non-fiction', val: entries.reduce(function(s,e){ return s+(e.reading_nonfiction||0); },0) },
            { label: 'Fanfic',      val: entries.reduce(function(s,e){ return s+(e.reading_fanfic||0); },0) },
            { label: 'Comic',       val: entries.reduce(function(s,e){ return s+(e.reading_comic||0); },0) }
        ].filter(function(c){ return c.val > 0; });
        bars = cats.map(function(c){ return { label: c.label, val: c.val, display: haFmt(c.val) }; });

    } else if (id === 'writing') {
        var types = [
            { label: 'Non-fiction', val: entries.reduce(function(s,e){ return s+(e.writing_nonfiction||0); },0) },
            { label: 'Poetry',      val: entries.reduce(function(s,e){ return s+(e.writing_poetry||0); },0) },
            { label: 'Prose',       val: entries.reduce(function(s,e){ return s+(e.writing_prose||0); },0) },
            { label: 'Reflection',  val: entries.reduce(function(s,e){ return s+(e.writing_reflection||0); },0) }
        ].filter(function(t){ return t.val > 0; });
        bars = types.map(function(t){ return { label: t.label, val: t.val, display: haFmt(t.val) }; });

    } else if (id === 'exercise') {
        var counts = {};
        entries.forEach(function(e) {
            if (Array.isArray(e.exercise_types)) {
                e.exercise_types.forEach(function(t) { counts[t] = (counts[t] || 0) + 1; });
            }
        });
        bars = Object.keys(counts)
            .map(function(t){ return { label: t, val: counts[t], display: counts[t] + 'x' }; })
            .sort(function(a, b){ return b.val - a.val; });
    }

    if (!bars.length) return '';
    var maxVal = Math.max.apply(null, bars.map(function(b){ return b.val; }));
    var rgb = HA_COLORS[id].rgb;
    var html = '<div class="ha-bar-chart">';
    bars.forEach(function(bar) {
        var pct = maxVal > 0 ? (bar.val / maxVal * 100).toFixed(0) : 0;
        html += '<div class="ha-bar-row">' +
            '<span class="ha-bar-lbl">' + bar.label + '</span>' +
            '<div class="ha-bar-track"><div class="ha-bar-fill" style="width:' + pct + '%;background:rgba(' + rgb + ',0.6)"></div></div>' +
            '<span class="ha-bar-val">' + bar.display + '</span>' +
            '</div>';
    });
    html += '</div>';
    return html;
}

// ── Insights block ──────────────────────────────────────────────────────────────

function haInsights(id, entries, prevEntries, period) {
    var isWeek = period === 'week';
    var total     = haTotalMin(entries, id);
    var prevTotal = haTotalMin(prevEntries, id);
    var done      = haDoneDays(entries, id);
    var prevDone  = haDoneDays(prevEntries, id);
    var hex       = HA_COLORS[id].hex;

    var html = '<div class="ha-insights">';

    // Stats row
    html += '<div class="ha-stats">';
    html += '<div class="ha-stat"><span class="ha-stat-val" style="color:' + hex + '">' + haFmt(total) + '</span><span class="ha-stat-lbl">total</span></div>';
    html += '<div class="ha-stat"><span class="ha-stat-val" style="color:' + hex + '">' + done + ' days</span><span class="ha-stat-lbl">completed</span></div>';
    if (total > 0 && done > 0) {
        html += '<div class="ha-stat"><span class="ha-stat-val" style="color:' + hex + '">' + haFmt(Math.round(total / done)) + '</span><span class="ha-stat-lbl">avg/session</span></div>';
    }
    if (prevTotal > 0 || total > 0) {
        html += '<div class="ha-stat">' + haTrend(total, prevTotal) + '<span class="ha-stat-lbl">vs prev</span></div>';
    }
    html += '</div>';

    // Exercise steps
    if (id === 'exercise') {
        var steps     = entries.reduce(function(s,e){ return s+(e.exercise_steps||0); },0);
        var prevSteps = prevEntries.reduce(function(s,e){ return s+(e.exercise_steps||0); },0);
        if (steps > 0) {
            html += '<div class="ha-stats ha-stats-sm">';
            html += '<div class="ha-stat"><span class="ha-stat-val" style="color:' + hex + '">' + steps.toLocaleString() + '</span><span class="ha-stat-lbl">total steps</span></div>';
            if (done > 0) html += '<div class="ha-stat"><span class="ha-stat-val" style="color:' + hex + '">' + Math.round(steps / done).toLocaleString() + '</span><span class="ha-stat-lbl">avg steps</span></div>';
            html += '<div class="ha-stat">' + haTrendNum(steps, prevSteps) + '<span class="ha-stat-lbl">steps trend</span></div>';
            html += '</div>';
        }
    }

    // Reading categories
    if (id === 'reading') {
        var f  = entries.reduce(function(s,e){ return s+(e.reading_fiction||0); },0);
        var nf = entries.reduce(function(s,e){ return s+(e.reading_nonfiction||0); },0);
        var fc = entries.reduce(function(s,e){ return s+(e.reading_fanfic||0); },0);
        var co = entries.reduce(function(s,e){ return s+(e.reading_comic||0); },0);
        var cats = [['Fiction',f],['Non-fiction',nf],['Fanfic',fc],['Comic',co]].filter(function(c){ return c[1]>0; });
        if (cats.length) {
            html += '<div class="ha-cats">' + cats.map(function(c){ return '<span class="ha-cat">' + c[0] + ': <strong>' + haFmt(c[1]) + '</strong></span>'; }).join('') + '</div>';
        }
    }

    // Writing categories
    if (id === 'writing') {
        var wn = entries.reduce(function(s,e){ return s+(e.writing_nonfiction||0); },0);
        var wp = entries.reduce(function(s,e){ return s+(e.writing_poetry||0); },0);
        var wpr= entries.reduce(function(s,e){ return s+(e.writing_prose||0); },0);
        var wr = entries.reduce(function(s,e){ return s+(e.writing_reflection||0); },0);
        var wc = [['Non-fiction',wn],['Poetry',wp],['Prose',wpr],['Reflection',wr]].filter(function(c){ return c[1]>0; });
        if (wc.length) {
            html += '<div class="ha-cats">' + wc.map(function(c){ return '<span class="ha-cat">' + c[0] + ': <strong>' + haFmt(c[1]) + '</strong></span>'; }).join('') + '</div>';
        }
    }

    // Insight message
    var msg = haGetMsg(id, period, total, done, entries);
    if (msg) html += '<p class="ha-msg">' + msg + '</p>';

    // Reading extra (genre breakdown) — week only
    if (id === 'reading' && isWeek) {
        var extra = _msgW_ReadingExtra(entries);
        if (extra) html += '<p class="ha-msg ha-msg-extra">' + extra + '</p>';
    }

    html += '</div>';
    return html;
}

// ── Per-habit section ───────────────────────────────────────────────────────────

function haSection(id, entries, prevEntries, period, dateRange) {
    var color   = HA_COLORS[id];
    var isWeek  = period === 'week';
    var isMo    = period === 'month';
    var is3mo   = period === '3months';
    var isYear  = period === 'year';
    var showBar = ['exercise','reading','writing'].indexOf(id) >= 0;

    // Visual
    var visual = '';
    if (isWeek) {
        var weekDays = [];
        var mon = new Date(dateRange.startDate);
        for (var i = 0; i < 7; i++) {
            var d = new Date(mon); d.setDate(mon.getDate() + i);
            weekDays.push({ dateStr: haToStr(d), label: HA_DAYS[i] });
        }
        visual = haWeekCal(id, entries, weekDays);
    } else if (isMo) {
        visual = haMonthGrid(id, entries, dateRange.startDate.getFullYear(), dateRange.startDate.getMonth());
    } else if (is3mo) {
        visual = haWeekBlocks(id, entries, dateRange.startDate, dateRange.endDate);
    } else if (isYear) {
        visual = haMonthBlocks(id, entries, dateRange.startDate, dateRange.endDate);
    }

    // Bar chart for month / 3months / year
    var chart = (showBar && !isWeek) ? haBarChart(id, entries) : '';

    // Insights
    var insights = haInsights(id, entries, prevEntries, period);

    // Restore open state
    var wasOpen = true;
    var existingBody = document.getElementById('ha-body-' + id);
    if (existingBody) wasOpen = !existingBody.classList.contains('ha-closed');

    return '<div class="ha-section ha-section-' + id + '">' +
        '<button class="ha-toggle' + (wasOpen ? ' ha-toggle-open' : '') + '" data-ha-id="' + id + '" onclick="toggleHaSection(\'' + id + '\')">' +
        '<span class="ha-name" style="color:' + color.hex + '">' + HA_NAMES[id] + '</span>' +
        '<span class="ha-arrow">&#8250;</span>' +
        '</button>' +
        '<div class="ha-body' + (wasOpen ? '' : ' ha-closed') + '" id="ha-body-' + id + '">' +
        visual +
        (chart ? '<div class="ha-chart-wrap">' + chart + '</div>' : '') +
        insights +
        '</div></div>';
}

// ── Toggle ──────────────────────────────────────────────────────────────────────

function toggleHaSection(id) {
    var body   = document.getElementById('ha-body-' + id);
    var toggle = document.querySelector('[data-ha-id="' + id + '"]');
    if (!body) return;
    var closed = body.classList.toggle('ha-closed');
    if (toggle) toggle.classList.toggle('ha-toggle-open', !closed);
}
window.toggleHaSection = toggleHaSection;

// ── Main render ─────────────────────────────────────────────────────────────────

async function renderHabitsTab() {
    var content = document.getElementById('analyticsContent');
    if (!content) return;

    content.innerHTML = '<p style="color:rgba(223,228,235,0.5);text-align:center;padding:24px 0">Loading habit data…</p>';

    var period    = AnalyticsState.currentPeriod;
    var dateRange = getOffsetDateRange(period, AnalyticsState.periodOffset);
    var prevRange = getOffsetDateRange(period, AnalyticsState.periodOffset - 1);

    var allData   = await haEnsureData();
    var entries   = haFilter(allData, dateRange.startDate, dateRange.endDate);
    var prevEntries = haFilter(allData, prevRange.startDate, prevRange.endDate);

    var html = '';
    HA_IDS.forEach(function(id) {
        html += haSection(id, entries, prevEntries, period, dateRange);
    });

    content.innerHTML = html || '<p style="color:rgba(223,228,235,0.5);text-align:center;padding:24px 0">No habit data for this period.</p>';
}

window.renderHabitsTab = renderHabitsTab;
