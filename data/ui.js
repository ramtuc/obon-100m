/* data/ui.js — 「会社まであと100m」UI文言
 * Writer-1 専用 / file:// で動かすため import / export / fetch は使わない。代入1本だけ。
 *
 * 対応する器: css-classes.md §10(タイトル/ED) §11(システムUI) §19-20(リザルト/実績一覧)
 *             spec.md §4.3(操作) §7(スキップ・設定) / achievements-def.md §4(トースト)
 *
 * トーン: 本編と同じ乾いた憂鬱。ただし UI なので機能は崩さない。
 * リザルトは **褒めない・責めない**。見立ては勤怠記録。祝いも慰めも入れない。
 *
 * 幅の目安(g-app は最大480px): スタッツ項目名 7字 / ボタン 6字 / チェック文言 10字 /
 * 結末名 7字 / 極小ラベル 2字 を上限として書いてある。
 */
window.GAME_UI = {

  /* ====================================================================
   * (1) タイトル画面  — css-classes.md §10 g-title
   * ================================================================== */
  title: {
    main: '会社まであと100m',      // g-title__main(確定)
    sub: 'お盆明け、月曜。',        // g-title__sub
    start: 'はじめる',              // 初回・2回目以降とも共通
    watchOp: 'OPを見る',            // skipOP===true のときだけ併置(spec.md §7.3)
    help: '遊び方',
    settings: '設定'
  },

  help: {
    heading: '遊び方',
    intro: '月曜の朝。会社まで、あと100m。\n時間とメンタルを失いすぎず、入口まで進んでください。',
    distance: '距離　「進む」で1mずつ会社へ近づく。',
    time: '時刻　行動や出来事で時間が進む。9:00を過ぎれば遅刻。',
    mental: 'メンタル　選択によって減少する。低くなるほど画面と結末が変わる。',
    choices: '選択　正解があるとは限らない。中には、絶対に選んではいけない選択肢もある。',
    warning: '※鬱・心理ホラー・事故や死を示唆する表現を含みます。',
    begin: '理解して、はじめる',
    back: '戻る'
  },

  /* ====================================================================
   * (2) リザルト画面  — css-classes.md §19 / §20-1,20-2
   * ================================================================== */
  result: {
    label: '記録',                  // g-result__label(上段の極小ラベル)
    secToday: '今日',               // g-result__sec
    secAch: '実績',                 // g-result__sec

    /* スタッツ5行。spec.md §5 の並び順で出す。
     * key は css-classes.md §20-2 の対応表どおり state / stats の実フィールド名に合わせてある */
    stats: [
      { key: 'clockSec',     name: '到着時刻',       unit: '' },   // 到着時の時計(HH:MM)
      { key: 'late',         name: '遅刻',           unit: '' },   // clockSec >= 32400 → yes / no
      { key: 'mental',       name: '到着時メンタル', unit: '' },   // Math.ceil(state.mental)
      { key: 'stopCount',    name: '立ち止まり',     unit: '回' }, // stats.stopCount
      { key: 'backAttempts', name: '引き返し',       unit: '回' }  // stats.backAttempts
    ],

    /* 数字でない値。g-stats__val--text を付けて出す */
    yes: 'あり',
    no: 'なし',
    /* 会社まで届かなかったときの到着時刻の代わり */
    notArrived: '——',

    /* g-result__ending / g-ending__name。結末の名前(事務的な事由欄として書いてある) */
    endingName: {
      'ending-perfect':       '無傷で到着',
      'ending-ontime':        '定刻に到着',
      'ending-hollow':        '空っぽで到着',
      'ending-late':          '遅れて到着',
      'ending-standstill':    '会社の前で停止',
      'ending-turnback-auto': '反射で離脱',
      'ending-turnback':      '自主的に離脱',
      'ending-compliant':     '完全適応',
      'ending-accident-road': '通勤中の事故',
      'ending-accident-glass':'入口での事故'
    },

    /* g-ending__label / g-ending__note。ED画面の締め。備考欄の見立て */
    endingLabel: '結末',
    endingNote: {
      'ending-perfect':       '異常なし。',
      'ending-ontime':        '通常どおり。',
      'ending-hollow':        '出社。中身は未着。',
      'ending-late':          '始業後に到着。',
      'ending-standstill':    '会社の前にて停止。未到着。',
      'ending-turnback-auto': '離脱。本人に自覚なし。',
      'ending-turnback':      '離脱。本人の申し出による。',
      'ending-compliant':     '出社。本人の所在は未確認。',
      'ending-accident-road': '到着せず。連絡なし。',
      'ending-accident-glass':'欠勤として処理済み。'
    }
  },

  /* ====================================================================
   * (3) 実績一覧  — css-classes.md §20-3, 20-4 / achievements-def.md §4
   * ================================================================== */
  achievements: {
    heading: '実績',                // g-result__sec(result.secAch と同一文言)
    countSep: '/',                  // g-count__sep
    countNote: '解除',              // g-count__note(取得数 n / 総数 16 の右)
    newBadge: '今回',               // g-ach__new(このプレイで解除)
    toastLabel: '実績解除',         // g-toast__label

    /* 未取得の伏せ字。g-ach__redact(罫線のバー)を使う場合はこの文字列は不要。
     * テキストで伏せるときだけ name の代わりに置く */
    redactedName: '???',
    /* g-ach--locked の一言は CSS 側で自動的に隠れるので、文言は不要 */
    lockedDesc: ''
  },

  /* ====================================================================
   * (4) 設定  — spec.md §7.4 / css-classes.md §11
   * ================================================================== */
  settings: {
    heading: '設定',
    skipOp: 'OPをスキップする',
    sound: '音を鳴らす',
    bgmVolume: 'BGM音量',
    on: 'する',
    off: 'しない',

    clear: '記録を消す',
    /* alert / confirm は禁止。画面内の選択肢で1段だけ確認する(spec.md §4.3, §7.4) */
    clearPrompt: '実績も、見た結末も、全部消える。',
    clearYes: '消す',
    clearNo: 'やめる',
    clearDone: '消えた。',

    back: '戻る',
    again: 'もう一度'               // g-result__foot の主ボタン
  },

  /* ====================================================================
   * (5) システム文言  — spec.md §4.3, §7.2 / css-classes.md §11
   * ================================================================== */
  system: {
    skip: 'スキップ ≫',             // g-skip(OP中・右下に常時)
    skipCheck: '次回から常にスキップ', // g-check(OP中およびリザルト下段)
    soundOn: '音を鳴らす',           // g-sound の読み上げ用(消音→鳴らす)
    soundOff: '音を消す',            // 同上(鳴っている→消す)
    tapHint: 'タップで送る',         // 初回の1シーン目だけ出す想定。不要なら使わなくてよい

    /* 本編の操作ボタン(spec.md §4.3 / fixed-events.md §4.3) */
    walkForward: '進む',
    walkForwardLast: '入る',        // remaining === 1 のときだけラベルを差し替える
    walkStop: '立ち止まる',
    walkBack: '引き返す',

    /* [立ち止まる] はイベントを発火させず、専用テキストを1行出す(spec.md §4.3)。
     * 押すたびに順に、または無作為に1本選ぶ */
    stopLines: [
      '立ち止まった。',
      '足を止める。汗が追いついてくる。',
      'その場で息を整える。誰も気にしない。',
      '止まっているあいだも、始業は近づく。',
      '壁際に寄って、少し待つ。',
      'もう一度、同じ場所で止まった。'
    ],

    /* [引き返す] 1回目の確認。モーダルではなく画面内に出す(spec.md §4.3) */
    backPrompt: 'もう一度押すと、引き返す。',
    backCancel: 'やめる'
  }

};
