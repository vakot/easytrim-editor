function AudioTrackDetails({
  controller,
  stream,
  track,
  trackNumber,
}: Omit<AudioTrackRowProps, "trackColor"> & {
  controller: AudioTrackController;
  liveGainDb: number;
  onLiveGainChange: (gainDb: number | null) => void;
}) {
  const { t } = useTranslation();
  const { clearLiveAudioTrackGain, setLiveAudioTrackGain } = usePlayback();

  const title =
    stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

  return (
    <div className="flex items-center gap-1">
      <AudioTrackToggle stream={stream} track={track} />

      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="leading-tight">
          <p
            className="truncate text-sm font-semibold transition-colors data-[enabled=false]:text-muted-foreground"
            data-enabled={track.enabled}
          >
            {title}
          </p>
          <p className="truncate text-xs leading-5 text-muted-foreground">
            #{trackNumber} · {stream.codecName.toUpperCase()} · {formatChannels(stream, t)}
          </p>
        </div>
        <AudioTrackGainControl
          clearLiveAudioTrackGain={clearLiveAudioTrackGain}
          liveGainDb={liveGainDb}
          onCommit={controller.commitGain}
          onLiveGainChange={onLiveGainChange}
          setLiveAudioTrackGain={setLiveAudioTrackGain}
          streamIndex={stream.streamIndex}
          trackGainDb={track.processing.gainDb}
          trackNumber={trackNumber}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("audio.accessibility.trackActions", { number: trackNumber })}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <AudioTrackDropdownMenuContent
          controller={controller}
          stream={stream}
          trackNumber={trackNumber}
        />
      </DropdownMenu>
    </div>
  );
}

function AudioTrackGainControl({
  clearLiveAudioTrackGain,
  liveGainDb,
  onCommit,
  onLiveGainChange,
  setLiveAudioTrackGain,
  streamIndex,
  trackGainDb,
  trackNumber,
}: {
  clearLiveAudioTrackGain: (streamIndex: number, committedGainDb: number) => void;
  liveGainDb: number;
  onCommit: (gainDb: number) => void;
  onLiveGainChange: (gainDb: number | null) => void;
  setLiveAudioTrackGain: (streamIndex: number, gainDb: number) => void;
  streamIndex: number;
  trackGainDb: number;
  trackNumber: number;
}) {
  const { i18n, t } = useTranslation();
  const liveGainRef = useRef(trackGainDb);
  const initialGainRef = useRef(trackGainDb);
  const interactionKindRef = useRef<"keyboard" | "pointer" | null>(null);
  const commitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (interactionKindRef.current === null) {
      liveGainRef.current = liveGainDb;
      initialGainRef.current = liveGainDb;
    }
  }, [liveGainDb]);

  const finishInteraction = useCallback(
    (gainDb = liveGainRef.current) => {
      if (interactionKindRef.current === null) return;
      interactionKindRef.current = null;
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      if (gainDb !== initialGainRef.current) onCommit(gainDb);
      clearLiveAudioTrackGain(streamIndex, gainDb);
      onLiveGainChange(null);
      initialGainRef.current = gainDb;
    },
    [clearLiveAudioTrackGain, onCommit, onLiveGainChange, streamIndex],
  );

  useEffect(
    () => () => {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      if (interactionKindRef.current !== null) {
        clearLiveAudioTrackGain(streamIndex, liveGainRef.current);
      }
    },
    [clearLiveAudioTrackGain, streamIndex],
  );

  const startInteraction = (kind: "keyboard" | "pointer") => {
    if (interactionKindRef.current === null) initialGainRef.current = liveGainRef.current;
    interactionKindRef.current = kind;
  };

  const updateGain = (values: number[]) => {
    const nextGain = values[0];
    if (nextGain === undefined) return;
    if (interactionKindRef.current === null) startInteraction("pointer");
    liveGainRef.current = nextGain;
    onLiveGainChange(nextGain);
    setLiveAudioTrackGain(streamIndex, nextGain);

    if (interactionKindRef.current === "keyboard") {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = window.setTimeout(() => finishInteraction(), 300);
    }
  };

  return (
    <div className="flex h-4 min-w-0 items-center gap-1.5">
      <Slider
        aria-label={t("audio.accessibility.trackGain", { number: trackNumber })}
        className="min-w-0 flex-1 py-0 **:data-[slot=slider-thumb]:size-2.5"
        max={12}
        min={-24}
        onBlur={() => finishInteraction()}
        onKeyDownCapture={(event) => {
          if (event.key === "Enter") finishInteraction();
          else if (
            [
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "End",
              "Home",
              "PageDown",
              "PageUp",
            ].includes(event.key)
          )
            startInteraction("keyboard");
        }}
        onKeyUpCapture={(event) => {
          if (interactionKindRef.current === "keyboard" && event.key.startsWith("Arrow"))
            finishInteraction();
        }}
        onPointerCancelCapture={() => finishInteraction()}
        onPointerDownCapture={() => startInteraction("pointer")}
        onValueChange={updateGain}
        onValueCommit={(values) => {
          if (interactionKindRef.current === "pointer") finishInteraction(values[0]);
        }}
        step={0.5}
        value={[liveGainDb]}
      />
      <output className="w-10 shrink-0 text-right text-[10px] leading-none text-muted-foreground">
        {formatGain(liveGainDb, i18n.language)}
      </output>
    </div>
  );
}

function formatGain(gainDb: number, language: string): string {
  const value = new Intl.NumberFormat(language, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(gainDb);

  return `${value.replace(/-/g, "−")} dB`;
}

export { AudioTrackDetails };
