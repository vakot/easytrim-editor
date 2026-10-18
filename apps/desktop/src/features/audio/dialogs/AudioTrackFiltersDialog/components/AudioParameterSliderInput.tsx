import { useId } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Slider, type SliderMarker } from "@/components/ui/slider";

function AudioParameterSliderInput({
  disabled = false,
  error,
  inputMode,
  inputUnit,
  inputValue,
  invalid = false,
  label,
  markers,
  onDoubleClick,
  onInputBlur,
  onInputChange,
  onSliderChange,
  placeholder,
  sliderMax,
  sliderMin,
  sliderStep,
  sliderValue,
  sliderValueText,
}: {
  disabled?: boolean;
  error?: string;
  inputMode: "decimal" | "text";
  inputUnit?: string;
  inputValue: string;
  invalid?: boolean;
  label: string;
  markers: readonly SliderMarker[];
  onDoubleClick?: () => void;
  onInputBlur: () => void;
  onInputChange: (text: string) => void;
  onSliderChange: (value: number) => void;
  placeholder?: string;
  sliderMax: number;
  sliderMin: number;
  sliderStep: number;
  sliderValue: number;
  sliderValueText: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-1" data-slot="audio-filter-parameter">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <Slider
          aria-label={label}
          aria-valuetext={sliderValueText}
          className="flex-1"
          disabled={disabled}
          markers={[...markers]}
          max={sliderMax}
          min={sliderMin}
          onDoubleClick={onDoubleClick}
          onValueChange={([value]) => {
            if (value !== undefined) onSliderChange(value);
          }}
          step={sliderStep}
          value={[sliderValue]}
        />
        <InputGroup className="w-32 shrink-0">
          <InputGroupInput
            aria-describedby={error ? errorId : undefined}
            aria-invalid={invalid}
            id={id}
            inputMode={inputMode}
            onBlur={onInputBlur}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={placeholder}
            value={inputValue}
          />
          {inputUnit ? <InputGroupAddon align="inline-end">{inputUnit}</InputGroupAddon> : null}
        </InputGroup>
      </div>
      {error ? (
        <p
          aria-live={invalid ? "polite" : undefined}
          className="text-xs text-destructive"
          id={errorId}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { AudioParameterSliderInput };
