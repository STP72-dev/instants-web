/**
 * Lazily imported Excalidraw client (DECISIONS.md D2). Loaded only when an entry without an export PNG needs a
 * client-side SVG, or when the reader opens the interactive canvas. The drawings carry their own dark background,
 * so they are rendered in Excalidraw's light theme (its dark theme would invert them).
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Excalidraw, exportToSvg, restore } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

type Scene = ReturnType<typeof restore>;

const scenes = new Map<string, Promise<Scene>>();

/** Fetch and normalise a `.excalidraw` file from our own origin (cached per URL). */
export function loadScene(url: string): Promise<Scene> {
  let scene = scenes.get(url);
  if (!scene) {
    scene = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return restore(await res.json(), null, null);
    });
    scenes.set(url, scene);
  }
  return scene;
}

export async function renderSvg(url: string): Promise<SVGSVGElement> {
  const { elements, appState, files } = await loadScene(url);
  const svg = await exportToSvg({
    elements: elements.filter((e) => !e.isDeleted),
    appState: { ...appState, exportBackground: true, exportWithDarkMode: false, exportEmbedScene: false },
    files,
    exportPadding: 24,
  });
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return svg;
}

/**
 * Mount the read-only viewer into `container`; returns an unmount function.
 * If `signal` is aborted while the scene loads, no React root is created and a no-op is returned.
 */
export async function mountViewer(container: HTMLElement, url: string, signal?: AbortSignal): Promise<() => void> {
  const { elements, appState, files } = await loadScene(url);
  if (signal?.aborted) return () => {};
  const root: Root = createRoot(container);
  root.render(
    createElement(Excalidraw, {
      initialData: {
        elements,
        appState: { viewBackgroundColor: appState.viewBackgroundColor, gridModeEnabled: false },
        files,
      },
      // Fit the whole drawing once the canvas has measured itself.
      excalidrawAPI: (api) => requestAnimationFrame(() => api.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.92 })),
      viewModeEnabled: true,
      zenModeEnabled: true,
      theme: 'light',
      langCode: 'en',
      UIOptions: {
        canvasActions: {
          changeViewBackgroundColor: false,
          clearCanvas: false,
          export: false,
          loadScene: false,
          saveToActiveFile: false,
          saveAsImage: false,
          toggleTheme: false,
        },
        tools: { image: false },
      },
    }),
  );
  return () => root.unmount();
}
