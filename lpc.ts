import { DEBUG } from './config';

/**
 * Markwhen ビュー(@markwhen/view-client の useLpc)とのホスト側通信。
 *
 * 想定プロトコル(要検証):
 *   host/view → 相手: { request:  { jsonrpc: '2.0', method, params, id } }
 *   相手 → 要求元:    { response: { jsonrpc: '2.0', id, result } }
 *
 * ビュー側は useLpc({ markwhenState, appState }) で待ち受けており、
 * ホストが method 名 'markwhenState' / 'appState' のリクエストを送ると
 * 対応するコールバックが呼ばれる、という前提で実装している。
 * 実際のメッセージ形式が異なる場合は、このファイルだけを直せば済むようにしてある。
 * (DEBUG=true でビューから届くメッセージを確認できる)
 */
export class LpcHost {
  private seq = 0;

  constructor(
    private frame: HTMLIFrameElement,
    private origin: string,
    private onViewRequest: (method: string, params: unknown) => unknown,
  ) {}

  start(): void {
    window.addEventListener('message', this.handle);
  }

  stop(): void {
    window.removeEventListener('message', this.handle);
  }

  /** ビューへ状態などを送る(ビュー側の listeners[method] が呼ばれる想定) */
  notify(method: string, params: unknown): void {
    const target = this.frame.contentWindow;
    if (target == null) return;

    const message = { request: { jsonrpc: '2.0', method, params, id: `host-${++this.seq}` } };
    try {
      target.postMessage(message, this.origin);
    }
    catch (e) {
      // structured clone できない値(関数など)を含む場合は JSON 経由にフォールバック
      if (DEBUG) console.warn('[markwhen] clone failed, fallback to JSON', e);
      target.postMessage(JSON.parse(JSON.stringify(message)), this.origin);
    }
  }

  private handle = (e: MessageEvent): void => {
    // このiframe・想定オリジン以外からのメッセージは無視
    if (e.source !== this.frame.contentWindow || e.origin !== this.origin) return;

    const data = e.data;
    if (DEBUG) console.log('[markwhen] from view:', data);

    const req = data?.request;
    if (req == null) return; // response など。今回は何もしない

    const result = this.onViewRequest(req.method, req.params);
    (e.source as Window).postMessage(
      { response: { jsonrpc: '2.0', id: req.id, result: result ?? null } },
      this.origin,
    );
  };
}