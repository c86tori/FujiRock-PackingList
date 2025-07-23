document.addEventListener('DOMContentLoaded', () => {
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    const STORAGE_KEY = 'fujirockChecklistState';

    // 現在のチェック状態をすべて保存する関数
    const saveState = () => {
        const states = Array.from(allCheckboxes).map(cb => cb.checked);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    };

    // 保存された状態を読み込んで復元する関数
    const loadState = () => {
        const savedStates = JSON.parse(localStorage.getItem(STORAGE_KEY));
        // 保存されたデータがあり、チェックボックスの数と一致する場合のみ復元
        if (savedStates && savedStates.length === allCheckboxes.length) {
            allCheckboxes.forEach((checkbox, index) => {
                checkbox.checked = savedStates[index];
            });
        }
    };

    // 🔗マークのついたチェックボックスを同期させる処理
    const handleSync = (e) => {
        const target = e.target;
        // 'sync-checkbox'クラスを持たない要素なら何もしない
        if (!target.classList.contains('sync-checkbox')) return;

        const syncId = target.dataset.syncId;
        const isChecked = target.checked;
        
        const otherCheckboxes = document.querySelectorAll(`.sync-checkbox[data-sync-id="${syncId}"]`);
        otherCheckboxes.forEach(other => {
            if (other !== target) {
                other.checked = isChecked;
            }
        });
    };

    // すべてのチェックボックスにイベントリスナーを設定
    allCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            // まず、連動するチェックボックスの状態を更新
            handleSync(e);
            // その後、すべてのチェックボックスの最新の状態を保存
            saveState();
        });
    });

    // ページが読み込まれた時に、保存された状態を復元する
    loadState();
});


// Service Workerの登録（この部分は変更ありません）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker 登録成功:', registration);
            })
            .catch(error => {
                console.log('Service Worker 登録失敗:', error);
            });
    });
}