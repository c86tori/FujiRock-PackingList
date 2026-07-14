// =================================================================
// フジロック持ち物リスト（tori 専用）
//   最先端UI：グラス質感 / 円形プログレス / スプリングなチェック /
//   クリック&ドラッグ並べ替え（マウス・タッチ両対応）/ 100%でお祝い
//
//   データ構造:
//   data = { title, categories:[ { name, open,
//            items:[ {type:'heading',text} | {type:'check',text,checked} ] } ] }
// =================================================================

const STORAGE_KEY = 'packingListData_v3';

const heading = text => ({ type: 'heading', text });
const check   = text => ({ type: 'check', text, checked: false });

// --- 初期データ（tori のフジロックリスト） ---
const defaultData = () => ({
    title: 'フジロック持ち物リスト',
    categories: [
        { name: '会場持ち歩きリュック', open: false, items: [
            heading('［背面ポケット］'),
            check('日焼け止め'), check('フェイスシート'), check('ビールメリケンサック'), check('虫除けスプレー'),
            heading('［サイドポケット］'),
            check('水筒'),
            heading('［中身］'),
            check('タオル'), check('ポンチョ(青)'), check('フリース'),
            heading('＜黄色いポーチ＞'),
            check('モバイルバッテリー'), check('USBコード類'), check('ヘッドライト'), check('単4の乾電池'),
            heading('＜赤いポーチ＞'),
            check('テーピング'), check('絆創膏'), check('爪切り'), check('コンタクトレンズ'),
            check('ロキソニン'), check('ロキソニンテープ'), check('ポケットティッシュ'),
        ]},
        { name: '宿泊リュック', open: false, items: [
            heading('［背ポケット］'),
            check('財布→カード類は別にまとめる'),
            heading('［中身］'),
            check('コンビニ袋'), check('開催中に着るTシャツ3枚'), check('パンツ1枚'), check('靴下1枚'),
            check('タオル'), check('3日目のハンカチ'), check('ヘアスプレー'), check('化粧水'),
            check('クリーム'), check('髭剃り'),
        ]},
        { name: '車内ぶち込み', open: false, items: [
            check('エアマット'), check('ミニクーラーボックス'), check('折りたたみ傘'),
            heading('［ダッシュボード］'),
            check('駐車券'), check('リストバンド'), check('タイムテーブル'),
            heading('［車中泊ダンボール］'),
            check('ボディシート'), check('寝るT'), check('パンツ2枚'), check('靴下1枚'),
            check('帰りのくそ服'), check('コンビニ袋'), check('2日目のタオル'), check('3日目のタオル'),
            check('どおでもいいくそタオル'), check('2日目のハンカチ（洗って使え）'), check('キャップ'),
            heading('［そのたダンボール］'),
            check('長靴'), check('サンダル'), check('窓ガラス隠すやつ'),
            heading('［黄色いザック］'),
            check('折りたたみチェア大'),
        ]},
        { name: '当日用意するもの', open: false, items: [
            heading('＜カードサイフ（UnderTheSun）＞'),
            check('健康保険証'), check('運転免許証'), check('金'),
            heading('＜その他＞'),
            check('ハンカチ'), check('家の鍵'), check('車のキー'),
            check('Applewatch'), check('Applewatchバッテリー'), check('拡張コンセント'),
            check('化粧水'), check('クリーム'), check('髭剃り'), check('無線イヤホン(どっちでも)'),
        ]},
        { name: '当日身につけるもの', open: false, items: [
            check('サングラス'), check('ハット'), check('アンダーシャツ'), check('コンプレッションウェア上'),
            check('コンプレッションウェア下'), check('Tシャツ'), check('速乾パンツ'), check('パンツ'),
            check('ハンカチ'), check('スマホ'),
        ]},
    ]
});

let data;
let editMode = false;
let firstRender = true;
let prevComplete = false;
let focusAfterRender = null;

// =================================================================
// 保存 / 読み込み
// =================================================================
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        data = raw ? JSON.parse(raw) : defaultData();
    } catch (e) { data = defaultData(); }
    if (!data || !Array.isArray(data.categories)) data = defaultData();
}

// =================================================================
// DOMヘルパー
// =================================================================
function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (v === true) node.setAttribute(k, '');
        else if (v !== false && v != null) node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null || c === false) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
}

