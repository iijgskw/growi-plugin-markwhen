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

// ```markwhen のコードブロックだけ差し替え、それ以外は元の code コンポーネントに委譲する
const wrapCode = (Original: any) => (props: any): JSX.Element => {
  const { className, children } = props;
  const isMarkwhen = typeof className === 'string'
    && className.split(/\s+/).includes(`language-${LANG}`);

  if (isMarkwhen) {
    const raw = Array.isArray(children) ? children.join('') : String(children ?? '');
    return <MarkwhenViewer text={raw.replace(/\n$/, '')} />;
  }
  return <Original {...props} />;
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