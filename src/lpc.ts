import { DEBUG } from './config';

/**
 * Markwhen ビュー(@markwhen/view-client の useLpc)とのホスト側通信。
 *
 * 実機で観測した形式(ビュー → ホスト):
 *   { type: 'markwhenState', request: true, id: 'markwhen_xxxx' }
 *   { type: 'appState',      request: true, id: 'markwhen_xxxx' }
 * つまりビューが「状態をください」とホストに要求してくる。
 *
 * 返信の形式(ホスト → ビュー。実機で動作確認済み):
 *   { type, response: true, id: <要求と同じid>, params: <返す値> }
 * ホストからの更新通知は、同じ形式の request を送る(ビューの listeners[type] が呼ばれる)。
 *
 * ビュー側(view-client)の受信条件(実コードで確認済み):
 *   - メッセージの id が 'markwhen' で始まらないものは無視される
 *   - 自分自身のウィンドウ(event.source === window)からのものも無視される
 *   - response は pending の postRequest を resolve する(返信全体が渡され、値は params)
 *   - request は listeners[type](params) を呼び、結果を {type, response:true, id, params} で返す
 * DEBUG=true でやり取りがコンソールに出る。
 */
export class LpcHost {
  private seq = 0;

  constructor(
    private frame: HTMLIFrameElement,
    private origin: string,
    /** ビューからの要求 type ごとに、返す値を作る関数 */
    private handlers: Record<string, () => unknown>,
  ) {}

  start(): void {
    window.addEventListener('message', this.handle);
  }

  stop(): void {
    window.removeEventListener('message', this.handle);
  }

  /** ホストからビューへ更新を通知する */
  push(type: string, params: unknown): void {
    this.post({ type, request: true, id: `markwhen_host_${++this.seq}`, params });
  }

  private post(message: Record<string, unknown>): void {
    const target = this.frame.contentWindow;
    if (target == null) return;
    if (DEBUG) console.log('[markwhen] to view:', message);
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
    if (data == null || typeof data.type !== 'string') return;

    // ビューからの要求 → 返信
    if (data.request === true) {
      const handler = this.handlers[data.type];
      const params = handler != null ? handler() : undefined;
      this.post({ type: data.type, response: true, id: data.id, params });
    }
    // data.response === true は、こちらからのpushへの返信。何もしない
  };
}