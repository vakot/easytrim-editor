import { Button } from "@easytrim-editor/ui/button";

import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function ExportQueueStartButton() {
  const command = useApplicationCommand("start-export-queue");
  const { executeCommand } = useApplicationCommands();

  return (
    <Button
      disabled={!command.enabled || command.pending}
      onClick={() => void executeCommand(command.id, "button")}
      type="button"
    >
      {command.label}
    </Button>
  );
}

export { ExportQueueStartButton };
