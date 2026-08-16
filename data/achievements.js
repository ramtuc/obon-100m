/* data/achievements.js — 「会社まであと100m」実績
 * Writer-1 専用 / achievements-def.md §5 の雛形に文面を入れたもの
 * file:// で動かすため import / export / fetch は使わない。代入1本だけ。
 *
 * 全16本 / hidden 4本(ach-perfect / ach-almost / ach-skipper / ach-allending)
 * name は16字以内、desc は28字以内。id / trigger / hidden は Designer-1 の定義表のまま。
 */
window.GAME_ACHIEVEMENTS = [

  { id: 'ach-left-home', name: '家を出た', desc: '本日最大の難関を突破した。' },

  { id: 'ach-arrive', name: '会社に着いた', desc: 'あと100mを、歩ききった。',
    trigger: { kind: 'stat', key: 'remaining', op: '<=', value: 0 } },

  { id: 'ach-nonstop', name: '無停止', desc: '一度も立ち止まらずに着いた。',
    trigger: { kind: 'all', of: [ { kind: 'stat', key: 'remaining', op: '<=', value: 0 },
                                  { kind: 'stat', key: 'stopCount', op: '==', value: 0 } ] } },

  { id: 'ach-statue', name: '立ち止まりの達人', desc: '5回立ち止まった。動かない時間のほうが長い。',
    trigger: { kind: 'stat', key: 'stopCount', op: '>=', value: 5 } },

  { id: 'ach-fullheal', name: '満タン', desc: 'メンタルは戻った。時計も進んだ。',
    trigger: { kind: 'stat', key: 'mental', op: '>=', value: 100 } },

  { id: 'ach-hesitate', name: '一度は迷った', desc: '引き返そうとして、結局着いた。',
    trigger: { kind: 'all', of: [ { kind: 'stat', key: 'backAttempts', op: '>=', value: 1 },
                                  { kind: 'stat', key: 'remaining',    op: '<=', value: 0 } ] } },

  { id: 'ach-hollow', name: '空っぽで着席', desc: '体は席にある。中身は道に置いてきた。',
    trigger: { kind: 'ending', id: 'ending-hollow' } },

  { id: 'ach-late', name: '遅刻', desc: '9時を過ぎて自動ドアをくぐった。',
    trigger: { kind: 'ending', id: 'ending-late' } },

  { id: 'ach-verylate', name: 'もう挨拶では済まない', desc: '9時5分。言い訳の段階を過ぎている。',
    trigger: { kind: 'all', of: [ { kind: 'stat', key: 'remaining', op: '<=', value: 0 },
                                  { kind: 'stat', key: 'clockSec',  op: '>=', value: 32700 } ] } },

  { id: 'ach-standstill', name: '立ち尽くす', desc: '会社の前で、動けなくなった。',
    trigger: { kind: 'ending', id: 'ending-standstill' } },

  { id: 'ach-turnback', name: '引き返した', desc: '自分の意思で、来た道を戻った。',
    trigger: { kind: 'ending', id: 'ending-turnback' } },

  { id: 'ach-reflex', name: '反射', desc: '意思より先に、足が逆を向いた。',
    trigger: { kind: 'ending', id: 'ending-turnback-auto' } },

  { id: 'ach-perfect', name: '無傷', desc: '何も感じずに着いた。それが異常。', hidden: true,
    trigger: { kind: 'ending', id: 'ending-perfect' } },

  { id: 'ach-almost', name: 'あと1m', desc: '残り1mのところで、動けなくなった。', hidden: true,
    trigger: { kind: 'all', of: [ { kind: 'ending', id: 'ending-standstill' },
                                  { kind: 'stat', key: 'remaining', op: '<=', value: 1 } ] } },

  { id: 'ach-skipper', name: '見なかったことに', desc: '前夜も深夜も朝も、飛ばした。', hidden: true,
    trigger: { kind: 'stat', key: 'skippedOP', op: '==', value: 1 } },

  { id: 'ach-forbidden', name: '選んではいけない', desc: '戻れない選択肢を選んだ。', hidden: true,
    trigger: { kind: 'any', of: [ { kind: 'ending', id: 'ending-accident-road' },
                                  { kind: 'ending', id: 'ending-accident-glass' } ] } },

  { id: 'ach-compliant', name: '適性あり', desc: '従順度85以上で会社に到着した。', hidden: true,
    trigger: { kind: 'ending', id: 'ending-compliant' } },

  { id: 'ach-allending', name: '全部見た', desc: '10の結末を、ひととおり通過した。', hidden: true,
    trigger: { kind: 'stat', key: 'endingsCount', op: '>=', value: 10 } }

];
