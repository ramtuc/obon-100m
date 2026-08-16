/* ===========================================================================
 * engine.js — 「会社まであと100m」汎用シーン/ビートエンジン
 * 担当: Frontend-1 (t-5507518e)
 *
 * 準拠ドキュメント
 *   .ai-team/artifacts/data-schema.md  (Designer-1) … Beat 7種 / CONFIG / state
 *   .ai-team/artifacts/spec.md         (Designer-1) … 数値・分岐
 *   .ai-team/artifacts/css-classes.md  (Art-1)      … g- 接頭辞のクラス名
 *
 * ここに書くのは「データをどう再生するか」だけ。
 * 歩行ループ・抽選・エンディング分岐などゲーム固有のルールは js/main.js。
 *
 * 外部依存なし / fetch も import も使わない / file:// で動く。
 * =========================================================================*/
(function (global) {
  'use strict';

  var doc = global.document;

  /* =======================================================================
   * 1. CONFIG — 数値定数はデータに入れずここに置く (data-schema.md §6)
   * ===================================================================== */
  var CONFIG = {
    /* --- spec.md §4.1 (Designer-1 確定値。勝手に変えない) --- */
    totalDistance: 100,
    mentalStart: 100,      // balance-report.md で 90 → 100
    mentalMax: 100,
    walkSec: 5,
    stopSec: 45,
    stopHeal: 4,
    stopHealRepeat: 1,
    walkStartClock: '08:48',   // balance-report.md で 08:49 → 08:48
    startWorkClock: '09:00',
    wakeTarget: '06:50',

    /* --- 演出まわり(Frontend-1 の裁量) --- */
    typeSpeed: 34,        // 1文字あたり ms
    typeSpeedSlow: 82,    // fx:'slow'
    charFade: 240,        // css の g-char-in と揃える
    fadeMs: 900,          // --g-t-fade  シーン切替
    blackMs: 1200,        // --g-t-black 暗転
    clockJumpMs: 900,     // g-clock--jump を外すまで
    mentalHitMs: 420,     // g-mental--hit
    mentalHealMs: 2000,   // g-mental--heal
    alarmMs: 1500,        // アラーム画面を殴りつける時間
    toastGap: 400,        // 複数同時解除のずらし (spec §6)
    beatGap: 240,         // ビート間の既定の間
    replyGap: 500,        // 選択直後 reply までの間
    walkTail: 320,        // 1歩の余韻
    mentalLowAt: 0.40,    // g-mental--low
    mentalCriticalAt: 0.15, // g-mental--critical
    strainAt: 0.30        // g-app--strain
  };

  /* =======================================================================
   * 2. state — data-schema.md §6
   * ===================================================================== */
  var state = {
    sceneId: null,
    remaining: CONFIG.totalDistance,
    mental: CONFIG.mentalStart,
    compliance: 50,
    clockSec: 0,
    flags: {},
    seen: [],
    stats: {
      stepCount: 0, stopCount: 0, backAttempts: 0, mentalMin: CONFIG.mentalMax,
      elapsedSec: 0, seenCount: 0, skippedOP: false
    },
    unlocked: []
  };

  function resetState() {
    state.sceneId = null;
    state.remaining = CONFIG.totalDistance;
    state.mental = CONFIG.mentalStart;
    state.compliance = 50;
    state.clockSec = parseClock(CONFIG.walkStartClock);
    state.flags = {};
    state.seen = [];
    state.stats = {
      stepCount: 0, stopCount: 0, backAttempts: 0, mentalMin: CONFIG.mentalMax,
      elapsedSec: 0, seenCount: 0, skippedOP: false
    };
    state.unlocked = [];
    return state;
  }

  /* =======================================================================
   * 3. セーブ — localStorage キーは1つだけ (data-schema.md §5)
   * ===================================================================== */
  var SAVE_KEY = 'obon100m';
  var SAVE_VERSION = 1;

  function defaultSave() {
    return { v: SAVE_VERSION, skipOP: false, muted: true, soundChosen: false, bgmVolume: 0.7, tutorialSeen: false, plays: 0, achievements: [], endings: [] };
  }

  var Save = {
    data: defaultSave(),
    persistent: false,

    load: function () {
      var raw = null;
      try {
        raw = global.localStorage.getItem(SAVE_KEY);
        this.persistent = true;
      } catch (e) {
        this.persistent = false;   // file:// などで塞がれていてもメモリ上で続行
      }
      var parsed = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
      if (!parsed || parsed.v !== SAVE_VERSION) {
        this.data = defaultSave();
        if (raw) warn('セーブデータを既定値で作り直しました');
      } else {
        var d = defaultSave();
        for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) {
          if (parsed[k] !== undefined) d[k] = parsed[k];
        }
        if (!Array.isArray(d.achievements)) d.achievements = [];
        if (!Array.isArray(d.endings)) d.endings = [];
        this.data = d;
      }
      return this.data;
    },

    flush: function () {
      try { global.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
      catch (e) { this.persistent = false; }
      return this.data;
    },

    get: function (key) { return this.data[key]; },
    set: function (key, value) { this.data[key] = value; return this.flush()[key]; },

    push: function (key, value) {
      var list = this.data[key];
      if (!Array.isArray(list)) list = this.data[key] = [];
      if (list.indexOf(value) < 0) { list.push(value); this.flush(); return true; }
      return false;
    },

    has: function (key, value) {
      var list = this.data[key];
      return Array.isArray(list) && list.indexOf(value) >= 0;
    },

    reset: function () { this.data = defaultSave(); return this.flush(); }
  };

  /* =======================================================================
   * 4. 小物ユーティリティ
   * ===================================================================== */
  var warned = {};
  function warn(msg) {
    if (warned[msg]) return;           // 同じ警告は1回だけ (data-schema.md §8)
    warned[msg] = true;
    if (global.console) global.console.warn('[engine] ' + msg);
  }
  function logError(e) {
    if (global.console) global.console.error('[engine]', e && e.stack ? e.stack : e);
  }

  /** "HH:MM" / "HH:MM:SS" / 数値秒 → 00:00 からの秒 */
  function parseClock(value) {
    if (typeof value === 'number' && isFinite(value)) return wrapDay(value);
    var m = /^\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*$/.exec(String(value == null ? '' : value));
    if (!m) { warn('時刻の形式が読めません: ' + value); return 0; }
    return wrapDay(+m[1] * 3600 + +m[2] * 60 + (+m[3] || 0));
  }
  function wrapDay(sec) { return ((Math.floor(sec) % 86400) + 86400) % 86400; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  /** 秒 → "HH:MM"(withSeconds で "HH:MM:SS") */
  function formatClock(sec, withSeconds) {
    var s = wrapDay(sec);
    var out = pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s / 60) % 60);
    return withSeconds ? out + ':' + pad2(s % 60) : out;
  }
  /** 残り睡眠時間 (data-schema.md §2.3) */
  function sleepLeftText(nowSec, targetClock) {
    var left = parseClock(targetClock) - wrapDay(nowSec);
    if (left <= 0) return 'もう、寝る時間ではない';
    var h = Math.floor(left / 3600);
    var m = Math.floor((left % 3600) / 60);
    return h > 0 ? 'あと ' + h + '時間' + pad2(m) + '分' : 'あと ' + m + '分';
  }

  /** string | string[] → string[] (data-schema.md §1.2 / §8) */
  function toLines(text) {
    if (text === null || text === undefined) return [];
    if (Array.isArray(text)) {
      return text.filter(function (t) { return t !== null && t !== undefined; }).map(String);
    }
    return String(text).split('\n');
  }
  /** tag | tags → string[] (data-schema.md §8) */
  function toTags(value) {
    if (!value) return [];
    return (Array.isArray(value) ? value : [value]).map(String);
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms || 0)); }); }

  /* =======================================================================
   * 5. 音 — js/audio.js (Art-1) への窓口。無くても落ちない
   * ===================================================================== */
  var Sound = {
    call: function (name, args) {
      var A = global.GameAudio;
      if (!A || typeof A[name] !== 'function') return null;
      try { return A[name].apply(A, args || []); } catch (e) { return null; }
    },
    step: function () { return this.call('step'); },
    chat: function () { return this.call('chat'); },
    achievement: function () { return this.call('achievement'); },
    alarm: function () { return this.call('alarm'); },
    stopAlarm: function () { return this.call('stopAlarm', [0.2]); },
    drone: function (opts) { return this.call('drone', [opts]); },
    cicada: function () { return this.call('cicada'); },
    stopCicada: function () { return this.call('stopCicada', [2]); },
    stopAll: function () { return this.call('stopAll'); },
    isMuted: function () {
      var A = global.GameAudio;
      return A && typeof A.isMuted === 'function' ? A.isMuted() : true;
    },
    setMuted: function (muted) { return this.call('setMuted', [muted]); },
    unlock: function () { return this.call('unlock'); }
  };

  /* =======================================================================
   * 6. 演出キー fx / 背景キー bg の対応表
   *    Designer の語彙 → Art のクラス。css-classes.md §15/§16 の適用表どおり。
   *    対応表が変わったらここと View.applyFx / View.applyBg だけ直す。
   * ===================================================================== */
  var FX_TABLE = {
    none: null,
    dim: { target: 'app', cls: 'g-fx--dim', ms: 1600 },
    flash: { target: 'flash', cls: 'g-flash--on', ms: 300 },
    glitch: { target: 'app', cls: 'g-fx--glitch', ms: 700, clockJump: true },
    shake: { target: 'app', cls: 'g-fx--shake', ms: 460, sound: 'step' },
    slow: { target: 'app', cls: 'g-fx--slow', ms: 3200, slow: true },
    pulse: { target: 'app', cls: 'g-fx--pulse', ms: 1500, sound: 'pulse' },
    notify: { target: 'app', cls: 'g-fx--notify', ms: 900, sound: 'chat' },
    alarm: { target: 'alarm', cls: 'g-alarm--on g-alarm--buzz', ms: 0, flash: true, sound: 'alarm' },
    blackout: { target: 'blackout', cls: 'g-blackout--on', ms: 0 }
  };

  /** css-classes.md §16。切替は modifier の張り替えだけ */
  var BG_KEYS = ['room-night', 'room-dark', 'room-morning', 'street', 'office-front', 'keyvisual', 'black'];

  /**
   * 演出の待ち時間は CSS 変数から読む(css-classes.md §13)。
   * JS のタイマーと CSS の時間をずらさないため。
   */
  function cssTime(name, fallback) {
    try {
      var v = global.getComputedStyle(doc.documentElement).getPropertyValue(name).trim();
      if (!v) return fallback;
      if (/ms$/.test(v)) return parseFloat(v);
      if (/s$/.test(v)) return parseFloat(v) * 1000;
      var n = parseFloat(v);
      return isNaN(n) ? fallback : n;
    } catch (e) { return fallback; }
  }
  function syncTimings() {
    CONFIG.fadeMs = cssTime('--g-t-fade', CONFIG.fadeMs);
    CONFIG.blackMs = cssTime('--g-t-black', CONFIG.blackMs);
    CONFIG.toastCycleMs =
      cssTime('--g-t-toast-in', 420) + cssTime('--g-t-toast-hold', 2600) + cssTime('--g-t-toast-out', 700);
    return CONFIG;
  }

  /* =======================================================================
   * 7. View — DOM に触るのはここだけ
   * ===================================================================== */
  function View(refs) {
    var self = this;
    this.el = refs;
    syncTimings();          // 待ち時間は CSS 変数から取る (css-classes.md §13)
    this._typing = [];      // 進行中のタイプ表示
    this._holds = [];       // 進行中の待ち
    this._tapWaiters = [];  // タップ待ち
    this._cancelPick = null;
    this._toastQueue = [];
    this._toastBusy = false;
    this.onCut = null;      // 画面タップ時に main 側で拾いたい場合

    /**
     * タップの受け口は document 全体。
     * g-app は max-width:480px で中央寄せなので、PC など画面が広い環境では
     * アプリ外の黒い余白をクリックしても何も起きない = 「反応しない」に見える。
     * ボタン/チェックの上だけは通常のクリックとして通す。
     */
    if (doc) {
      doc.addEventListener('click', function (ev) {
        var t = ev.target;
        if (t && t.closest && t.closest('button, label, input, a')) return;
        self.cut();
        if (self.onCut) self.onCut();
      });
    }
    if (doc) {
      doc.addEventListener('keydown', function (ev) {
        if (ev.key !== ' ' && ev.key !== 'Enter' && ev.key !== 'Spacebar') return;
        var a = doc.activeElement;
        if (a && (a.tagName === 'BUTTON' || a.tagName === 'INPUT' || a.tagName === 'A')) return;
        ev.preventDefault();
        self.cut();
        if (self.onCut) self.onCut();
      });
    }
  }

  /* --- 待ち -------------------------------------------------------------- */

  /**
   * ms だけ静止する。
   * kind:'type' はタイプ表示中の待ち(1回目のタップで打ち切られる)。
   * hard:true はタップで飛ばせない強制の間。
   */
  View.prototype.hold = function (ms, opts) {
    ms = Math.max(0, ms || 0);
    opts = opts || {};
    if (!ms) return Promise.resolve(false);
    var self = this;
    return new Promise(function (resolve) {
      var entry = { hard: !!opts.hard, kind: opts.kind || 'gap', cut: null };
      var timer = setTimeout(function () { done(false); }, ms);
      entry.cut = function () { done(true); };
      function done(cut) {
        clearTimeout(timer);
        var i = self._holds.indexOf(entry);
        if (i >= 0) self._holds.splice(i, 1);
        resolve(cut);
      }
      self._holds.push(entry);
    });
  };

  /** ▼ を出してタップを待つ */
  View.prototype.waitForTap = function () {
    var self = this;
    this.showNext(true);
    return new Promise(function (resolve) { self._tapWaiters.push(resolve); });
  };

  /**
   * 画面タップ/[進む]から呼ばれる「先へ」。段階的に効く:
   *   1回目 … タイプ中なら全文即時表示
   *   2回目 … 間を打ち切る / タップ待ちを解除
   * 何かを打ち切ったら true。
   */
  View.prototype.cut = function () {
    if (this._typing.length) {
      this._typing.splice(0).forEach(function (t) { t.instant(); });
      this._holds.filter(function (h) { return h.kind === 'type'; }).forEach(function (h) { h.cut(); });
      return true;
    }
    var soft = this._holds.filter(function (h) { return !h.hard; });
    if (soft.length) { soft.forEach(function (h) { h.cut(); }); return true; }
    if (this._tapWaiters.length) {
      this.showNext(false);
      this._tapWaiters.splice(0).forEach(function (w) { w(true); });
      return true;
    }
    return false;
  };

  /** 演出を最後まで飛ばす([進む]連打で入力を捨てないため) */
  View.prototype.cutAll = function () {
    var n = 0;
    while (this.cut() && n < 4) n++;
    return n > 0;
  };

  /** シーン切替などで進行中の待ちを全部畳む */
  View.prototype.abort = function () {
    this._typing.splice(0).forEach(function (t) { t.instant(); });
    this._holds.splice(0).forEach(function (h) { h.cut(); });
    this._tapWaiters.splice(0).forEach(function (w) { w(false); });
    this.showNext(false);
    if (this._cancelPick) { var c = this._cancelPick; this._cancelPick = null; c(); }
    this.clearButtons();
    return this;
  };

  /* --- 本文 -------------------------------------------------------------- */

  View.prototype.clearBody = function () {
    if (this.el.body) this.el.body.innerHTML = '';
    return this;
  };

  /**
   * 本文を1段落表示する。1文字を <span class="g-text__char"> で包み、
   * animation-delay をずらして滲ませる(css-classes.md §3)。
   * 全文即時表示は親に g-text--instant を付けるだけ。
   *
   * opts: { className, speed, replace(既定 true), lead }
   * 返り値: Promise<HTMLElement>
   */
  View.prototype.paragraph = function (text, opts) {
    opts = opts || {};
    var self = this;
    var lines = toLines(text);
    if (opts.replace !== false) this.clearBody();

    var p = doc.createElement('p');
    p.className = 'g-text' + (opts.className ? ' ' + opts.className : '');

    var speed = opts.speed == null ? CONFIG.typeSpeed : opts.speed;
    var index = 0;
    lines.forEach(function (line) {
      var lineEl = doc.createElement('span');
      lineEl.className = 'g-text__line';
      Array.from(line).forEach(function (ch) {
        var c = doc.createElement('span');
        c.className = 'g-text__char';
        c.style.animationDelay = (index * speed) + 'ms';
        c.textContent = ch;
        lineEl.appendChild(c);
        index++;
      });
      if (!line.length) lineEl.innerHTML = '&nbsp;';
      p.appendChild(lineEl);
    });
    this.el.body.appendChild(p);

    var total = index * speed + CONFIG.charFade;
    var entry = { el: p, instant: function () { p.classList.add('g-text--instant'); } };
    this._typing.push(entry);

    return this.hold(total, { kind: 'type' }).then(function () {
      var i = self._typing.indexOf(entry);
      if (i >= 0) self._typing.splice(i, 1);
      p.classList.add('g-text--instant');   // アニメを確定させる
      return p;
    });
  };

  /**
   * タイトル・エンディング・リザルトなど、段落ではないブロックを置く。
   * parts: [{ tag, className, text }]
   */
  View.prototype.block = function (className, parts, opts) {
    opts = opts || {};
    if (opts.replace !== false) this.clearBody();
    var box = doc.createElement(opts.tag || 'div');
    box.className = className || '';
    (parts || []).forEach(function (part) {
      if (!part) return;
      var e = doc.createElement(part.tag || 'div');
      if (part.className) e.className = part.className;
      e.textContent = part.text == null ? '' : String(part.text);
      box.appendChild(e);
    });
    this.el.body.appendChild(box);
    return box;
  };

  /** 段落の末尾に ▼ を出す/消す */
  View.prototype.showNext = function (on) {
    var body = this.el.body;
    if (!body) return;
    var old = body.querySelector('.g-next');
    if (old) old.parentNode.removeChild(old);
    if (!on) return;
    var lines = body.querySelectorAll('.g-text__line');
    var target = lines.length ? lines[lines.length - 1] : body.lastChild;
    if (!target) return;
    var span = doc.createElement('span');
    span.className = 'g-next';
    span.textContent = '▼';
    target.appendChild(span);
  };

  /* --- 選択肢 ------------------------------------------------------------ */

  /**
   * ボタンを並べる(押しても自動では消えない)。
   * list: [{ label, className, disabled, onClick }]
   */
  View.prototype.buttons = function (list, opts) {
    opts = opts || {};
    var box = this.el.choices;
    if (!box) return;
    box.innerHTML = '';
    box.className = 'g-choices' + (opts.stagger ? ' g-choices--stagger' : '');
    (list || []).forEach(function (item) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'g-choice' + (item.className ? ' ' + item.className : '');
      b.textContent = item.label;
      if (item.disabled) { b.disabled = true; b.classList.add('g-choice--disabled'); }
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (typeof item.onClick === 'function') item.onClick(item, ev);
      });
      box.appendChild(b);
    });
  };

  View.prototype.clearButtons = function () {
    var box = this.el.choices;
    if (box) { box.innerHTML = ''; box.className = 'g-choices'; }
  };

  /**
   * 選択肢を出して1つ選ばれるまで待つ。中断時は null。
   * ラベルが同一でも統合しない(spec.md §3.1)。
   */
  View.prototype.pick = function (options, opts) {
    var self = this;
    return new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        self._cancelPick = null;
        self.clearButtons();
        resolve(value);
      }
      self._cancelPick = function () { done(null); };
      self.buttons((options || []).map(function (opt, i) {
        return {
          label: opt.label,
          className: opt.className,
          disabled: opt.disabled,
          onClick: function () { done(Object.assign({ __index: i }, opt)); }
        };
      }), opts);
    });
  };

  /* --- HUD --------------------------------------------------------------- */

  View.prototype.showHud = function (on) {
    if (this.el.hud) this.el.hud.classList.toggle('g-hud--on', !!on);
  };
  View.prototype.setClock = function (sec) {
    if (this.el.clock) this.el.clock.textContent = formatClock(sec);
  };
  View.prototype.clockJump = function () {
    var el = this.el.clock;
    if (!el) return;
    el.classList.remove('g-clock--jump');
    void el.offsetWidth;
    el.classList.add('g-clock--jump');
    setTimeout(function () { el.classList.remove('g-clock--jump'); }, CONFIG.clockJumpMs);
  };
  View.prototype.setDistance = function (m) {
    if (this.el.dist) this.el.dist.textContent = String(m);
  };
  /** メンタル。fill の width だけは JS 直書き OK (css-classes.md §5) */
  View.prototype.setMental = function (value, delta) {
    var ratio = Math.max(0, Math.min(1, value / CONFIG.mentalMax));
    if (this.el.mentalFill) this.el.mentalFill.style.width = (ratio * 100).toFixed(1) + '%';
    if (this.el.mentalVal) this.el.mentalVal.textContent = String(Math.ceil(value));
    var block = this.el.mental;
    if (block) {
      block.classList.toggle('g-mental--low', ratio <= CONFIG.mentalLowAt);
      block.classList.toggle('g-mental--critical', ratio <= CONFIG.mentalCriticalAt);
      if (delta < 0) {
        block.classList.remove('g-mental--hit');
        void block.offsetWidth;
        block.classList.add('g-mental--hit');
        setTimeout(function () { block.classList.remove('g-mental--hit'); }, CONFIG.mentalHitMs);
      } else if (delta > 0) {
        block.classList.add('g-mental--heal');
        setTimeout(function () { block.classList.remove('g-mental--heal'); }, CONFIG.mentalHealMs);
      }
    }
    if (this.el.app) this.el.app.classList.toggle('g-app--strain', ratio <= CONFIG.strainAt);
  };

  /* --- レイヤー演出 ------------------------------------------------------- */

  View.prototype.flash = function () {
    var el = this.el.flash;
    if (!el) return;
    el.classList.remove('g-flash--on');
    void el.offsetWidth;
    el.classList.add('g-flash--on');
    setTimeout(function () { el.classList.remove('g-flash--on'); }, 320);
  };

  /** 暗転。note を渡すと底に一言出る */
  View.prototype.blackout = function (on, note, speed) {
    var el = this.el.blackout;
    if (!el) return Promise.resolve();
    if (this.el.blackoutNote) this.el.blackoutNote.textContent = note || '';
    el.classList.remove('g-blackout--slow', 'g-blackout--fast');
    if (speed === 'slow') el.classList.add('g-blackout--slow');
    if (speed === 'fast') el.classList.add('g-blackout--fast');
    el.classList.toggle('g-blackout--on', !!on);
    return delay(speed === 'fast' ? 320 : (speed === 'slow' ? 2400 : CONFIG.blackMs));
  };

  /** アラーム画面(唯一の白画面)。鳴り続けるので必ず alarm(false) で止める */
  View.prototype.alarm = function (on, timeText, label) {
    var el = this.el.alarm;
    if (!el) return;
    if (on) {
      if (this.el.alarmTime) this.el.alarmTime.textContent = timeText || '';
      if (this.el.alarmLabel && label) this.el.alarmLabel.textContent = label;
      el.classList.add('g-alarm--on', 'g-alarm--buzz');
      this._alarmHandle = Sound.alarm();
    } else {
      el.classList.remove('g-alarm--on', 'g-alarm--buzz');
      if (this._alarmHandle && typeof this._alarmHandle.stop === 'function') {
        try { this._alarmHandle.stop(); } catch (e) {}
      }
      this._alarmHandle = null;
      Sound.stopAlarm();
    }
  };

  /* --- トースト(実績) ---------------------------------------------------- */

  /** 同時解除は 0.4 秒ずつずらして出す (spec.md §6) */
  View.prototype.toast = function (item) {
    this._toastQueue.push(item);
    if (!this._toastBusy) this._pumpToast();
  };
  View.prototype._pumpToast = function () {
    var self = this;
    var item = this._toastQueue.shift();
    if (!item) { this._toastBusy = false; return; }
    this._toastBusy = true;

    var layer = this.el.toasts;
    if (layer) {
      var t = doc.createElement('div');
      t.className = 'g-toast';
      var label = doc.createElement('span');
      label.className = 'g-toast__label';
      label.textContent = item.label || '実績解除';
      var name = doc.createElement('span');
      name.className = 'g-toast__name';
      name.textContent = item.name || '';
      t.appendChild(label);
      t.appendChild(name);
      if (item.desc) {
        var desc = doc.createElement('span');
        desc.className = 'g-toast__desc';
        desc.textContent = item.desc;
        t.appendChild(desc);
      }
      t.addEventListener('animationend', function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      });
      layer.appendChild(t);
    }
    setTimeout(function () { self._pumpToast(); }, CONFIG.toastGap);
  };

  /* --- fx / bg ----------------------------------------------------------- */

  /**
   * 演出キーの適用口。**fx の解釈はここ1箇所**(css-classes.md §15 の適用表)。
   * 返り値の Promise は「本文より先に殴る演出」(alarm / blackout)の完了。
   * 装飾系(dim / shake など)は待たずに解決する。
   */
  View.prototype.applyFx = function (fx, opts) {
    opts = opts || {};
    if (!fx || fx === 'none') return Promise.resolve();
    var def = FX_TABLE[fx];
    if (!def) { warn('未知の fx: ' + fx); return Promise.resolve(); }

    if (def.sound) Sound.call(def.sound);
    if (def.flash) this.flash();
    if (def.clockJump) this.clockJump();

    if (fx === 'alarm') {
      var self = this;
      this.alarm(true, opts.alarmTime || '', opts.alarmLabel);
      /* 鳴りっぱなしにすると選択肢が白画面の下に隠れるので、
         こちらで殴る時間を決めて外す(css-classes.md §15: 外すのは Frontend) */
      return delay(opts.alarmMs || CONFIG.alarmMs).then(function () { self.alarm(false); });
    }
    if (fx === 'blackout') {
      /* 暗転は付けたまま返す。外すのは呼び出し側 */
      return this.blackout(true, opts.note);
    }

    var target = this.el[def.target] || this.el.app;
    if (!target) return Promise.resolve();
    var classes = def.cls.split(' ');
    classes.forEach(function (c) { target.classList.add(c); });
    if (def.ms > 0) {
      setTimeout(function () {
        classes.forEach(function (c) { target.classList.remove(c); });
      }, def.ms);
    }
    return Promise.resolve();
  };

  /**
   * 背景キーの適用口。**bg の解釈はここ1箇所**(css-classes.md §16)。
   * 切替は modifier の張り替えだけ。
   */
  View.prototype.applyBg = function (bg) {
    var el = this.el.bg;
    if (!el) return;
    var key = bg || 'black';
    if (BG_KEYS.indexOf(key) < 0) { warn('未知の bg: ' + key); key = 'black'; }
    el.className = 'g-bg g-bg--' + key;
  };

  /**
   * シーンの表示/非表示(g-scene--on の付け外し)。
   * layer: 'main'(既定) / 'result' — g-scene は複数枚重ねられる
   */
  View.prototype.sceneOn = function (on, layer) {
    var main = this.el.scene, result = this.el.sceneResult;
    if (!on) {
      if (main) main.classList.remove('g-scene--on');
      if (result) result.classList.remove('g-scene--on');
      return;
    }
    var useResult = layer === 'result';
    if (main) main.classList.toggle('g-scene--on', !useResult);
    if (result) result.classList.toggle('g-scene--on', useResult);
  };

  /**
   * リザルト画面を描く(css-classes.md §19〜§22)。
   * data: { ending, rows[], got, total, achievements[], actions[], check }
   */
  View.prototype.renderResult = function (data) {
    var el = this.el;
    data = data || {};

    /* 見出し類の文言は data/ui.js から降ってくる */
    if (el.resultEnding) el.resultEnding.textContent = data.ending || '';
    if (el.resultLabel && data.label) el.resultLabel.textContent = data.label;
    if (el.resultSecToday && data.secToday) el.resultSecToday.textContent = data.secToday;
    if (el.resultSecAch && data.secAch) el.resultSecAch.textContent = data.secAch;
    if (el.achNote && data.countNote) el.achNote.textContent = data.countNote;
    if (el.achSep && data.countSep) el.achSep.textContent = data.countSep;

    if (el.resultStats) {
      el.resultStats.innerHTML = '';
      (data.rows || []).forEach(function (row) {
        var line = doc.createElement('div');
        line.className = 'g-stats__row';
        var key = doc.createElement('dt');
        key.className = 'g-stats__key';
        key.textContent = row.key;
        var dots = doc.createElement('span');
        dots.className = 'g-stats__dots';
        var val = doc.createElement('dd');
        val.className = 'g-stats__val' + (row.text ? ' g-stats__val--text' : '');
        val.textContent = row.val;
        line.appendChild(key);
        line.appendChild(dots);
        line.appendChild(val);
        if (row.unit) {
          var unit = doc.createElement('span');
          unit.className = 'g-stats__unit';
          unit.textContent = row.unit;
          line.appendChild(unit);
        }
        el.resultStats.appendChild(line);
      });
    }

    if (el.achGot) el.achGot.textContent = String(data.got || 0);
    if (el.achTotal) el.achTotal.textContent = String(data.total || 0);
    if (el.achFill) {
      el.achFill.style.width = '0%';
      /* 記録が印字され終わってから伸ばす (css-classes.md §22) */
      var pct = data.total ? (data.got / data.total) * 100 : 0;
      setTimeout(function () { el.achFill.style.width = pct.toFixed(1) + '%'; }, 1300);
    }

    if (el.achList) {
      el.achList.innerHTML = '';
      (data.achievements || []).forEach(function (a) {
        if (a.state === 'hidden') return;          // 存在ごと消す
        var li = doc.createElement('li');
        li.className = 'g-ach ' + (
          a.state === 'locked' ? 'g-ach--locked'
            : a.state === 'new' ? 'g-ach--got g-ach--new' : 'g-ach--got'
        );
        var mark = doc.createElement('span');
        mark.className = 'g-ach__mark';
        li.appendChild(mark);
        if (a.redact) {
          var bar = doc.createElement('span');
          bar.className = 'g-ach__redact';
          li.appendChild(bar);
        } else {
          var name = doc.createElement('span');
          name.className = 'g-ach__name';
          name.textContent = a.name;
          li.appendChild(name);
        }
        if (a.state === 'new') {
          var tag = doc.createElement('span');
          tag.className = 'g-ach__new';
          tag.textContent = '今回';
          li.appendChild(tag);
        }
        if (a.desc) {
          var desc = doc.createElement('span');
          desc.className = 'g-ach__desc';
          desc.textContent = a.desc;
          li.appendChild(desc);
        }
        el.achList.appendChild(li);
      });
    }

    if (el.resultActions) {
      el.resultActions.innerHTML = '';
      (data.actions || []).forEach(function (item) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'g-choice' + (item.className ? ' ' + item.className : '');
        b.textContent = item.label;
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (typeof item.onClick === 'function') item.onClick();
        });
        el.resultActions.appendChild(b);
      });
      if (data.check) {
        var label = doc.createElement('label');
        label.className = 'g-check';
        var input = doc.createElement('input');
        input.className = 'g-check__input';
        input.type = 'checkbox';
        input.checked = !!data.check.checked;
        var box = doc.createElement('span');
        box.className = 'g-check__box';          // :checked + で効かせるので直後に置く
        var text = doc.createElement('span');
        text.textContent = data.check.label;
        input.addEventListener('change', function () {
          if (typeof data.check.onChange === 'function') data.check.onChange(input.checked);
        });
        label.appendChild(input);
        label.appendChild(box);
        label.appendChild(text);
        el.resultActions.appendChild(label);
      }
    }
  };

  View.prototype.setSceneAlign = function (align) {
    var s = this.el.scene;
    if (!s) return;
    s.classList.remove('g-scene--top', 'g-scene--bottom');
    if (align === 'top') s.classList.add('g-scene--top');
    if (align === 'bottom') s.classList.add('g-scene--bottom');
  };

  /* =======================================================================
   * 8. SceneEngine — シーンを順に再生する。Beat は7種だけ
   * ===================================================================== */
  function SceneEngine(opts) {
    opts = opts || {};
    this.view = opts.view;
    this.state = opts.state || state;
    this.scenes = new Map();
    this.modes = new Map();
    this.hooks = opts.hooks || {};   // { achievement, mental, sceneEnter, sceneEnd, beat, missing }
    this.token = 0;
    this.currentId = null;
    this.current = null;
  }

  /** シーン登録。配列 / {id:scene} のどちらでも。同 id は後勝ち */
  SceneEngine.prototype.load = function (scenes) {
    var self = this;
    if (!scenes) return this;
    var list = Array.isArray(scenes) ? scenes : Object.keys(scenes).map(function (k) {
      var s = scenes[k];
      return (s && s.id) ? s : Object.assign({ id: k }, s);
    });
    list.forEach(function (s) {
      if (!s || !s.id) { warn('id の無いシーンを飛ばしました'); return; }
      self.scenes.set(s.id, s);
    });
    return this;
  };
  SceneEngine.prototype.has = function (id) { return this.scenes.has(id); };
  SceneEngine.prototype.getScene = function (id) { return this.scenes.get(id); };
  SceneEngine.prototype.registerMode = function (name, handler) { this.modes.set(name, handler); return this; };
  SceneEngine.prototype.alive = function (token) { return token === this.token; };

  /** シーンへ遷移。前を消す → 暗い間を挟む → 次を出す (css-classes.md §2) */
  SceneEngine.prototype.goto = function (id) {
    var self = this;
    var scene = this.scenes.get(id);
    if (!scene) {
      warn('未定義のシーン: ' + id);
      if (this.hooks.missing) this.hooks.missing(id);
      return Promise.resolve(false);
    }
    var token = ++this.token;
    var view = this.view;

    view.abort();
    var first = !this.current;
    this.current = scene;
    this.currentId = id;
    this.state.sceneId = id;

    return Promise.resolve()
      .then(function () {
        if (first) return null;
        view.sceneOn(false);
        return delay(CONFIG.fadeMs);
      })
      .then(function () {
        if (!self.alive(token)) return false;
        view.clearBody();
        view.clearButtons();
        view.setSceneAlign(scene.align);
        view.applyBg(scene.bg);
        if (scene.clock) {
          self.state.clockSec = parseClock(scene.clock);
          view.setClock(self.state.clockSec);
        }
        if (self.hooks.sceneEnter) self.hooks.sceneEnter(scene, self);
        view.sceneOn(true, scene.layer);
        return delay(first ? 0 : 60);
      })
      .then(function () {
        if (!self.alive(token)) return false;
        if (scene.mode) {
          var handler = self.modes.get(scene.mode);
          if (!handler) { warn('未定義の mode: ' + scene.mode); return false; }
          return handler(scene, self, token);
        }
        return self.runBeats(scene.beats, token, scene).then(function () {
          if (!self.alive(token)) return false;
          if (scene.next) return self.goto(scene.next);
          if (self.hooks.sceneEnd) return self.hooks.sceneEnd(scene, self);
          return true;
        });
      })
      .catch(function (e) { logError(e); return false; });
  };

  /** ビート列を順に再生。jump が出たらそこで終わる */
  SceneEngine.prototype.runBeats = function (beats, token, scene) {
    var self = this;
    var list = Array.isArray(beats) ? beats : [];
    if (!list.length) return Promise.resolve(true);
    var i = 0;
    function next() {
      if (!self.alive(token)) return Promise.resolve(false);
      if (i >= list.length) return Promise.resolve(true);
      var beat = list[i++];
      return self.runBeat(beat, token, scene).then(function (result) {
        /* 中断は token だけで見る。hold() は自然満了で false を返すので
           戻り値を中断扱いにしてはいけない(シーンが無言で途中終了する) */
        if (!self.alive(token)) return false;
        if (result && result.jumped) return false;   // 遷移済み
        return next();
      });
    }
    return next();
  };

  /**
   * Beat 1本。実装するのは data-schema.md §2.2 の7種のみ。
   * 未知の type は console.warn 1回で読み飛ばす。
   */
  SceneEngine.prototype.runBeat = function (beat, token, scene) {
    var self = this;
    var view = this.view;
    if (!beat || !beat.type) { warn('type の無い beat を飛ばしました'); return Promise.resolve(true); }
    if (this.hooks.beat) this.hooks.beat(beat, this);

    switch (beat.type) {
      case 'text':      return this._beatText(beat, token, scene);
      case 'wait':      return this._beatWait(beat, token);
      case 'choice':    return this._beatChoice(beat, token, scene);
      case 'clock':     return this._beatClock(beat, token);
      case 'achievement':
        this.fireAchievement(beat.id);
        return Promise.resolve(true);
      case 'mental':
        if (typeof beat.set === 'number') this.setMental(beat.set);
        else this.addMental(beat.value || 0);
        if (beat.fx) view.applyFx(beat.fx);
        return Promise.resolve(true);
      case 'jump':
        if (!beat.to) { warn('jump に to がありません'); return Promise.resolve(true); }
        this.goto(beat.to);
        return Promise.resolve({ jumped: true });
      default:
        warn('未知の beat type: ' + beat.type);
        return Promise.resolve(true);
    }
  };

  SceneEngine.prototype._beatText = function (beat, token, scene) {
    var self = this;
    var view = this.view;
    var slow = beat.fx === 'slow';

    var lines = toLines(beat.text);
    if (beat.sleepLeft) lines = lines.concat([sleepLeftText(this.state.clockSec, CONFIG.wakeTarget)]);

    var pre = Promise.resolve();
    /* アラーム/暗転は本文より先に殴る */
    if (beat.fx === 'alarm' || beat.fx === 'blackout') {
      pre = view.applyFx(beat.fx, {
        alarmTime: formatClock(this.state.clockSec).replace(/^0/, ''),
        alarmLabel: scene && scene.label ? scene.label : undefined
      }).then(function () {
        if (beat.fx === 'blackout') return view.blackout(false);
      });
    }

    return pre.then(function () {
      if (!self.alive(token)) return false;
      if (typeof beat.sec === 'number') self.advanceClock(beat.sec);
      if (typeof beat.mental === 'number') self.addMental(beat.mental);
      return view.paragraph(lines, {
        className: beat.className,
        speed: slow ? CONFIG.typeSpeedSlow : CONFIG.typeSpeed
      });
    }).then(function (p) {
      if (p === false || !self.alive(token)) return false;
      if (beat.fx && beat.fx !== 'alarm' && beat.fx !== 'blackout') view.applyFx(beat.fx);
      /* hold() の false は「時間満了（スキップされなかった）」であり失敗ではない。 */
      if (typeof beat.auto === 'number') {
        return view.hold(beat.auto).then(function () { return self.alive(token); });
      }
      return view.hold(CONFIG.beatGap).then(function () {
        if (!self.alive(token)) return false;
        return view.waitForTap();
      });
    }).then(function () {
      return self.alive(token);
    });
  };

  SceneEngine.prototype._beatWait = function (beat, token) {
    var self = this;
    var view = this.view;
    var ms = typeof beat.ms === 'number' ? beat.ms : 800;
    if (!beat.fx || beat.fx === 'none') return view.hold(ms).then(function () { return self.alive(token); });
    if (beat.fx === 'blackout') {
      return view.blackout(true, beat.note)
        .then(function () { return view.hold(ms, { hard: true }); })
        .then(function () { return view.blackout(false); })
        .then(function () { return self.alive(token); });
    }
    return view.applyFx(beat.fx)
      .then(function () { return view.hold(ms); })
      .then(function () { return self.alive(token); });
  };

  SceneEngine.prototype._beatChoice = function (beat, token, scene) {
    var self = this;
    var view = this.view;
    var options = Array.isArray(beat.options) ? beat.options : [];
    if (!options.length) { warn('options の無い choice を飛ばしました'); return Promise.resolve(true); }

    var pre = Promise.resolve();
    if (beat.prompt) {
      pre = view.paragraph(beat.prompt, { className: 'g-text--dim g-text--small' })
        .then(function () { return view.hold(CONFIG.beatGap); });
    }

    return pre.then(function () {
      if (!self.alive(token)) return false;
      /* 同一ラベルでも統合しない (spec.md §3.1) */
      return view.pick(options, { stagger: true });
    }).then(function (opt) {
      if (!opt || !self.alive(token)) return false;
      return self.applyOption(opt, token, scene);
    });
  };

  /** Option の効果適用 (data-schema.md §2.2 Option) */
  SceneEngine.prototype.applyOption = function (opt, token, scene) {
    var self = this;
    var view = this.view;
    if (typeof opt.sec === 'number') this.advanceClock(opt.sec);
    if (typeof opt.mental === 'number') this.addMental(opt.mental);
    if (typeof opt.compliance === 'number') {
      this.state.compliance = Math.max(0, Math.min(100, this.state.compliance + opt.compliance));
    }
    if (opt.sound) Sound.call(opt.sound);
    if (opt.flag) this.state.flags[opt.flag] = true;
    if (opt.achievement) this.fireAchievement(opt.achievement);

    var reply = toLines(opt.reply);
    var seq = Promise.resolve(true);
    if (reply.length) {
      seq = view.hold(CONFIG.replyGap).then(function () {
        if (!self.alive(token)) return false;
        return view.paragraph(reply, {});
      }).then(function (p) {
        if (p === false || !self.alive(token)) return false;
        if (opt.fx) view.applyFx(opt.fx);
        if (typeof opt.auto === 'number') {
          return view.hold(opt.auto).then(function () { return self.alive(token); });
        }
        return view.hold(CONFIG.beatGap).then(function () { return view.waitForTap(); });
      });
    } else if (opt.fx) {
      view.applyFx(opt.fx);
    }

    return seq.then(function () {
      if (token !== undefined && !self.alive(token)) return false;
      if (opt.to) { self.goto(opt.to); return { jumped: true }; }
      return true;
    });
  };

  /** 時計ビート。数字が動くのを見せる (名場面: 「あと5分」で5分以上進む) */
  SceneEngine.prototype._beatClock = function (beat, token) {
    var self = this;
    var view = this.view;
    var from = this.state.clockSec;
    var to = beat.to !== undefined && beat.to !== null
      ? parseClock(beat.to)
      : wrapDay(from + (beat.sec || 0));
    var ms = typeof beat.ms === 'number' ? beat.ms : 600;

    /* 本文欄に時計を出す(OP は HUD が消えているため) */
    var p = doc.createElement('p');
    p.className = 'g-text g-text--center';
    var big = doc.createElement('span');
    big.className = 'g-clock';
    big.textContent = formatClock(from);
    p.appendChild(big);
    if (beat.label) {
      var lab = doc.createElement('span');
      lab.className = 'g-text__line g-text--faint g-text--small';
      lab.textContent = beat.label;
      p.appendChild(lab);
    }
    view.clearBody();
    view.el.body.appendChild(p);
    if (beat.fx) view.applyFx(beat.fx);

    var start = null;
    var span = (to - from + 86400) % 86400;
    return new Promise(function (resolve) {
      function frame(now) {
        if (start === null) start = now;
        var t = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
        var eased = 1 - Math.pow(1 - t, 3);
        big.textContent = formatClock(from + span * eased);
        if (t < 1 && self.alive(token)) global.requestAnimationFrame(frame);
        else resolve();
      }
      if (global.requestAnimationFrame) global.requestAnimationFrame(frame);
      else { big.textContent = formatClock(to); resolve(); }
    }).then(function () {
      if (!self.alive(token)) return false;
      self.state.clockSec = to;
      view.setClock(to);
      view.clockJump();
      /*
       * 時計演出は OP の自動進行シーケンスにも使われる。
       * ここで常にタップ待ちへ入ると、auto を持たない clock beat が
       * 03:24 / 08:49 の表示で停止して見えるため、通常は演出後に進める。
       * 明示的に手動送りにしたい場合だけ waitForTap を指定する。
       */
      return view.hold(typeof beat.auto === 'number' ? beat.auto : CONFIG.beatGap)
        .then(function () {
          if (!self.alive(token)) return false;
          return beat.waitForTap ? view.waitForTap() : true;
        });
    }).then(function () { return self.alive(token); });
  };

  /* --- state 操作の窓口 --------------------------------------------------- */

  SceneEngine.prototype.advanceClock = function (sec) {
    if (!sec) return this.state.clockSec;
    this.state.clockSec = wrapDay(this.state.clockSec + sec);
    this.view.setClock(this.state.clockSec);
    return this.state.clockSec;
  };

  SceneEngine.prototype.addMental = function (delta) {
    return this.setMental(this.state.mental + (delta || 0), delta);
  };

  SceneEngine.prototype.setMental = function (value, delta) {
    var before = this.state.mental;
    this.state.mental = Math.max(0, Math.min(CONFIG.mentalMax, value));
    if (this.state.mental < this.state.stats.mentalMin) this.state.stats.mentalMin = this.state.mental;
    this.view.setMental(this.state.mental, delta === undefined ? this.state.mental - before : delta);
    if (this.hooks.mental) this.hooks.mental(this.state.mental, this.state.mental - before);
    return this.state.mental;
  };

  SceneEngine.prototype.fireAchievement = function (id) {
    if (!id) return false;
    if (this.hooks.achievement) return this.hooks.achievement(id);
    return false;
  };

  /* =======================================================================
   * 9. 公開
   * ===================================================================== */
  global.Engine = {
    CONFIG: CONFIG,
    state: state,
    resetState: resetState,
    Save: Save,
    Sound: Sound,
    View: View,
    SceneEngine: SceneEngine,
    FX_TABLE: FX_TABLE,
    /* utils */
    parseClock: parseClock,
    formatClock: formatClock,
    sleepLeftText: sleepLeftText,
    toLines: toLines,
    toTags: toTags,
    delay: delay,
    warn: warn
  };

})(window);
