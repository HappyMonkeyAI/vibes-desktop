import type { VibesDesktopApi } from './index';

declare global {
  interface Window {
    vibesDesktop: VibesDesktopApi;
  }
}

export {};
