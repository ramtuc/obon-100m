/* ============================================================================
   会社まであと100m  —  audio.js
   Art-1 / Visual & Sound Director

   WebAudio API だけで音を「生成」する。音声ファイルは一切読まない。
   file:// で動く。外部依存なし。

   --- 大原則 -------------------------------------------------------------
     1. 初期状態はミュート。
     2. ユーザーが一度でも画面に触れる(pointerdown / keydown / click)まで、
        AudioContext すら作らない。触れる前は何をどう呼んでも絶対に鳴らない。
     3. 鳴るのは  ユーザー操作済み && ミュート解除済み  の時だけ。

   --- 使い方 -------------------------------------------------------------
     // ボタンのクリックハンドラの中から呼ぶこと(ブラウザの自動再生規制のため)
     GameAudio.setMuted(false);       // 音を出す
     GameAudio.toggleMute();          // 切替。新しい muted 値を返す
     GameAudio.isMuted();             // 真偽値

     GameAudio.step();                            // 足音
     GameAudio.chat();                            // チャット通知音
     GameAudio.achievement();                     // 実績解除音
     const al = GameAudio.alarm();                // 目覚まし(鳴り続ける)
     al.stop();  /  GameAudio.stopAlarm();        // 止める
     const se = GameAudio.cicada();               // 蝉/環境音(鳴り続ける)
     se.stop(2); /  GameAudio.stopCicada();       // 2秒かけて消す
     GameAudio.stopAll();                         // 全部止める

     GameAudio.play('step');                      // 名前で呼ぶ場合
     GameAudio.onChange(fn);                      // ミュート状態の変化を受け取る
     GameAudio.setVolume(0.7);                    // 全体音量 0..1
   ========================================================================= */