const GRIP_SVG = '<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">' +
    '<circle cx="7" cy="5" r="1.6"/><circle cx="13" cy="5" r="1.6"/>' +
    '<circle cx="7" cy="10" r="1.6"/><circle cx="13" cy="10" r="1.6"/>' +
    '<circle cx="7" cy="15" r="1.6"/><circle cx="13" cy="15" r="1.6"/></svg>';

const grip = cls => el('span', { class: cls, html: GRIP_SVG, 'aria-label': 'ドラッグして並べ替え' });

function iconBtn(symbol, label, onClick) {
    const b = el('button', { class: 'mini-btn', type: 'button', 'aria-label': label, title: label, text: symbol });
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onClick(); });
    return b;
}
function pillBtn(text, onClick, cls = 'pill-btn') {
    const b = el('button', { class: cls, type: 'button', text });
    b.addEventListener('click', e => { e.preventDefault(); onClick(); });
    return b;
}

// 見出しの段（0=見出し / 1=小見出し）。level指定があれば優先、無ければ記号で推定（＜＞=小見出し）
function headingLevel(it) {
    if (typeof it.level === 'number') return it.level === 1 ? 1 : 0;
    return /^[＜<]/.test((it.text || '').trim()) ? 1 : 0;
}
function computeIndents(items) {
    const levels = [];
    let itemIndent = 0;
    for (const it of items) {
        if (it.type === 'heading') {
            const h = headingLevel(it);
            levels.push(h);
            itemIndent = h + 1;
        } else levels.push(itemIndent);
    }
    return levels;
}

function countCat(cat) {
    let checked = 0, total = 0;
    cat.items.forEach(i => { if (i.type === 'check') { total++; if (i.checked) checked++; } });
    return { checked, total };
}
function countAll() {
    let checked = 0, total = 0;
    data.categories.forEach(c => { const x = countCat(c); checked += x.checked; total += x.total; });
    return { checked, total };
}

// =================================================================
// 描画
// =================================================================
function render() {
    renderHeader();
    const app = document.getElementById('app');
    app.innerHTML = '';

    const cats = el('div', { id: 'categories' });
    data.categories.forEach((cat, ci) => cats.appendChild(renderCategory(cat, ci)));
    app.appendChild(cats);
    if (editMode) app.appendChild(renderFooter());

    // 並べ替え（カテゴリ）
    makeSortable(cats, {
        rowSelector: ':scope > .category',
        handleSelector: '.cat-grip',
        onCommit: order => { data.categories = order.map(i => data.categories[i]); save(); render(); },
    });
    // 並べ替え（各カテゴリ内の項目）
    [...cats.children].forEach((card, ci) => {
        const list = card.querySelector('.items');
        if (!list) return;
        makeSortable(list, {
            rowSelector: ':scope > .row',
            handleSelector: '.grip',
            onCommit: order => { data.categories[ci].items = order.map(i => data.categories[ci].items[i]); save(); render(); },
        });
    });

    if (firstRender) {
        [...cats.children].forEach((card, i) => { card.style.setProperty('--i', i); card.classList.add('enter'); });
        firstRender = false;
    }
    updateOverall(false);
    applyFocus();
}

function renderHeader() {
    const titleEl = document.getElementById('app-title');
    const toggle = document.getElementById('edit-toggle');
    const hint = document.getElementById('hint');
    const help = document.getElementById('edit-help');
    document.title = data.title || '持ち物チェックリスト';

    // 円形プログレスリング
    const ring = document.getElementById('ring-slot');
    if (!ring.dataset.built) {
        ring.innerHTML =
            '<svg viewBox="0 0 72 72" class="ring">' +
            '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FBE9DA"/>' +
            '</linearGradient></defs>' +
            '<circle class="ring-track" cx="36" cy="36" r="30"/>' +
            '<circle class="ring-fill" cx="36" cy="36" r="30"/>' +
            '</svg><span class="ring-pct" id="ring-pct">0%</span>';
        ring.dataset.built = '1';
    }

    titleEl.innerHTML = '';
    if (editMode) {
        const input = el('input', { class: 'title-input', type: 'text', value: data.title || '', placeholder: 'リスト名' });
        input.addEventListener('input', () => { data.title = input.value; save(); });
        titleEl.appendChild(input);
        toggle.textContent = '✓';
        toggle.classList.add('active');
        hint.hidden = true; help.hidden = false;
    } else {
        titleEl.textContent = data.title || '持ち物チェックリスト';
        toggle.textContent = '✎';
        toggle.classList.remove('active');
        hint.hidden = false; help.hidden = true;
    }
}

