(function (global) {
    'use strict';

    var STORAGE_KEY = 'nobetplaniLang';
    var HINT_KEY = 'nobetplaniLangHint';
    var BASE_URL = 'https://nobetplani.com/';
    var EN = global.I18N_EN || {};
    var ATTRS = ['placeholder', 'title', 'data-tooltip', 'aria-label', 'alt'];
    var ATTR_SELECTOR = '[placeholder],[title],[data-tooltip],[aria-label],[alt]';
    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1 };

    var DATA = {
        tr: {
            locale: 'tr-TR',
            months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
            monthsShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
            weekdays: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
            weekdaysShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
            weekdaysAbbrev: ['P', 'P', 'S', 'Ç', 'P', 'C', 'C'],
            monthsAscii: ['OCAK', 'SUBAT', 'MART', 'NISAN', 'MAYIS', 'HAZIRAN', 'TEMMUZ', 'AGUSTOS', 'EYLUL', 'EKIM', 'KASIM', 'ARALIK'],
            weekdaysAscii: ['PAZAR', 'PAZARTESI', 'SALI', 'CARSAMBA', 'PERSEMBE', 'CUMA', 'CUMARTESI']
        },
        en: {
            locale: 'en-GB',
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            weekdaysAbbrev: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
            monthsAscii: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'],
            weekdaysAscii: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
        }
    };

    var observer = null;
    var applying = false;

    function readStored() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    function writeStored(lang) {
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { }
    }

    function detectLang() {
        var param = null;
        try { param = new URLSearchParams(global.location.search).get('lang'); } catch (e) { }
        if (param === 'en' || param === 'tr') return { lang: param, explicit: true };
        var stored = readStored();
        if (stored === 'en' || stored === 'tr') return { lang: stored, explicit: true };
        return { lang: 'tr', explicit: false };
    }

    function norm(str) {
        return String(str).replace(/\s+/g, ' ').trim();
    }

    var I18N = {
        lang: 'tr',
        locale: DATA.tr.locale,
        dict: EN
    };

    function current() { return DATA[I18N.lang]; }

    I18N.months = function () { return current().months; };
    I18N.monthsShort = function () { return current().monthsShort; };
    I18N.weekdays = function () { return current().weekdays; };
    I18N.weekdaysShort = function () { return current().weekdaysShort; };
    I18N.monthsAscii = function () { return current().monthsAscii; };
    I18N.weekdaysAscii = function () { return current().weekdaysAscii; };

    I18N.picker = function () {
        var d = current();
        var o = {
            months: d.months,
            monthsShort: d.monthsShort,
            weekdays: d.weekdays,
            weekdaysShort: d.weekdaysShort,
            weekdaysAbbrev: d.weekdaysAbbrev
        };
        if (I18N.lang === 'en') {
            o.cancel = 'Cancel';
            o.clear = 'Clear';
            o.done = 'OK';
        }
        return o;
    };

    I18N.tr = function (str) {
        if (I18N.lang !== 'en' || typeof str !== 'string') return str;
        var hit = EN[norm(str)];
        return typeof hit === 'string' ? hit : str;
    };

    I18N.t = function (key) {
        var args = Array.prototype.slice.call(arguments, 1);
        var out = key;
        if (I18N.lang === 'en') {
            var hit = EN[key];
            if (Array.isArray(hit)) {
                out = Number(args[0]) === 1 ? hit[0] : hit[1];
            } else if (typeof hit === 'string') {
                out = hit;
            }
        }
        return out.replace(/\{(\d+)\}/g, function (m, i) {
            return args[i] !== undefined ? args[i] : m;
        });
    };

    function translateText(node) {
        var src = node.__i18nSrc;
        if (src === undefined || node.nodeValue !== node.__i18nOut) {
            src = node.nodeValue;
            node.__i18nSrc = src;
        }
        var key = norm(src);
        var hit = key ? EN[key] : undefined;
        if (I18N.lang === 'en' && typeof hit === 'string') {
            var lead = src.match(/^\s*/)[0];
            var trail = src.match(/\s*$/)[0];
            node.__i18nOut = lead + hit + trail;
        } else {
            node.__i18nOut = src;
        }
        if (node.nodeValue !== node.__i18nOut) node.nodeValue = node.__i18nOut;
    }

    function translateAttrs(el) {
        var store = el.__i18nAttrs || (el.__i18nAttrs = {});
        for (var i = 0; i < ATTRS.length; i++) {
            var name = ATTRS[i];
            if (!el.hasAttribute(name)) continue;
            var cur = el.getAttribute(name);
            var rec = store[name];
            if (!rec || cur !== rec.out) {
                rec = store[name] = { src: cur, out: cur };
            }
            var hit = EN[norm(rec.src)];
            var next = (I18N.lang === 'en' && typeof hit === 'string') ? hit : rec.src;
            rec.out = next;
            if (cur !== next) el.setAttribute(name, next);
        }
    }

    function skipped(node) {
        for (var el = node.nodeType === 1 ? node : node.parentNode; el && el.nodeType === 1; el = el.parentNode) {
            if (SKIP_TAGS[el.tagName] || el.hasAttribute('data-i18n-skip')) return true;
        }
        return false;
    }

    function walk(root) {
        if (!root || skipped(root)) return;
        if (root.nodeType === 3) { translateText(root); return; }
        if (root.nodeType !== 1) return;
        if (root.matches && root.matches(ATTR_SELECTOR)) translateAttrs(root);
        var attrEls = root.querySelectorAll ? root.querySelectorAll(ATTR_SELECTOR) : [];
        for (var i = 0; i < attrEls.length; i++) {
            if (!skipped(attrEls[i])) translateAttrs(attrEls[i]);
        }
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var n;
        var list = [];
        while ((n = walker.nextNode())) list.push(n);
        for (var j = 0; j < list.length; j++) {
            if (!skipped(list[j])) translateText(list[j]);
        }
    }

    function apply(root) {
        if (applying) return;
        applying = true;
        if (observer) observer.disconnect();
        try {
            walk(root || document.body);
        } finally {
            applying = false;
            startObserver();
        }
    }

    function startObserver() {
        if (I18N.lang !== 'en' || !global.MutationObserver || !document.body) return;
        if (!observer) {
            observer = new MutationObserver(function (records) {
                if (applying) return;
                applying = true;
                observer.disconnect();
                try {
                    for (var i = 0; i < records.length; i++) {
                        var r = records[i];
                        if (r.type === 'childList') {
                            for (var k = 0; k < r.addedNodes.length; k++) walk(r.addedNodes[k]);
                        } else if (r.type === 'characterData') {
                            if (!skipped(r.target)) translateText(r.target);
                        } else if (r.type === 'attributes') {
                            if (!skipped(r.target)) translateAttrs(r.target);
                        }
                    }
                } finally {
                    applying = false;
                    observe();
                }
            });
        }
        observe();
    }

    function observe() {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ATTRS
        });
    }

    function stopObserver() {
        if (observer) observer.disconnect();
    }

    var sourceTitle = null;
    var sourceDescription = null;

    function updateHead() {
        var en = I18N.lang === 'en';
        document.documentElement.setAttribute('lang', I18N.lang);
        if (sourceTitle === null) sourceTitle = document.title;
        var titleHit = EN[norm(sourceTitle)];
        document.title = (en && typeof titleHit === 'string') ? titleHit : sourceTitle;

        var meta = document.querySelector('meta[name="description"]');
        if (meta) {
            if (sourceDescription === null) sourceDescription = meta.getAttribute('content') || '';
            var descHit = EN[norm(sourceDescription)];
            meta.setAttribute('content', (en && typeof descHit === 'string') ? descHit : sourceDescription);
        }

        var canonical = document.querySelector('link[rel="canonical"]');
        var hasList = false;
        try { hasList = new URLSearchParams(global.location.search).has('listeID'); } catch (e) { }
        if (canonical && !hasList) {
            canonical.setAttribute('href', en ? BASE_URL + '?lang=en' : BASE_URL);
        }
    }

    function updateUrl() {
        if (!global.history || !global.history.replaceState) return;
        try {
            var url = new URL(global.location.href);
            if (I18N.lang === 'en') url.searchParams.set('lang', 'en');
            else url.searchParams.delete('lang');
            global.history.replaceState(global.history.state, document.title, url.pathname + url.search + url.hash);
        } catch (e) { }
    }

    function updateToggles() {
        var target = I18N.lang === 'en' ? 'TR' : 'EN';
        var label = I18N.lang === 'en' ? 'Türkçe\'ye geç' : 'Switch to English';
        var labels = document.querySelectorAll('.js-lang-label');
        for (var i = 0; i < labels.length; i++) labels[i].textContent = target;
        var toggles = document.querySelectorAll('.js-lang-toggle');
        for (var j = 0; j < toggles.length; j++) {
            toggles[j].setAttribute('aria-label', label);
            toggles[j].setAttribute('data-i18n-skip', '');
        }
    }

    function refreshPickers() {
        if (!global.M || !M.Datepicker) return;
        var els = document.querySelectorAll('.datepicker');
        for (var i = 0; i < els.length; i++) {
            var inst = M.Datepicker.getInstance(els[i]);
            if (inst) inst.options.i18n = I18N.picker();
        }
    }

    I18N.setLang = function (lang, opts) {
        opts = opts || {};
        if (lang !== 'en' && lang !== 'tr') return;
        I18N.lang = lang;
        I18N.locale = DATA[lang].locale;
        if (opts.persist !== false) writeStored(lang);
        updateHead();
        updateToggles();
        if (document.body) {
            if (lang === 'tr') stopObserver();
            apply(document.body);
        }
        refreshPickers();
        if (opts.updateUrl !== false && opts.persist !== false) updateUrl();
        if (opts.silent !== true) {
            try { document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } })); } catch (e) { }
        }
    };

    I18N.toggle = function () {
        I18N.setLang(I18N.lang === 'en' ? 'tr' : 'en');
        return false;
    };

    function patchMaterialize() {
        if (!global.M || typeof M.toast !== 'function' || M.toast.__i18n) return;
        var original = M.toast;
        var patched = function (options) {
            if (options && typeof options.html === 'string') {
                options = Object.assign({}, options, { html: I18N.tr(options.html) });
            }
            return original.call(M, options);
        };
        patched.__i18n = true;
        M.toast = patched;
    }

    function maybeHint() {
        if (I18N.lang !== 'tr' || readStored()) return;
        var browserLang = String(navigator.language || '').toLowerCase();
        if (!browserLang || browserLang.indexOf('tr') === 0) return;
        if (/bot|crawl|spider|slurp|bing|yandex|duckduck|baidu|lighthouse|headless|preview/i.test(navigator.userAgent || '')) return;
        try {
            if (localStorage.getItem(HINT_KEY)) return;
            localStorage.setItem(HINT_KEY, '1');
        } catch (e) { return; }
        if (!global.M) return;
        M.toast({
            html: '<span>This site is available in English.</span><button class="btn-flat toast-action" onclick="I18N.setLang(\'en\')">Switch</button>',
            displayLength: 8000
        });
    }

    var initial = detectLang();
    I18N.lang = initial.lang;
    I18N.locale = DATA[initial.lang].locale;
    if (initial.explicit && new URLSearchParams(global.location.search).get('lang') === initial.lang) {
        writeStored(initial.lang);
    }

    global.I18N = I18N;
    global.t = I18N.t;

    document.addEventListener('DOMContentLoaded', function () {
        patchMaterialize();
        updateHead();
        updateToggles();
        if (I18N.lang === 'en') apply(document.body);
        maybeHint();
    });
})(window);
