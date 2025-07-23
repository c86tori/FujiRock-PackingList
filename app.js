// --- グローバル変数と定数 ---
const STORAGE_KEY_CHECKLIST = 'fujirockChecklistState';
const STORAGE_KEY_AUTH_PASS = 'fujirockAuthPassword';
const STORAGE_KEY_AUTH_CRED_ID = 'fujirockAuthCredentialId';
let bioAuthPassed = false; // 生体認証が完了したかを管理するフラグ

// --- DOM要素 ---
let allCheckboxes;
let authOverlay, registerSection, loginSection, authMessage, loginBioButton, passwordLoginInput;

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

    // 初回登録（変更なし）
    async register() {
        const passwordInput = document.getElementById('password-input');
        const password = passwordInput.value;
        if (password.length < 4) {
            authMessage.textContent = 'パスワードは4文字以上で設定してください。';
            return;
        }

        try {
            if (!navigator.credentials || !navigator.credentials.create) {
                throw new Error('このブラウザは生体認証に対応していません。');
            }
            
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rp: { name: "FujiRock Checklist" },
                    user: { id: new Uint8Array(16), name: "user", displayName: "User" },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required"
                    },
                    timeout: 60000,
                }
            });
            
            const hashedPassword = await this.hashPassword(password);
            localStorage.setItem(STORAGE_KEY_AUTH_PASS, hashedPassword);
            localStorage.setItem(STORAGE_KEY_AUTH_CRED_ID, credential.id);
            
            this.unlock();
        } catch (err) {
            authMessage.textContent = '生体認証の登録に失敗しました。' + err;
            console.error(err);
        }
    },

    // ログイン処理 STEP 1: 生体認証
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
                // 生体認証が成功したら、フラグを立てて次のステップを促す
                bioAuthPassed = true;
                authMessage.textContent = '生体認証が完了しました。次にパスワードを入力してください。';
                loginBioButton.disabled = true; // 生体認証ボタンを無効化
                passwordLoginInput.focus(); // パスワード入力欄にフォーカス
            }
        } catch (err) {
            authMessage.textContent = '生体認証に失敗しました。';
            console.error(err);
        }
    },
    
    // ログイン処理 STEP 2: パスワード認証
    async loginWithPassword() {
        // STEP 1（生体認証）が完了していない場合は処理を中断
        if (!bioAuthPassed) {
            authMessage.textContent = '先に生体認証を行ってください。';
            return;
        }

        const passwordInput = document.getElementById('password-login-input');
        const savedHash = localStorage.getItem(STORAGE_KEY_AUTH_PASS);
        const inputHash = await this.hashPassword(passwordInput.value);

        // パスワードが正しければロック解除
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
            bioAuthPassed = false; // 状態をリセット
            loginBioButton.disabled = false; // ボタンを有効化
            authMessage.textContent = '最初に生体認証を行ってください。';
        } else {
            // 未登録 -> 登録画面表示
            registerSection.style.display = 'block';
            loginSection.style.display = 'none';
        }
    }
};

// WebAuthnで使うエンコード/デコード用ヘルパー（変更なし）
const base64url = {
    encode: buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'),
    decode: str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
};

// =================================================================
// チェックリストのロジック（変更なし）
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
    loginBioButton = document.getElementById('login-bio-button');
    passwordLoginInput = document.getElementById('password-login-input');

    // --- チェックリストのイベントリスナー設定 ---
    allCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            checklist.handleSync(e);
            checklist.saveState();
        });
    });
    
    // --- 認証のイベントリスナー設定 ---
    document.getElementById('register-button').addEventListener('click', () => auth.register());
    loginBioButton.addEventListener('click', () => auth.loginWithBio());
    document.getElementById('login-pass-button').addEventListener('click', () => auth.loginWithPassword());

    // --- 初期化処理 ---
    checklist.loadState();
    auth.init();
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
