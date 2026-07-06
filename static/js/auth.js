'use strict';

/* ============================================================
   Auth: ログイン（メール＋パスワード）と学習進捗のクラウド同期
   ------------------------------------------------------------
   ・Firebase Authentication … アカウント管理
   ・Cloud Firestore         … users/{uid} に進捗を保存
   ・firebase-config.js が未設定のときは何もしない（従来どおり動く）
   ============================================================ */
var Auth = (function() {
  var _user = null;        // ログイン中のユーザー（未ログインは null）
  var _enabled = false;    // Firebaseが設定済みか
  var _db = null;
  var _listeners = [];     // ログイン状態が変わったとき呼ぶコールバック
  var _pushTimer = null;

  function configured() {
    return typeof firebase !== 'undefined' &&
           typeof FIREBASE_CONFIG !== 'undefined' &&
           FIREBASE_CONFIG.apiKey &&
           FIREBASE_CONFIG.apiKey.indexOf('ここに') !== 0;
  }

  function init() {
    if (!configured()) return;   // 未設定ならログイン機能オフ
    firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    _enabled = true;
    firebase.auth().onAuthStateChanged(function(u) {
      // メール未確認のユーザーは「ログインしていない」扱いにする
      // （新規登録直後や確認メール再送時に一時的にサインイン状態になるため）
      _user = (u && u.emailVerified) ? u : null;
      if (_user) {
        // ログインしたらクラウドとローカルの進捗をマージしてから通知
        pullAndMerge().then(_notify)['catch'](function(e) {
          console.warn('進捗の同期に失敗しました', e);
          _notify();
        });
      } else {
        _notify();
      }
    });
  }

  function _notify() {
    _listeners.forEach(function(cb) { try { cb(_user); } catch (e) {} });
  }

  /* クラウドの進捗とローカル(localStorage)の進捗をマージする。
     星は「大きい方」、称号は「両方の合算」→ 消える方向には絶対いかない */
  function pullAndMerge() {
    if (!_user || !window.Progress) return Promise.resolve();
    var ref = _db.collection('users').doc(_user.uid);
    return ref.get().then(function(snap) {
      var cloud = snap.exists ? (snap.data() || {}) : {};
      Progress.load();
      var local = Progress._data;

      var stars = {};
      var cs = cloud.stars || {};
      Object.keys(cs).forEach(function(k) { stars[k] = cs[k]; });
      Object.keys(local.stars).forEach(function(k) {
        stars[k] = Math.max(stars[k] || 0, local.stars[k]);
      });

      var titles = (cloud.titles || []).slice();
      (local.titles || []).forEach(function(t) {
        if (titles.indexOf(t) < 0) titles.push(t);
      });

      local.stars = stars;
      local.titles = titles;
      localStorage.setItem('mj_progress', JSON.stringify(local));

      return ref.set({
        stars: stars,
        titles: titles,
        email: _user.email,
        name: _user.displayName || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }

  /* Progress.save() から呼ばれる。連続クリアなどで書き込みが
     連発しないよう、1秒待ってからまとめてクラウドに送信する */
  function schedulePush(data) {
    if (!_enabled || !_user) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(function() {
      _db.collection('users').doc(_user.uid).set({
        stars: data.stars,
        titles: data.titles,
        email: _user.email,
        name: _user.displayName || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })['catch'](function(e) {
        console.warn('進捗の保存に失敗しました', e);
      });
    }, 1000);
  }

  /* Firebaseのエラーコード → 日本語メッセージ */
  var ERR_JA = {
    'auth/invalid-email':        'メールアドレスの形式が正しくありません',
    'auth/user-not-found':       'このメールアドレスは登録されていません',
    'auth/wrong-password':       'パスワードが違います',
    'auth/invalid-credential':   'メールアドレスかパスワードが違います',
    'auth/email-already-in-use': 'このメールアドレスはすでに登録されています',
    'auth/weak-password':        'パスワードは6文字以上にしてください',
    'auth/missing-password':     'パスワードを入力してください',
    'auth/too-many-requests':    '試行回数が多すぎます。しばらく待ってから再試行してください',
    'auth/network-request-failed': '通信エラーです。ネットワークを確認してください',
    'app/email-not-verified':    'メールアドレスの確認がまだです。届いた確認メールのリンクをクリックしてからログインしてください',
    'auth/requires-recent-login': '安全のため再ログインが必要です。いったんログアウトし、ログインし直してからお試しください',
  };
  function jaError(e) {
    return ERR_JA[e && e.code] || ('エラーが発生しました（' + ((e && e.code) || '不明') + '）');
  }

  return {
    init: init,
    enabled: function() { return _enabled; },
    user: function() { return _user; },
    onChange: function(cb) { _listeners.push(cb); },
    schedulePush: schedulePush,
    /* 新規登録：アカウント作成 → 確認メール送信 → いったんサインアウト
       （メール内のリンクを承認するまでログイン扱いにしない）
       ※表示名はログイン後にアカウント画面で設定する */
    register: function(email, pass) {
      return firebase.auth().createUserWithEmailAndPassword(email, pass).then(function(cred) {
        return cred.user.sendEmailVerification()
          .then(function() { return firebase.auth().signOut(); });
      });
    },
    /* ログイン：メール未確認ならサインアウトして専用エラーを返す */
    login: function(email, pass) {
      return firebase.auth().signInWithEmailAndPassword(email, pass).then(function(cred) {
        if (!cred.user.emailVerified) {
          return firebase.auth().signOut().then(function() {
            var e = new Error('email not verified');
            e.code = 'app/email-not-verified';
            throw e;
          });
        }
        return cred;
      });
    },
    /* 確認メールの再送：一時的にサインインして送信し、すぐサインアウト */
    resendVerification: function(email, pass) {
      return firebase.auth().signInWithEmailAndPassword(email, pass).then(function(cred) {
        if (cred.user.emailVerified) {
          // すでに確認済みならそのままログイン成立
          return cred;
        }
        return cred.user.sendEmailVerification().then(function() {
          return firebase.auth().signOut();
        });
      });
    },
    /* 表示名の設定・変更（アカウント画面から）。Firestore側のnameも更新する */
    updateName: function(name) {
      var u = firebase.auth().currentUser;
      if (!u) return Promise.reject(new Error('ログインしていません'));
      return u.updateProfile({ displayName: name }).then(function() {
        if (!_db) return;
        return _db.collection('users').doc(u.uid).set({
          name: name,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
    },
    /* アカウント削除：安全のためパスワードで再認証してから、
       ①Firestoreの進捗データ → ②Authアカウント の順に削除する
       （アカウントを先に消すとルール上Firestoreに触れなくなるため） */
    deleteAccount: function(password) {
      var u = firebase.auth().currentUser;
      if (!u) return Promise.reject(new Error('ログインしていません'));
      var cred = firebase.auth.EmailAuthProvider.credential(u.email, password);
      return u.reauthenticateWithCredential(cred).then(function() {
        return _db ? _db.collection('users').doc(u.uid).delete() : Promise.resolve();
      }).then(function() {
        return u.delete();
      });
    },
    logout:   function() { return firebase.auth().signOut(); },
    resetPassword: function(email) { return firebase.auth().sendPasswordResetEmail(email); },
    jaError: jaError,
  };
})();

Auth.init();
