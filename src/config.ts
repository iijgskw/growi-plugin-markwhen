// ===== 設定値 =====
// Markwhen タイムラインビューのURL。
// 社内Wikiでは、mark-when/timeline をビルドして社内HTTPSサーバーに置いたURLを推奨。
// 相対パス(例: '/markwhen/index.html')も可。GROWIと同一オリジンになる。
export const VIEW_URL = 'https://timeline.markwhen.com';

// iframeの高さ(px)
export const VIEW_HEIGHT = 480;

// true にすると、ビューとのpostMessageをコンソールに出力する(動作確認用。確認が済んだら false に戻す)
export const DEBUG = false;