(function (global) {
  'use strict';

  var AC = global.AudioContext || global.webkitAudioContext;

  /* ------------------------------------------------------------------------
     状態
     --------------------------------------------------------------------- */

  var ctx = null;          // AudioContext。ユーザー操作前は null のまま
  var master = null;       // 全体音量
  var bus = null;          // コンプレッサ(蝉+アラームが重なっても割れないように)
  var muted = true;        // ★初期はミュート
  var volume = 0.7;
  var gestured = false;    // ユーザーが一度でも触ったか
  var noise = null;        // ホワイトノイズのバッファ(使い回す)
  var listeners = [];      // ミュート変化の購読者
  var loops = [];          // 鳴り続けている音のハンドル
  var stepFoot = 0;        // 左右の足の交代用

  var LEVEL = {            // 音ごとの基準音量。ここだけ触れば音量バランスが変わる
    alarm:       0.50,
    step:        0.17,
    chat:        0.26,
    achievement: 0.20,
    drone:       0.12,
    cicada:      0.15
  };

  var MIN = 0.0001;        // exponentialRamp に 0 は渡せない

  /* ------------------------------------------------------------------------
     ユーザー操作の検出
     ここではまだ AudioContext を作らない。フラグを立てるだけ。
     --------------------------------------------------------------------- */

  function markGesture() {
    if (gestured) return;
    gestured = true;
    // ミュート解除済みで待たされていた場合だけ、ここで初めて音の道を作る
    if (!muted) ensureCtx();
  }

  ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'].forEach(function (ev) {
    global.addEventListener(ev, markGesture, { capture: true, passive: true });
  });

  /* ------------------------------------------------------------------------
     AudioContext の用意
     --------------------------------------------------------------------- */

  function ensureCtx() {
    if (ctx) return ctx;
    if (!AC) return null;          // 非対応ブラウザ。以降すべて無音で素通り
    if (!gestured) return null;    // ★操作前は作らない

    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return null;
    }

    bus = ctx.createDynamicsCompressor();
    bus.threshold.value = -18;
    bus.knee.value = 24;
    bus.ratio.value = 6;
    bus.attack.value = 0.004;
    bus.release.value = 0.18;

    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;

    bus.connect(master);
    master.connect(ctx.destination);

    noise = makeNoise(2.0);
    resume();
    return ctx;
  }

  function resume() {
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) {
      var p = ctx.resume();
      if (p && p.catch) p.catch(function () {});
    }
    // iOS 対策: 無音を1発通して完全に解錠する
    try {
      var s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(ctx.destination);
      s.start(0);
    } catch (e) {}
  }

  /** 実際に音を出してよいか。ここを通らない限り何も鳴らない。 */
  function live() {
    if (muted || !gestured) return null;
    var c = ensureCtx();
    if (!c) return null;
    if (c.state === 'suspended') resume();
    return c;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  /* ------------------------------------------------------------------------
     小道具
     --------------------------------------------------------------------- */

  function makeNoise(sec) {
    var len = Math.floor(ctx.sampleRate * sec);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function noiseSource(loop) {
    var s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = loop !== false;
    return s;
  }

  function gain(v) {
    var g = ctx.createGain();
    g.gain.value = v === undefined ? 1 : v;
    return g;
  }

  function filter(type, freq, q) {
    var f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  function osc(type, freq) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  function panner(pos) {
    if (!ctx.createStereoPanner) return null;
    var p = ctx.createStereoPanner();
    p.pan.value = pos;
    return p;
  }

  /** 立ち上がり→減衰 の一発もの用エンベロープ */
  function pluck(g, t0, peak, attack, decay) {
    var p = g.gain;
    p.cancelScheduledValues(t0);
    p.setValueAtTime(MIN, t0);
    p.exponentialRampToValueAtTime(Math.max(peak, MIN), t0 + attack);
    p.exponentialRampToValueAtTime(MIN, t0 + attack + decay);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function track(handle) {
    loops.push(handle);
    return handle;
  }

  function untrack(handle) {
    var i = loops.indexOf(handle);
    if (i >= 0) loops.splice(i, 1);
  }

  /* ========================================================================
     1. 目覚ましアラーム
     デジタル時計の、あの音。高い矩形波を4回叩いて少し休む、を延々と繰り返す。
     ======================================================================== */

  function alarm(opts) {
    opts = opts || {};
    var c = live();
    var handle = {
      type: 'alarm',
      stopped: false,
      stop: function () {}
    };
    if (!c) return handle;      // 鳴らせない状況でも、同じ形のハンドルは返す

    var out = gain(opts.volume === undefined ? LEVEL.alarm : opts.volume);
    out.connect(bus);

    var timer = null;
    var ON = 0.105, GAP = 0.105, REST = 0.55, BEEPS = 4;
    var BAR = BEEPS * (ON + GAP) + REST;

    function beep(t) {
      var g = gain(MIN);
      var lp = filter('lowpass', 5200);
      // 2本重ねると、耳に刺さる「うなり」が出る
      var a = osc('square', 2093);          // C7
      var b = osc('square', 2637);          // E7
      b.detune.value = rand(-14, 14);

      a.connect(g); b.connect(g);
      g.connect(lp); lp.connect(out);

      pluck(g, t, 0.55, 0.004, ON);
      a.start(t); b.start(t);
      a.stop(t + ON + 0.05); b.stop(t + ON + 0.05);

      var kill = function () { try { g.disconnect(); lp.disconnect(); } catch (e) {} };
      a.onended = kill;
    }

    function bar(t0) {
      for (var i = 0; i < BEEPS; i++) beep(t0 + i * (ON + GAP));
      return t0 + BAR;
    }

    var next = bar(now() + 0.02);

    function pump() {
      if (handle.stopped) return;
      // 先読みして途切れさせない
      while (next < now() + 1.2) next = bar(next);
      timer = global.setTimeout(pump, 400);
    }
    pump();

    handle.stop = function (fade) {
      if (handle.stopped) return;
      handle.stopped = true;
      if (timer) global.clearTimeout(timer);
      var t = now();
      var f = fade === undefined ? 0.06 : fade;
      try {
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(Math.max(out.gain.value, MIN), t);
        out.gain.exponentialRampToValueAtTime(MIN, t + f);
      } catch (e) {}
      global.setTimeout(function () {
        try { out.disconnect(); } catch (e) {}
      }, (f + 0.2) * 1000);
      untrack(handle);
    };

    return track(handle);
  }

  function stopAlarm(fade) {
    loops.slice().forEach(function (h) {
      if (h.type === 'alarm') h.stop(fade);
    });
  }

  /* ========================================================================
     2. 足音
     アスファルト。短いノイズの擦れ + 低い踏み込み。
     1歩ごとに微妙にずらして、機械的な繰り返しに聞こえないようにする。
     ======================================================================== */

  function step(opts) {
    opts = opts || {};
    var c = live();
    if (!c) return null;

    var t = now() + 0.005;
    var vol = (opts.volume === undefined ? LEVEL.step : opts.volume);
    stepFoot = 1 - stepFoot;

    var out = gain(vol);
    var p = panner(stepFoot ? -0.18 : 0.18);
    if (p) { out.connect(p); p.connect(bus); } else { out.connect(bus); }

    // 靴底の擦れ
    var n = noiseSource(false);
    var bp = filter('bandpass', rand(1250, 1850), 1.1);
    var ng = gain(MIN);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    pluck(ng, t, rand(0.75, 1.0), 0.003, rand(0.075, 0.105));
    n.start(t);
    n.stop(t + 0.22);

    // 踏み込み
    var lo = osc('sine', 78);
    var lg = gain(MIN);
    lo.frequency.setValueAtTime(rand(74, 86), t);
    lo.frequency.exponentialRampToValueAtTime(44, t + 0.1);
    lo.connect(lg); lg.connect(out);
    pluck(lg, t, 0.45, 0.004, 0.1);
    lo.start(t);
    lo.stop(t + 0.2);

    lo.onended = function () {
      try { out.disconnect(); if (p) p.disconnect(); } catch (e) {}
    };
    return true;
  }

  /* ========================================================================
     3. チャット通知音
     二音。冷たく、短く、歓迎されない。
     ======================================================================== */

  function chat(opts) {
    opts = opts || {};
    var c = live();
    if (!c) return null;

    var t = now() + 0.005;
    var out = gain(opts.volume === undefined ? LEVEL.chat : opts.volume);
    var hp = filter('highpass', 620);          // スマホのスピーカーらしく痩せさせる
    out.connect(hp); hp.connect(bus);

    // D6 → G6
    [[1174.66, 0.0], [1567.98, 0.085]].forEach(function (pair, i) {
      var f = pair[0], d = pair[1];
      var g = gain(MIN);
      var a = osc('sine', f);
      var b = osc('triangle', f * 2);
      var bg = gain(0.22);
      a.connect(g); b.connect(bg); bg.connect(g);
      g.connect(out);
      pluck(g, t + d, i === 0 ? 0.5 : 0.62, 0.004, 0.24);
      a.start(t + d); b.start(t + d);
      a.stop(t + d + 0.32); b.stop(t + d + 0.32);
      if (i === 1) {
        a.onended = function () { try { out.disconnect(); hp.disconnect(); } catch (e) {} };
      }
    });
    return true;
  }

  /* ========================================================================
     4. 実績解除音
     祝わない。マイナーの三音を、小さく、素っ気なく置くだけ。
     ======================================================================== */

  function achievement(opts) {
    opts = opts || {};
    var c = live();
    if (!c) return null;

    var t = now() + 0.01;
    var out = gain(opts.volume === undefined ? LEVEL.achievement : opts.volume);
    var lp = filter('lowpass', 4200);
    out.connect(lp); lp.connect(bus);

    var notes = [880.0, 1046.5, 1318.5];       // A5 - C6 - E6 (Am)
    notes.forEach(function (f, i) {
      var d = i * 0.115;
      var g = gain(MIN);
      var a = osc('triangle', f);
      var b = osc('sine', f * 2);
      var bg = gain(0.3);
      a.connect(g); b.connect(bg); bg.connect(g);
      g.connect(out);
      pluck(g, t + d, 0.42, 0.018, i === notes.length - 1 ? 0.62 : 0.34);
      a.start(t + d); b.start(t + d);
      var end = t + d + (i === notes.length - 1 ? 0.7 : 0.42);
      a.stop(end); b.stop(end);
      if (i === notes.length - 1) {
        a.onended = function () { try { out.disconnect(); lp.disconnect(); } catch (e) {} };
      }
    });
    return true;
  }

  /* 危機演出用の低い二拍。 */
  function pulse(opts) {
    opts = opts || {};
    var c = live();
    if (!c) return null;
    var t = now() + 0.01;
    var out = gain(opts.volume === undefined ? 0.28 : opts.volume);
    var lp = filter('lowpass', 150);
    out.connect(lp); lp.connect(bus);
    [0, 0.22].forEach(function (d, i) {
      var o = osc('sine', i ? 48 : 54);
      var g = gain(MIN);
      o.connect(g); g.connect(out);
      o.frequency.exponentialRampToValueAtTime(38, t + d + 0.18);
      pluck(g, t + d, i ? 0.62 : 0.82, 0.008, 0.2);
      o.start(t + d); o.stop(t + d + 0.3);
      if (i === 1) o.onended = function () {
        try { out.disconnect(); lp.disconnect(); } catch (e) {}
      };
    });
    return true;
  }

  /* ========================================================================
     5. 蝉 / 環境音
     蝉 = 帯域を絞ったノイズを、60〜80Hz の低速波で振幅変調したもの。
     これに、ゆっくりした唸りのうねりと、遠くの車の低い唸りを重ねる。
     鳴り続けるので、必ずハンドルで止めること。
     ======================================================================== */

  function cicada(opts) {
    opts = opts || {};
    var c = live();
    var handle = { type: 'cicada', stopped: false, stop: function () {} };
    if (!c) return handle;

    var target = (opts.volume === undefined ? LEVEL.cicada : opts.volume);
    var fadeIn = opts.fadeIn === undefined ? 2.4 : opts.fadeIn;
    var t = now() + 0.02;

    var out = gain(MIN);
    out.connect(bus);
    out.gain.setValueAtTime(MIN, t);
    out.gain.exponentialRampToValueAtTime(Math.max(target, MIN), t + fadeIn);

    var parts = [];

    // --- 蝉、3匹ぶん。それぞれ帯域と羽音の速さが違う ---
    var voices = [
      { band: 3300, q: 1.6, buzz: 62, depth: 0.72, level: 0.34, swell: 0.085 },
      { band: 4300, q: 2.1, buzz: 74, depth: 0.62, level: 0.26, swell: 0.062 },
      { band: 5400, q: 2.6, buzz: 88, depth: 0.55, level: 0.18, swell: 0.11  }
    ];

    voices.forEach(function (v) {
      var n = noiseSource(true);
      var bp = filter('bandpass', v.band, v.q);
      var vg = gain(v.level * 0.45);

      // 羽音(高速AM) — これが「ジー」の正体
      var buzz = osc('sawtooth', v.buzz);
      var buzzDepth = gain(v.level * v.depth * 0.45);
      buzz.connect(buzzDepth);
      buzzDepth.connect(vg.gain);

      // 合唱のうねり(低速AM) — 遠くで盛り上がっては引く
      var swell = osc('sine', v.swell);
      var swellDepth = gain(v.level * 0.3);
      swell.connect(swellDepth);
      swellDepth.connect(vg.gain);

      n.connect(bp); bp.connect(vg); vg.connect(out);

      n.start(t); buzz.start(t); swell.start(t);
      parts.push(n, buzz, swell);
    });

    // --- 遠くの道路。無いと蝉が宙に浮く ---
    if (opts.road !== false) {
      var rn = noiseSource(true);
      var rlp = filter('lowpass', 190, 0.7);
      var rg = gain(0.5);
      rn.connect(rlp); rlp.connect(rg); rg.connect(out);
      rn.start(t);
      parts.push(rn);
    }

    handle.stop = function (fade) {
      if (handle.stopped) return;
      handle.stopped = true;
      var f = fade === undefined ? 1.6 : fade;
      var t0 = now();
      try {
        out.gain.cancelScheduledValues(t0);
        out.gain.setValueAtTime(Math.max(out.gain.value, MIN), t0);
        out.gain.exponentialRampToValueAtTime(MIN, t0 + f);
      } catch (e) {}
      parts.forEach(function (p) { try { p.stop(t0 + f + 0.05); } catch (e) {} });
      global.setTimeout(function () {
        try { out.disconnect(); } catch (e) {}
      }, (f + 0.3) * 1000);
      untrack(handle);
    };

    return track(handle);
  }

  function stopCicada(fade) {
    loops.slice().forEach(function (h) {
      if (h.type === 'cicada') h.stop(fade);
    });
  }

  /* ゆっくり和音が巡るアンビエントBGM。低周波の振動ではなく、音楽として薄く残す。 */
  function drone(opts) {
    opts = opts || {};
    var c = live();
    var handle = { type: 'drone', stopped: !c, stop: function () {}, setTension: function () {}, setVolume: function () {} };
    if (!c) return handle;
    var t = now() + 0.02;
    var out = gain(MIN);
    var lp = filter('lowpass', 1800, 0.7);
    out.connect(lp); lp.connect(bus);
    out.gain.exponentialRampToValueAtTime(Math.max(opts.volume === undefined ? LEVEL.drone : opts.volume, MIN), t + 3.5);

    /* Am9 → Fmaj7 → Cmaj7/G → Em7。5.5秒ごとに溶けるように移る。 */
    var chords = [
      [220.00, 261.63, 329.63, 493.88],
      [174.61, 220.00, 261.63, 329.63],
      [196.00, 246.94, 261.63, 329.63],
      [164.81, 196.00, 246.94, 329.63]
    ];
    var melody = [659.25, 523.25, 493.88, 392.00];
    var voices = chords[0].map(function (freq, i) {
      var o = osc(i % 2 ? 'triangle' : 'sine', freq);
      var g = gain(i === 0 ? 0.2 : 0.14);
      o.connect(g); g.connect(out); o.start(t);
      return { osc: o, gain: g };
    });
    var unease = osc('sine', 369.99);
    var uneaseGain = gain(MIN);
    unease.connect(uneaseGain); uneaseGain.connect(out); unease.start(t);
    var chordIndex = 0, chordTimer = null, bellTimers = [];

    function playBell(freq) {
      if (handle.stopped) return;
      var t0 = now(), o = osc('sine', freq), overtone = osc('sine', freq * 2), g = gain(MIN), og = gain(0.16);
      o.connect(g); overtone.connect(og); og.connect(g); g.connect(out);
      pluck(g, t0, 0.11, 0.04, 1.8);
      o.start(t0); overtone.start(t0); o.stop(t0 + 2); overtone.stop(t0 + 2);
      o.onended = function () { try { o.disconnect(); overtone.disconnect(); g.disconnect(); og.disconnect(); } catch (e) {} };
    }

    function advanceChord() {
      if (handle.stopped) return;
      var chord = chords[chordIndex], note = melody[chordIndex], t0 = now();
      voices.forEach(function (voice, i) {
        voice.osc.frequency.cancelScheduledValues(t0);
        voice.osc.frequency.linearRampToValueAtTime(chord[i], t0 + 3.2);
      });
      bellTimers.push(global.setTimeout(function () { playBell(note); }, 2100));
      chordIndex = (chordIndex + 1) % chords.length;
      chordTimer = global.setTimeout(advanceChord, 5500);
    }
    advanceChord();

    handle.stopped = false;
    handle.setTension = function (value) {
      if (handle.stopped) return;
      var tension = Math.max(0, Math.min(1, Number(value) || 0));
      var t0 = now();
      uneaseGain.gain.cancelScheduledValues(t0);
      uneaseGain.gain.linearRampToValueAtTime(MIN + tension * 0.045, t0 + 1.5);
      lp.frequency.cancelScheduledValues(t0);
      lp.frequency.linearRampToValueAtTime(1800 - tension * 650, t0 + 1.5);
    };
    handle.setVolume = function (value) {
      if (handle.stopped) return;
      var v = Math.max(0, Math.min(0.2, Number(value) || 0));
      var t0 = now();
      out.gain.cancelScheduledValues(t0);
      out.gain.setValueAtTime(Math.max(out.gain.value, MIN), t0);
      out.gain.linearRampToValueAtTime(v, t0 + 0.18);
    };
    handle.setTension(opts.tension || 0);
    handle.stop = function (fade) {
      if (handle.stopped) return;
      handle.stopped = true;
      var f = fade === undefined ? 1.8 : fade, t0 = now();
      out.gain.cancelScheduledValues(t0);
      out.gain.setValueAtTime(Math.max(out.gain.value, MIN), t0);
      out.gain.exponentialRampToValueAtTime(MIN, t0 + f);
      if (chordTimer) global.clearTimeout(chordTimer);
      bellTimers.forEach(function (timer) { global.clearTimeout(timer); });
      voices.forEach(function (voice) { try { voice.osc.stop(t0 + f + 0.05); } catch (e) {} });
      try { unease.stop(t0 + f + 0.05); } catch (e) {}
      global.setTimeout(function () { try { out.disconnect(); lp.disconnect(); } catch (e) {} }, (f + 0.2) * 1000);
      untrack(handle);
    };
    return track(handle);
  }

  /* ------------------------------------------------------------------------
     ミュート / 音量 / 後片付け
     --------------------------------------------------------------------- */

  function applyMasterGain(immediate) {
    if (!master || !ctx) return;
    var t = ctx.currentTime;
    var to = muted ? 0 : volume;
    try {
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      // 0 を跨ぐので linear。ぶつ切りのクリックノイズだけ避ける
      master.gain.linearRampToValueAtTime(to, t + (immediate ? 0.01 : 0.08));
    } catch (e) {
      master.gain.value = to;
    }
  }

  function notify() {
    listeners.slice().forEach(function (fn) {
      try { fn(muted); } catch (e) {}
    });
  }

  function setMuted(next) {
    var v = !!next;
    if (v === muted) return muted;
    muted = v;
    if (!muted) {
      // 解除はユーザー操作の中から呼ばれる想定。ここで初めて道が通る。
      if (gestured) { ensureCtx(); resume(); }
    } else {
      stopAll(0.12);
    }
    applyMasterGain();
    notify();
    return muted;
  }

  function stopAll(fade) {
    loops.slice().forEach(function (h) {
      try { h.stop(fade); } catch (e) {}
    });
    loops.length = 0;
  }

  // 裏に回ったら黙る(アラームが鳴りっぱなしで裏に居座るのを防ぐ)
  global.document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (global.document.hidden) {
      if (ctx.suspend) { var p = ctx.suspend(); if (p && p.catch) p.catch(function () {}); }
    } else if (!muted) {
      resume();
    }
  });

  /* ------------------------------------------------------------------------
     公開API
     --------------------------------------------------------------------- */

  var SOUNDS = {
    alarm: alarm,
    step: step,
    chat: chat,
    achievement: achievement,
    pulse: pulse,
    drone: drone,
    cicada: cicada
  };

  global.GameAudio = {
    /** 音の名前一覧 */
    SOUNDS: ['alarm', 'step', 'chat', 'achievement', 'pulse', 'drone', 'cicada'],

    /* --- 5種の音 --- */
    alarm: alarm,                 // 目覚まし。ハンドルを返す(鳴り続ける)
    stopAlarm: stopAlarm,
    step: step,                   // 足音。一発
    chat: chat,                   // チャット通知音。一発
    achievement: achievement,     // 実績解除音。一発
    pulse: pulse,                 // 危機演出用の低い心音
    drone: drone,                 // 薄い環境BGM。停止ハンドルを返す
    cicada: cicada,               // 蝉+環境音。ハンドルを返す(鳴り続ける)
    stopCicada: stopCicada,
    ambience: cicada,             // 別名

    /** 名前で鳴らす。GameAudio.play('step') */
    play: function (name, opts) {
      var fn = SOUNDS[name];
      return fn ? fn(opts) : null;
    },

    /* --- ミュート --- */
    isMuted: function () { return muted; },
    setMuted: setMuted,
    toggleMute: function () { return setMuted(!muted); },
    /** ミュート状態が変わったら呼ばれる。fn(muted) / 解除関数を返す */
    onChange: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    /* --- 音量 --- */
    getVolume: function () { return volume; },
    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0));
      applyMasterGain();
      return volume;
    },

    /* --- 状態 --- */
    /** ユーザーが画面に触れたか。false の間は絶対に鳴らない */
    hasGesture: function () { return gestured; },
    /** 今この瞬間、音を出せるか */
    isReady: function () { return !!(gestured && !muted && (ctx || AC)); },
    /** ブラウザが WebAudio に対応しているか */
    isSupported: function () { return !!AC; },

    /** ユーザー操作のハンドラから呼ぶと、以降の初回発音が遅れない(任意) */
    init: function () {
      markGesture();
      ensureCtx();
      resume();
      return !!ctx;
    },
    unlock: function () { return this.init(); },

    stopAll: stopAll
  };

})(window);
