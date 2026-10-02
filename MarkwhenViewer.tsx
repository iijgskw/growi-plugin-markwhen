import React from 'react';
import { growiReact } from '@growi/pluginkit';
import { parse } from '@markwhen/parser';
import { DEBUG, VIEW_HEIGHT, VIEW_URL } from './config';
import { LpcHost } from './lpc';

// GROWI本体のReactインスタンスのフックを使う(公式: Using React hooks)
const { useEffect, useMemo, useRef } = growiReact(React);

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

export const MarkwhenViewer = ({ text }: Props): JSX.Element => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<LpcHost | null>(null);
  const readyRef = useRef(false);

  const { markwhenState, error } = useMemo(() => buildState(text), [text]);
  const stateRef = useRef(markwhenState);
  stateRef.current = markwhenState;

  const pushState = (): void => {
    const host = hostRef.current;
    if (host == null) return;
    host.notify('appState', { isDark: isDarkMode(), colorMap: {} });
    host.notify('markwhenState', stateRef.current);
  };

  // ビューからの最初のリクエスト(=ビューの準備完了とみなす)で一度だけ状態を送る
  useEffect(() => {
    const frame = frameRef.current;
    if (frame == null) return undefined;

    const host = new LpcHost(frame, viewOrigin, (method) => {
      if (DEBUG) console.log('[markwhen] view request:', method);
      if (!readyRef.current) {
        readyRef.current = true;
        setTimeout(pushState, 0);
      }
      return null;
    });
    host.start();
    hostRef.current = host;
    return () => {
      host.stop();
      hostRef.current = null;
    };
  }, []);

  // ページ内容(編集プレビュー含む)が変わったら再送
  useEffect(() => {
    pushState();
  }, [markwhenState]);

  return (
    <div style={{ whiteSpace: 'normal', margin: '1rem 0' }}>
      {error != null && (
        <div style={{ color: 'crimson', fontSize: '0.85rem' }}>Markwhen parse error: {error}</div>
      )}
      <iframe
        ref={frameRef}
        src={VIEW_URL}
        title="markwhen timeline"
        sandbox="allow-scripts allow-same-origin"
        onLoad={pushState}
        style={{
          width: '100%', height: VIEW_HEIGHT, border: '1px solid #ccc', borderRadius: 4,
        }}
      />
    </div>
  );
};