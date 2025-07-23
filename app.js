// --- グローバル変数と定数 ---
const STORAGE_KEY_CHECKLIST = 'fujirockChecklistState';
const STORAGE_KEY_AUTH_PASS = 'fujirockAuthPassword';
const STORAGE_KEY_AUTH_CRED_ID = 'fujirockAuthCredentialId';

// --- DOM要素 ---
let allCheckboxes; // DOMContentLoadedで初期化
let authOverlay, registerSection, loginSection, authMessage;

// =================================================================
// 認証ロジック
// =================================================================
const auth = {
    // パスワードを安全な形（ハッシュ）に変換
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // 初期登録
    async register() {
        const passwordInput = document.getElementById('password-input');
        const password = passwordInput.value;
        if (password.length < 4) {
            authMessage.textContent = 'パスワードは4文字以上で設定してください。';
            return;
        }

        try {
            // 1. WebAuthnが利用可能かチェック
            if (!navigator.credentials || !navigator.credentials.create) {
                throw new Error('このブラウザは生体認証に対応していません。');
            }
            
            // 2. 生体認証情報の作成
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(32), // 本来はサーバーが生成
                    rp: { name: "FujiRock Checklist" },
                    user: { id: new Uint8Array(16), name: "user", displayName: "User" },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform", // デバイス内蔵の認証（指紋,顔）
                        userVerification: "required"
                    },
                    timeout: 60000,
                }
            });
            
            // 3. パスワードのハッシュと認証IDを保存
            const hashedPassword = await this.hashPassword(password);
            localStorage.setItem(STORAGE_KEY_AUTH_PASS, hashedPassword);
            localStorage.setItem(STORAGE_KEY_AUTH_CRED_ID, credential.id);
            
            this.unlock();
        } catch (err) {
            authMessage.textContent = '生体認証の登録に失敗しました。' + err;
            console.error(err);
        }
    },

    // 生体認証でログイン
    async loginWithBio() {
        try {
            const credentialId = localStorage.getItem(STORAGE_KEY_AUTH_CRED_ID);
            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    allowCredentials: [{
                        type: 'public-key',
                        id: base64url.decode(credentialId),
                    }],
                    userVerification: "required"
                }
            });
            
            if (credential) {
                this.unlock();
            }
        } catch (err) {
            authMessage.textContent = '生体認証に失敗しました。パスワードで試してください。';
            console.error(err);
        }
    },
    
    // パスワードでログイン
    async loginWithPassword() {
        const passwordInput = document.getElementById('password-login-input');
        const savedHash = localStorage.getItem(STORAGE_KEY_AUTH_PASS);
        const inputHash = await this.hashPassword(passwordInput.value);

        if (savedHash === inputHash) {
            this.unlock();
        } else {
            authMessage.textContent = 'パスワードが違います。';
            passwordInput.value = '';
        }
    },
    
    // ロック画面を非表示にする
    unlock() {
        authOverlay.style.display = 'none';
    },

    // アプリ起動時の認証チェック
    init() {
        const isRegistered = localStorage.getItem(STORAGE_KEY_AUTH_CRED_ID);
        if (isRegistered) {
            // 登録済み -> ログイン画面表示
            registerSection.style.display = 'none';
            loginSection.style.display = 'block';
        } else {
            // 未登録 -> 登録画面表示
            registerSection.style.display = 'block';
            loginSection.style.display = 'none';
        }
    }
};

// WebAuthnで使うエンコード/デコード用ヘルパー
const base64url = {
    encode: buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'),
    decode: str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
};


// =================================================================
// チェックリストのロジック（前回から変更なし）
// =================================================================
const checklist = {
    saveState() {
        const states = Array.from(allCheckboxes).map(cb => cb.checked);
        localStorage.setItem(STORAGE_KEY_CHECKLIST, JSON.stringify(states));
    },
    loadState() {
        const savedStates = JSON.parse(localStorage.getItem(STORAGE_KEY_CHECKLIST));
        if (savedStates && savedStates.length === allCheckboxes.length) {
            allCheckboxes.forEach((checkbox, index) => {
                checkbox.checked = savedStates[index];
            });
        }
    },
    handleSync(e) {
        const target = e.target;
        if (!target.classList.contains('sync-checkbox')) return;
        const syncId = target.dataset.syncId;
        const isChecked = target.checked;
        const otherCheckboxes = document.querySelectorAll(`.sync-checkbox[data-sync-id="${syncId}"]`);
        otherCheckboxes.forEach(other => {
            if (other !== target) other.checked = isChecked;
        });
    }
};


// =================================================================
// アプリケーションの初期化
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    authOverlay = document.getElementById('auth-overlay');
    registerSection = document.getElementById('register-section');
    loginSection = document.getElementById('login-section');
    authMessage = document.getElementById('auth-message');

    // --- チェックリストのイベントリスナー設定 ---
    allCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            checklist.handleSync(e);
            checklist.saveState();
        });
    });
    
    // --- 認証のイベントリスナー設定 ---
    document.getElementById('register-button').addEventListener('click', () => auth.register());
    document.getElementById('login-bio-button').addEventListener('click', () => auth.loginWithBio());
    document.getElementById('login-pass-button').addEventListener('click', () => auth.loginWithPassword());

    // --- 初期化処理 ---
    checklist.loadState(); // チェックリストの状態を復元
    auth.init(); // 認証処理を開始
});


// =================================================================
// Service Workerの登録（変更なし）
// =================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => { console.log('Service Worker 登録成功'); })
            .catch(error => { console.log('Service Worker 登録失敗:', error); });
    });
}
