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
// 実機で確認済みの形: parsed は parse() の戻り値の timelines(配列)。
// parse() の戻り値そのままや、timelines[0] 単体ではビューがエラーになる。
const buildState = (text: string) => {
  let timelines: any[] = [];
  let error: string | undefined;
  try {
    const result: any = parse(text);
    timelines = Array.isArray(result) ? result : (result?.timelines ?? [result]);
  }
  catch (e) {
    error = (e as Error).message;
  }
  const markwhenState = {
    rawText: text,
    parsed: timelines,
    transformed: timelines[0]?.events,
  };
  return { markwhenState, error };
};

// colorMap は { パス: { タグ: 'R, G, B' } } の形。キー 'default' が必要。
const buildAppState = () => ({ isDark: isDarkMode(), colorMap: { default: {} } });

type Props = { text: string };
type State = { error?: string };

export class MarkwhenViewer extends React.Component<Props, State> {
  state: State = {};

  private frameRef = React.createRef<HTMLIFrameElement>();

  private host: LpcHost | null = null;

  componentDidMount(): void {
    const frame = this.frameRef.current;
    if (frame == null) return;

    // ビューからの要求(markwhenState / appState)に返信する
    this.host = new LpcHost(frame, viewOrigin, {
      markwhenState: () => this.currentState().markwhenState,
      appState: () => buildAppState(),
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

  private currentState() {
    const { markwhenState, error } = buildState(this.props.text);
    if (DEBUG) console.log('[markwhen] state:', markwhenState);
    if (error !== this.state.error) {
      setTimeout(() => this.setState({ error }), 0);
    }
    return { markwhenState };
  }

  // ページ内容が変わったとき、ビューへ更新を通知する
  private pushState = (): void => {
    const host = this.host;
    if (host == null) return;
    host.push('appState', buildAppState());
    host.push('markwhenState', this.currentState().markwhenState);
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
          style={{
            width: '100%', height: VIEW_HEIGHT, border: '1px solid #ccc', borderRadius: 4,
          }}
        />
      </div>
    );
  }
}