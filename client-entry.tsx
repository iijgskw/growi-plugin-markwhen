import React from 'react';
import config from './package.json';
import { MarkwhenViewer } from './src/MarkwhenViewer';
// GROWI本体が提供するファサード(型は最小限)
type GenerateOptions = (...args: any[]) => any;

declare const growiFacade: {
  markdownRenderer?: {
    optionsGenerators: {
      customGenerateViewOptions?: GenerateOptions;
      generateViewOptions: GenerateOptions;
      customGeneratePreviewOptions?: GenerateOptions;
      generatePreviewOptions: GenerateOptions;
    };
  };
};

const LANG = 'markwhen';

// ```markwhen のコードブロックだけ差し替え、それ以外は元の code コンポーネントに委譲する。
//
// 重要: 差し替え用コンポーネントは Original ごとに1つだけ作って使い回す。
// 編集プレビューは入力のたびに options を作り直すため、毎回新しいコンポーネントを作ると
// React が別物と判断して iframe ごと破棄・再作成してしまい、ビューが状態を受け取れない。
const NO_ORIGINAL = {};
const wrapperCache = new WeakMap<object, any>();

const wrapCode = (Original: any) => {
  if (Original != null && Original.__markwhenWrapped) return Original;

  const key = Original ?? NO_ORIGINAL;
  let wrapped = wrapperCache.get(key);
  if (wrapped == null) {
    wrapped = (props: any): JSX.Element => {
      const { className, children } = props;
      const isMarkwhen = typeof className === 'string'
        && className.split(/\s+/).includes(`language-${LANG}`);

      if (isMarkwhen) {
        const raw = Array.isArray(children) ? children.join('') : String(children ?? '');
        return <MarkwhenViewer text={raw.replace(/\n$/, '')} />;
      }
      return Original != null ? <Original {...props} /> : <code {...props} />;
    };
    wrapped.__markwhenWrapped = true;
    wrapperCache.set(key, wrapped);
  }
  return wrapped;
};

const activate = (): void => {
  if (growiFacade == null || growiFacade.markdownRenderer == null) {
    return;
  }
  const { optionsGenerators } = growiFacade.markdownRenderer;

  // 閲覧画面
  const origView = optionsGenerators.customGenerateViewOptions;
  optionsGenerators.customGenerateViewOptions = (...args) => {
    const options = origView
      ? origView(...args)
      : optionsGenerators.generateViewOptions(...args);
    options.components.code = wrapCode(options.components.code);
    return options;
  };

  // 編集時のプレビュー
  const origPreview = optionsGenerators.customGeneratePreviewOptions;
  optionsGenerators.customGeneratePreviewOptions = (...args) => {
    const options = origPreview
      ? origPreview(...args)
      : optionsGenerators.generatePreviewOptions(...args);
    options.components.code = wrapCode(options.components.code);
    return options;
  };
};

const deactivate = (): void => {};

// add to window.pluginActivators
if ((window as any).pluginActivators == null) {
  (window as any).pluginActivators = {};
}
(window as any).pluginActivators[config.name] = {
  activate,
  deactivate,
};