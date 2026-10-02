import React from 'react';
import { parse } from '@markwhen/parser';
import { DEBUG, VIEW_HEIGHT, VIEW_URL } from './config';
import { LpcHost } from './lpc';

// フック(useEffect等)は使わず、クラスコンポーネントで実装している。
// GROWI本体とプラグインでReactインスタンスが別でも動くようにするため。

const viewOrigin = new URL(VIEW_URL, window.location.href).origin;

const isDarkMode = (): boolean => (
  document.documentElement.getAttribute('data-bs-theme') === 'dark'
);

// ビューに渡す状態を作る。
// ※ MarkwhenState / AppState の形はバージョン依存。動作確認時に要調整。
const buildState = (text: string) => {
  let parsed: any;
  let error: string | undefined;
  try {
    parsed = parse(text);
  }
  catch (e) {
    error = (e as Error).message;
  }
  const markwhenState = {
    rawText: text,
    parsed,
    transformed: parsed?.timelines?.[0]?.events,
  };
  return { markwhenState, error };
};

type Props = { text: string };
type State = { error?: string };

export class MarkwhenViewer extends React.Component<Props, State> {
  state: State = {};

  private frameRef = React.createRef<HTMLIFrameElement>();

  private host: LpcHost | null = null;

  private ready = false;

  componentDidMount(): void {
    const frame = this.frameRef.current;
    if (frame == null) return;

    // ビューからの最初のリクエスト(=ビューの準備完了とみなす)で一度だけ状態を送る
    this.host = new LpcHost(frame, viewOrigin, (method) => {
      if (DEBUG) console.log('[markwhen] view request:', method);
      if (!this.ready) {
        this.ready = true;
        setTimeout(this.pushState, 0);
      }
      return null;
    });
    this.host.start();
  }

  componentDidUpdate(prev: Props): void {
    // ページ内容(編集プレビュー含む)が変わったら再送
    if (prev.text !== this.props.text) {
      this.pushState();
    }
  }

  componentWillUnmount(): void {
    this.host?.stop();
    this.host = null;
  }

  private pushState = (): void => {
    const host = this.host;
    if (host == null) return;

    const { markwhenState, error } = buildState(this.props.text);
    if (error !== this.state.error) {
      this.setState({ error });
    }
    host.notify('appState', { isDark: isDarkMode(), colorMap: {} });
    host.notify('markwhenState', markwhenState);
  };

  render(): JSX.Element {
    const { error } = this.state;
    return (
      <div style={{ whiteSpace: 'normal', margin: '1rem 0' }}>
        {error != null && (
          <div style={{ color: 'crimson', fontSize: '0.85rem' }}>Markwhen parse error: {error}</div>
        )}
        <iframe
          ref={this.frameRef}
          src={VIEW_URL}
          title="markwhen timeline"
          sandbox="allow-scripts allow-same-origin"
          onLoad={this.pushState}
          style={{
            width: '100%', height: VIEW_HEIGHT, border: '1px solid #ccc', borderRadius: 4,
          }}
        />
      </div>
    );
  }
}