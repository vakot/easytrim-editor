import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReturnConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ReturnConfirmationDialog({
  open,
  onCancel,
  onConfirm,
}: ReturnConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">Leave editor</p>
          <DialogTitle>Return to welcome page?</DialogTitle>
          <DialogDescription>
            Your current trim and audio settings will be cleared.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Return to welcome</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