function renderCategory(cat, ci) {
    const { checked, total } = countCat(cat);
    const card = el('div', { class: 'category' + (cat.open ? ' open' : ''), 'data-idx': ci });

    const header = el('div', { class: 'cat-header' });
    header.appendChild(grip('cat-grip'));

    const titleWrap = el('div', { class: 'cat-title-wrap' });
    if (editMode) {
        const nameInput = el('input', { class: 'cat-name-input', type: 'text', value: cat.name || '', placeholder: 'カテゴリ名' });
        nameInput.addEventListener('input', () => { cat.name = nameInput.value; save(); });
        nameInput.addEventListener('pointerdown', e => e.stopPropagation());
        titleWrap.appendChild(nameInput);
    } else {
        titleWrap.appendChild(el('span', { class: 'cat-name', text: cat.name || '(名称未設定)' }));
    }
    header.appendChild(titleWrap);

    const meta = el('div', { class: 'cat-meta' }, [
        el('span', { class: 'cat-count', text: total ? `${checked}/${total}` : '' }),
        el('span', { class: 'chevron', html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' }),
    ]);
    if (editMode) meta.appendChild(iconBtn('🗑', 'カテゴリを削除', () => deleteCategory(ci)));
    header.appendChild(meta);

    // ヘッダーの薄い進捗ライン
    const catBar = el('div', { class: 'cat-progress' }, [
        el('div', { class: 'cat-progress-fill', style: `width:${total ? (checked / total * 100) : 0}%` })
    ]);

    header.addEventListener('click', e => {
        if (e.target.closest('.cat-grip') || e.target.closest('.mini-btn') || e.target.closest('input')) return;
        cat.open = !cat.open; save(); card.classList.toggle('open', cat.open);
    });

    // 本体（開閉アニメ用に grid で包む）
    const body = el('div', { class: 'cat-body' });
    const inner = el('div', { class: 'cat-body-inner' });
    const list = el('div', { class: 'items' });
    const levels = computeIndents(cat.items);
    cat.items.forEach((item, ii) => list.appendChild(renderRow(cat, ci, item, ii, levels[ii])));
    if (cat.items.length === 0 && !editMode) {
        list.appendChild(el('p', { class: 'empty-note', text: '（項目がありません。✎ から追加できます）' }));
    }
    inner.appendChild(list);
    if (editMode) {
        inner.appendChild(el('div', { class: 'add-row' }, [
            pillBtn('＋ 見出し', () => addItem(ci, 'heading')),
            pillBtn('＋ 小見出し', () => addItem(ci, 'subheading')),
            pillBtn('＋ 項目', () => addItem(ci, 'check')),
        ]));
    }
    body.appendChild(inner);

    card.appendChild(header);
    card.appendChild(catBar);
    card.appendChild(body);
    return card;
}

function renderRow(cat, ci, item, ii, level) {
    const isHeading = item.type === 'heading';
    const row = el('div', {
        class: 'row ' + (isHeading ? 'row-heading' : 'row-check') + (item.checked ? ' done' : ''),
        'data-idx': ii, 'data-indent': level,
    });
    row.appendChild(grip('grip'));

    if (editMode) {
        const isSub = isHeading && level === 1;
        const input = el('input', {
            class: 'row-input' + (isHeading ? (isSub ? ' subheading-input' : ' heading-input') : ''),
            type: 'text', value: item.text || '',
            placeholder: isHeading ? (isSub ? '小見出し' : '見出し') : '項目名',
            'data-cat': ci, 'data-item': ii,
        });
        input.addEventListener('input', () => { item.text = input.value; save(); });
        input.addEventListener('pointerdown', e => e.stopPropagation());
        row.appendChild(input);
        if (isHeading) {
            row.appendChild(iconBtn(isSub ? '大' : '小', isSub ? '見出し（大）にする' : '小見出しにする',
                () => setHeadingLevel(ci, ii, isSub ? 0 : 1)));
        }
        row.appendChild(iconBtn('🗑', '削除', () => deleteItem(ci, ii)));
        return row;
    }

    if (isHeading) {
        row.appendChild(el('span', { class: 'heading-text', text: item.text }));
        return row;
    }

    const box = el('span', { class: 'checkbox' + (item.checked ? ' checked' : '') });
    const main = el('div', { class: 'row-main' }, [box, el('span', { class: 'row-text', text: item.text })]);
    main.addEventListener('click', () => toggleCheck(ci, ii, row, box));
    row.appendChild(main);
    return row;
}

function renderFooter() {
    return el('div', { class: 'footer-controls' }, [
        pillBtn('＋ カテゴリを追加', addCategory, 'add-category-btn'),
        pillBtn('↩︎ 初期状態に戻す', resetAll, 'reset-btn'),
    ]);
}

// =================================================================
// チェック / 進捗 / お祝い
// =================================================================
function toggleCheck(ci, ii, row, box) {
    const item = data.categories[ci].items[ii];
    item.checked = !item.checked;
    save();
    box.classList.toggle('checked', item.checked);
    row.classList.toggle('done', item.checked);
    // スプリング再生
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    updateCategoryProgress(ci, row.closest('.category'));
    updateOverall(true);
}

function updateCategoryProgress(ci, card) {
    if (!card) return;
    const { checked, total } = countCat(data.categories[ci]);
    const fill = card.querySelector('.cat-progress-fill');
    const count = card.querySelector('.cat-count');
    if (fill) fill.style.width = (total ? checked / total * 100 : 0) + '%';
    if (count) count.textContent = total ? `${checked}/${total}` : '';
}

function updateOverall(animate) {
    const { checked, total } = countAll();
    const pct = total ? Math.round(checked / total * 100) : 0;
    const label = document.getElementById('progress-label');
    if (label) label.textContent = `${checked} / ${total} 完了`;

    const fill = document.querySelector('.ring-fill');
    const pctEl = document.getElementById('ring-pct');
    if (fill) {
        const C = 2 * Math.PI * 30;
        fill.style.strokeDasharray = C;
        fill.style.strokeDashoffset = C * (1 - pct / 100);
    }
    if (pctEl) pctEl.textContent = pct + '%';

    const complete = total > 0 && checked === total;
    document.body.classList.toggle('all-done', complete);
    if (animate && complete && !prevComplete) celebrate();
    prevComplete = complete;
}

function celebrate() {
    const c = document.getElementById('confetti');
    if (!c) return;
    const colors = ['#E64219', '#011A38', '#2E5AA8', '#E8B23A', '#4C9A8E', '#F2EFEB'];
    for (let i = 0; i < 90; i++) {
        const p = el('span', { class: 'confetti-piece' });
        p.style.left = Math.random() * 100 + 'vw';
        p.style.background = colors[i % colors.length];
        p.style.animationDelay = (Math.random() * 0.35) + 's';
        p.style.animationDuration = (2 + Math.random() * 1.4) + 's';
        p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        p.style.setProperty('--drift', (Math.random() * 160 - 80) + 'px');
        c.appendChild(p);
        setTimeout(() => p.remove(), 3600);
    }
}

// =================================================================
// 編集操作
// =================================================================
function deleteCategory(ci) {
    const name = data.categories[ci].name || 'このカテゴリ';
    if (!confirm(`「${name}」を削除しますか？`)) return;
    data.categories.splice(ci, 1); save(); render();
}
function addCategory() {
    data.categories.push({ name: '新しいカテゴリ', open: true, items: [] });
    focusAfterRender = { cat: data.categories.length - 1, item: 'name' };
    save(); render();
}
function addItem(ci, type) {
    let item;
    if (type === 'heading') item = { type: 'heading', level: 0, text: '' };
    else if (type === 'subheading') item = { type: 'heading', level: 1, text: '' };
    else item = check('');
    data.categories[ci].items.push(item);
    data.categories[ci].open = true;
    focusAfterRender = { cat: ci, item: data.categories[ci].items.length - 1 };
    save(); render();
}
function setHeadingLevel(ci, ii, lv) {
    data.categories[ci].items[ii].level = lv;
    save(); render();
}
function deleteItem(ci, ii) { data.categories[ci].items.splice(ii, 1); save(); render(); }
function resetAll() {
    if (!confirm('すべてを初期状態に戻します。今の内容は消えます。よろしいですか？')) return;
    data = defaultData(); prevComplete = false; save(); render();
}
function applyFocus() {
    if (!focusAfterRender) return;
    const { cat, item } = focusAfterRender;
    focusAfterRender = null;
    const target = item === 'name'
        ? document.querySelectorAll('.cat-name-input')[cat]
        : document.querySelector(`.row-input[data-cat="${cat}"][data-item="${item}"]`);
    if (target) { target.focus(); }
}

// =================================================================
// 並べ替え（Pointer Events：マウス・タッチ・ペン共通）
//   ゴースト（浮遊するコピー）を指に追従させ、実体はプレースホルダとして
//   その場に残し、FLIP で周囲を滑らかにずらす。
// =================================================================
function makeSortable(container, opts) {
    container.addEventListener('pointerdown', e => {
        if (e.button != null && e.button !== 0) return;
        const handle = e.target.closest(opts.handleSelector);
        if (!handle || !container.contains(handle)) return;
        const row = handle.closest(opts.rowSelector.replace(':scope > ', ''));
        if (!row || row.parentElement !== container) return;
        e.preventDefault();
        startDrag(container, row, handle, e, opts);
    });
}

function rowsOf(container, rowSelector) {
    return [...container.children].filter(ch =>
        ch.matches(rowSelector.replace(':scope > ', '')));
}

function startDrag(container, row, handle, e, opts) {
    const rect = row.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const offsetX = e.clientX - rect.left;

    const ghost = row.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);

    row.classList.add('drag-source');
    document.body.classList.add('is-sorting');
    try { handle.setPointerCapture(e.pointerId); } catch (_) {}

    const rowSel = opts.rowSelector.replace(':scope > ', '');

    const moveGhost = (x, y) => {
        ghost.style.top = (y - offsetY) + 'px';
        ghost.style.left = (x - offsetX) + 'px';
    };
    moveGhost(e.clientX, e.clientY);

    const onMove = ev => {
        moveGhost(ev.clientX, ev.clientY);

        // 端に近づいたら自動スクロール
        const m = 72;
        if (ev.clientY < m) window.scrollBy(0, -14);
        else if (ev.clientY > window.innerHeight - m) window.scrollBy(0, 14);

        const siblings = rowsOf(container, rowSel).filter(r => r !== row);
        let after = null;
        for (const s of siblings) {
            const r = s.getBoundingClientRect();
            if (ev.clientY < r.top + r.height / 2) { after = s; break; }
        }

        // FLIP：移動前の位置を記録 → DOM移動 → 差分から滑らかに戻す
        const others = rowsOf(container, rowSel);
        const firstTop = new Map(others.map(o => [o, o.getBoundingClientRect().top]));
        if (after == null) container.appendChild(row);
        else container.insertBefore(row, after);
        others.forEach(o => {
            if (o === row) return;
            const dy = firstTop.get(o) - o.getBoundingClientRect().top;
            if (!dy) return;
            o.style.transition = 'none';
            o.style.transform = `translateY(${dy}px)`;
            requestAnimationFrame(() => {
                o.style.transition = 'transform .2s cubic-bezier(.2,.9,.3,1)';
                o.style.transform = '';
            });
        });
    };

    const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        ghost.remove();
        row.classList.remove('drag-source');
        document.body.classList.remove('is-sorting');
        const order = rowsOf(container, rowSel).map(r => +r.dataset.idx);
        // 変化が無ければ再描画しない（余計なチラつき防止）
        const changed = order.some((v, i) => v !== i);
        if (changed) opts.onCommit(order);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}

// =================================================================
// 初期化
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    load();
    document.getElementById('edit-toggle').addEventListener('click', () => {
        editMode = !editMode; render();
    });
    render();
    // 初期状態が既に100%のケースにも備える
    prevComplete = (() => { const { checked, total } = countAll(); return total > 0 && checked === total; })();
});

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
}
