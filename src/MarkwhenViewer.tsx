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

/**
 * ビューに渡す markwhenState の `parsed` の形(デバッグ用に切り替え可能)。
 *   A: timelines の配列(既定)
 *   B: parse() の戻り値そのまま(公式 Obsidian プラグインの方式と同じはず)
 *   C: timelines[0] 単体
 *   D: [parse() の戻り値]
 * コンソールから __markwhenDebug.setShape('B') のように切り替えられる。
 */
type Shape = 'A' | 'B' | 'C' | 'D';
const getShape = (): Shape => ((window as any).__MW_SHAPE as Shape) ?? 'B';

const buildState = (text: string) => {
  let result: any;
  let timelines: any[] = [];
  let error: string | undefined;
  try {
    result = parse(text);
    timelines = Array.isArray(result) ? result : (result?.timelines ?? [result]);
  }
  catch (e) {
    error = (e as Error).message;
  }
  const first = timelines[0];

  let parsed: any;
  switch (getShape()) {
    case 'A': parsed = timelines; break;
    case 'C': parsed = first; break;
    case 'D': parsed = [result]; break;
    default: parsed = result; break; // B
  }

  const markwhenState = { rawText: text, parsed, transformed: first?.events };
  if (DEBUG) {
    console.log('[markwhen] parse result:', {
      isArray: Array.isArray(result),
      keys: result != null ? Object.keys(result) : null,
      shape: getShape(),
    });
  }
  return { markwhenState, error };
};

// colorMap は { パス: { タグ: 'R, G, B' } } の形(公式 Obsidian プラグインの解説より)
const buildAppState = () => ({ isDark: isDarkMode(), colorMap: { default: {} } });

type Props = { text: string };
type State = { error?: string };

const instances = new Set<MarkwhenViewer>();

// デバッグ用フック: コンソールから状態の形を切り替えて再送できる
(window as any).__markwhenDebug = {
  setShape: (s: Shape) => {
    (window as any).__MW_SHAPE = s;
    instances.forEach(i => i.refresh());
    return `shape=${s}, viewers=${instances.size}`;
  },
  resend: () => {
    instances.forEach(i => i.refresh());
    return `viewers=${instances.size}`;
  },
  lastState: undefined as unknown,
};

export class MarkwhenViewer extends React.Component<Props, State> {
  state: State = {};

  private frameRef = React.createRef<HTMLIFrameElement>();

  private host: LpcHost | null = null;

  componentDidMount(): void {
    instances.add(this);
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
    instances.delete(this);
    this.host?.stop();
    this.host = null;
  }

  refresh(): void {
    this.pushState();
  }

  private currentState() {
    const { markwhenState, error } = buildState(this.props.text);
    (window as any).__markwhenDebug.lastState = markwhenState;
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