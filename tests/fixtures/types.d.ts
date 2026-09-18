/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

// Simulates the real JupyterLab pattern and includes cases where:
//   - The interface lives inside a namespace   (separate from the token)
//   - The token is exported as a standalone const typed as Token<Namespace.Interface>

declare class Token<T> {}
declare class JupyterFrontEnd {}
declare class JupyterFrontEndPlugin<T> {}
export { JupyterFrontEndPlugin };
export declare class ServiceManagerPlugin<T> {}

export declare namespace IDebugger {
  interface ISidebar {}
}

export declare namespace IRenderMime {
  interface IExtension {
    readonly id: string;
    readonly rendererFactory: unknown;
  }
}
export declare const IDebuggerSidebar: Token<IDebugger.ISidebar>;

export declare interface INotebookTracker {}
export declare const INotebookTracker: Token<INotebookTracker>;

export declare interface ITranslator {}
export declare const ITranslator: Token<ITranslator>;

export declare interface IRenderMimeRegistry {}
export declare const IRenderMimeRegistry: Token<IRenderMimeRegistry>;

export declare interface IToolbarWidgetRegistry {}
export declare const IToolbarWidgetRegistry: Token<IToolbarWidgetRegistry>;

export declare interface ISettingRegistry {}
export declare const ISettingRegistry: Token<ISettingRegistry>;

export declare interface ICommandPalette {}
export declare const ICommandPalette: Token<ICommandPalette>;
