/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Площадка сборки: yandex (по умолчанию) или crazygames — задаётся в .env.crazygames. */
  readonly VITE_PLATFORM?: 'yandex' | 'crazygames';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
