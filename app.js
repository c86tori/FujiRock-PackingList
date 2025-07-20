// 1. チェックボックスの連動機能
document.addEventListener('DOMContentLoaded', () => {
    const syncCheckboxes = document.querySelectorAll('.sync-checkbox');

    syncCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const syncId = e.target.dataset.syncId;
            const isChecked = e.target.checked;
            
            const otherCheckboxes = document.querySelectorAll(`.sync-checkbox[data-sync-id="${syncId}"]`);
            otherCheckboxes.forEach(other => {
                if (other !== e.target) {
                    other.checked = isChecked;
                }
            });
        });
    });
});


// 2. Service Workerの登録
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