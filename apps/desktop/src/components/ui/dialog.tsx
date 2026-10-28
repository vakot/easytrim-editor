"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";

import * as SharedDialog from "@easytrim-editor/ui/dialog";

const {
  createDialogScope,
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} = SharedDialog;

type DialogScope = SharedDialog.DialogScope;

/** The shared dialog with the application's localized close label. */
function DialogContent(props: React.ComponentProps<typeof SharedDialog.DialogContent>) {
  const { t } = useTranslation();

  return <SharedDialog.DialogContent closeLabel={t("common.actions.close")} {...props} />;
}

function DialogFooter(props: React.ComponentProps<typeof SharedDialog.DialogFooter>) {
  const { t } = useTranslation();

  return <SharedDialog.DialogFooter closeLabel={t("common.actions.close")} {...props} />;
}

export {
  createDialogScope,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
export type { DialogScope };
