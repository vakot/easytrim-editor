import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

/** Start and end frame numbers as typed, which may not yet form a valid range. */
interface FrameRangeInputValue {
  end: string;
  start: string;
}

/** A start–end pair of whole frame number fields. `error` marks both invalid and explains why. */
function FrameRangeInput({
  endLabel,
  error,
  id,
  label,
  maxFrame,
  onValueChange,
  startLabel,
  value,
}: {
  endLabel: string;
  error?: string;
  /** The id of the start field, which the label names. */
  id: string;
  label: string;
  maxFrame: number;
  onValueChange: (value: FrameRangeInputValue) => void;
  startLabel: string;
  value: FrameRangeInputValue;
}) {
  const errorId = `${id}-error`;
  const invalidProps = error ? { "aria-describedby": errorId, "aria-invalid": true } : {};

  return (
    <section className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <InputGroup className="flex-1">
          <InputGroupInput
            {...invalidProps}
            aria-label={startLabel}
            id={id}
            inputMode="numeric"
            max={maxFrame}
            min={0}
            onChange={(event) => onValueChange({ ...value, start: event.target.value })}
            placeholder={startLabel}
            step={1}
            type="number"
            value={value.start}
          />
          <InputGroupAddon className="text-muted-foreground">f</InputGroupAddon>
        </InputGroup>
        <span aria-hidden="true">–</span>
        <InputGroup className="flex-1">
          <InputGroupInput
            {...invalidProps}
            aria-label={endLabel}
            inputMode="numeric"
            max={maxFrame}
            min={0}
            onChange={(event) => onValueChange({ ...value, end: event.target.value })}
            placeholder={endLabel}
            step={1}
            type="number"
            value={value.end}
          />
          <InputGroupAddon className="text-muted-foreground">f</InputGroupAddon>
        </InputGroup>
      </div>
      {error ? (
        <p className="text-sm text-destructive" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export { FrameRangeInput };
export type { FrameRangeInputValue };
