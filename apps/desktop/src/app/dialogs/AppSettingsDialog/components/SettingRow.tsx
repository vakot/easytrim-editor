import { Button } from "@easytrim-editor/ui/button";
import { Card, CardContent } from "@easytrim-editor/ui/card";

import { Switch } from "@/components/ui/switch";

import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function SettingRow({
  children,
  description,
  label,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
  label: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{label}</div>
        {description ? (
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function SettingsSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="ml-4 font-mono text-sm font-medium text-primary/80 uppercase">{title}</div>
      <Card className="py-0 ring-inset">
        <CardContent className="divide-y">{children}</CardContent>
      </Card>
    </div>
  );
}

function CommandSwitch({
  commandId,
  ...props
}: Omit<React.ComponentProps<typeof Switch>, "disabled" | "checked" | "onCheckedChange"> & {
  commandId: Parameters<typeof useApplicationCommand>[0];
}) {
  const command = useApplicationCommand(commandId);
  const { executeCommand } = useApplicationCommands();
  const { onFocus, onPointerEnter, ...switchProps } = props;

  return (
    <Switch
      checked={Boolean(command.checked)}
      disabled={!command.enabled || command.pending}
      onCheckedChange={() => void executeCommand(command.id, "dialog")}
      {...switchProps}
      onFocus={(event) => {
        onFocus?.(event);
        command.preload?.();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        command.preload?.();
      }}
    />
  );
}

function CommandButton({
  children,
  commandId,
  type = "button",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "disabled" | "onClick"> & {
  commandId: Parameters<typeof useApplicationCommand>[0];
}) {
  const command = useApplicationCommand(commandId);
  const { executeCommand } = useApplicationCommands();
  const { onFocus, onPointerEnter, ...buttonProps } = props;

  return (
    <Button
      disabled={!command.enabled || command.pending}
      onClick={() => void executeCommand(command.id, "dialog")}
      type={type}
      {...buttonProps}
      onFocus={(event) => {
        onFocus?.(event);
        command.preload?.();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        command.preload?.();
      }}
    >
      {children ?? command.label}
    </Button>
  );
}

function CommandReset({
  commandId,
  ...props
}: Omit<React.ComponentProps<typeof CommandButton>, "variant" | "commandId"> & {
  commandId: "reset-editing-settings" | "reset-playback-settings" | "reset-queue-settings";
}) {
  return <CommandButton commandId={commandId} variant="destructive" {...props} />;
}

export { CommandButton, CommandReset, CommandSwitch, SettingRow, SettingsSection };
