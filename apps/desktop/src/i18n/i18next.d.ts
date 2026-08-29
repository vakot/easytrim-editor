import "i18next";

import type { TranslationSchema } from "./schema";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: TranslationSchema;
    };
    returnNull: false;
  }
}
