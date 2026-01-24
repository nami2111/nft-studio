/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/client" />

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            nonce: string;
        }
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }
}

declare namespace svelteHTML {
    interface HTMLAttributes<T> {
        'data-testid'?: string;
    }
}

export { };

declare module 'virtual:pwa-register' {
    export interface RegisterSWOptions {
        immediate?: boolean;
        onNeedRefresh?: () => void;
        onOfflineReady?: () => void;
        onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
        onRegisterError?: (error: any) => void;
    }

    export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

declare module 'virtual:pwa-info' {
    export const pwaInfo:
        | {
            webManifest: {
                href: string;
                linkTag: string;
            };
        }
        | undefined;
}
