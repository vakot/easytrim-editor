use std::{
    collections::{BTreeMap, HashMap},
    fs::{self, File},
    io::{self, BufWriter, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

/// Bounds every cached segment so the segments that can cover a frame are found by scanning one
/// segment length back from it.
pub const MAX_SEGMENT_FRAMES: u64 = 96_000;
const BYTES_PER_SAMPLE: u64 = std::mem::size_of::<f32>() as u64;

/// Whether processed samples are established to equal the continuous render of their range.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PcmQuality {
    /// Produced by one continuous render that started at the range origin.
    Canonical,
    /// Produced after a seek with warm-up; usable for preview but never authoritative.
    Provisional,
}

/// A half-open range of canonical-rate frames on the source timeline.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct FrameRange {
    pub start: u64,
    pub end: u64,
}

/// Identifies one processed signal. The same source activation, stream, compiled chain (with its
/// resolved measurements), continuous rendering range, and channel layout always produce the
/// same samples. Track Volume is never part of it.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct RenderKey {
    pub load_token: u64,
    pub stream_index: u32,
    pub graph: String,
    pub range: FrameRange,
    pub channels: u16,
}

/// One piece of a requested range: samples already cached, or a gap that must be rendered.
#[derive(Clone, Debug, PartialEq)]
pub enum CoveragePart {
    Cached {
        start: u64,
        end: u64,
        quality: PcmQuality,
        path: PathBuf,
        segment_start: u64,
    },
    Missing {
        start: u64,
        end: u64,
    },
}

#[derive(Debug)]
struct Segment {
    frames: u64,
    path: PathBuf,
    bytes: u64,
    last_used: u64,
}

#[derive(Debug, Default)]
struct KeySegments {
    canonical: BTreeMap<u64, Segment>,
    provisional: BTreeMap<u64, Segment>,
    /// Rendered only to audition a draft chain; promoted once the chain is used as committed
    /// audio.
    preview: bool,
}

impl KeySegments {
    fn class(&mut self, quality: PcmQuality) -> &mut BTreeMap<u64, Segment> {
        match quality {
            PcmQuality::Canonical => &mut self.canonical,
            PcmQuality::Provisional => &mut self.provisional,
        }
    }

    fn segments(&self) -> impl Iterator<Item = (PcmQuality, u64, &Segment)> {
        self.canonical
            .iter()
            .map(|(start, segment)| (PcmQuality::Canonical, *start, segment))
            .chain(
                self.provisional
                    .iter()
                    .map(|(start, segment)| (PcmQuality::Provisional, *start, segment)),
            )
    }
}

/// Session-scoped processed PCM on disk, addressed by exact frame indexes.
///
/// Segments are raw interleaved little-endian f32 files. A segment is indexed only after its file
/// was completely written and renamed into place, so partial writes are never visible. Canonical
/// segments are preferred over provisional ones, and replace the provisional segments they cover.
/// Storage is bounded; the least recently used segments are evicted first. Preview audio of draft
/// chains has its own smaller budget and is evicted before committed audio.
#[derive(Debug)]
pub struct PcmCache {
    directory: Option<PathBuf>,
    limit_bytes: u64,
    preview_limit_bytes: u64,
    used_bytes: u64,
    clock: u64,
    next_file_id: u64,
    entries: HashMap<RenderKey, KeySegments>,
}

impl PcmCache {
    pub fn new(limit_bytes: u64) -> Self {
        Self {
            directory: None,
            limit_bytes,
            preview_limit_bytes: limit_bytes / 8,
            used_bytes: 0,
            clock: 0,
            next_file_id: 0,
            entries: HashMap::new(),
        }
    }

    #[cfg(test)]
    pub fn used_bytes(&self) -> u64 {
        self.used_bytes
    }

    fn preview_bytes(&self) -> u64 {
        self.entries
            .values()
            .filter(|segments| segments.preview)
            .flat_map(KeySegments::segments)
            .map(|(_, _, segment)| segment.bytes)
            .sum()
    }

    /// Keeps a key's audio as committed audio, for example when an auditioned chain is applied.
    pub fn promote(&mut self, key: &RenderKey) {
        if let Some(segments) = self.entries.get_mut(key) {
            segments.preview = false;
        }
    }

    /// Drops the preview audio of one stream that was never promoted.
    pub fn remove_preview(&mut self, load_token: u64, stream_index: u32) {
        self.remove_keys(|key, segments| {
            segments.preview && key.load_token == load_token && key.stream_index == stream_index
        });
    }

    /// Splits `[start, end)` into cached runs and gaps, preferring canonical samples.
    pub fn plan(&mut self, key: &RenderKey, start: u64, end: u64) -> Vec<CoveragePart> {
        self.clock += 1;
        let clock = self.clock;
        let Some(segments) = self.entries.get_mut(key) else {
            return vec![CoveragePart::Missing { start, end }];
        };
        let mut parts = Vec::new();
        let mut position = start;
        while position < end {
            let canonical = covering(&mut segments.canonical, position, clock);
            let provisional = covering(&mut segments.provisional, position, clock);
            let part = if let Some((segment_start, segment_end, path)) = canonical {
                CoveragePart::Cached {
                    start: position,
                    end: segment_end.min(end),
                    quality: PcmQuality::Canonical,
                    path,
                    segment_start,
                }
            } else if let Some((segment_start, segment_end, path)) = provisional {
                // Switch to canonical samples as soon as they begin.
                let next_canonical = next_start(&segments.canonical, position).unwrap_or(u64::MAX);
                CoveragePart::Cached {
                    start: position,
                    end: segment_end.min(end).min(next_canonical),
                    quality: PcmQuality::Provisional,
                    path,
                    segment_start,
                }
            } else {
                let next = next_start(&segments.canonical, position)
                    .into_iter()
                    .chain(next_start(&segments.provisional, position))
                    .min()
                    .unwrap_or(u64::MAX);
                CoveragePart::Missing {
                    start: position,
                    end: next.min(end),
                }
            };
            position = match &part {
                CoveragePart::Cached { end, .. } | CoveragePart::Missing { end, .. } => *end,
            };
            parts.push(part);
        }
        parts
    }

    /// Returns a fresh path for a segment file inside the session cache directory.
    pub fn reserve_file(&mut self) -> io::Result<PathBuf> {
        let directory = match &self.directory {
            Some(directory) => directory.clone(),
            None => {
                let directory = create_cache_directory()?;
                self.directory = Some(directory.clone());
                directory
            }
        };
        self.next_file_id += 1;
        Ok(directory.join(format!("{}.f32", self.next_file_id)))
    }

    /// Indexes a completely written segment file and evicts older segments beyond the limit.
    /// `preview` marks a new key as preview audio; committed audio of a key promotes it.
    pub fn commit(
        &mut self,
        key: &RenderKey,
        start: u64,
        frames: u64,
        quality: PcmQuality,
        path: PathBuf,
        preview: bool,
    ) -> io::Result<()> {
        debug_assert!(frames > 0 && frames <= MAX_SEGMENT_FRAMES);
        let bytes = fs::metadata(&path)?.len();
        if bytes != frames * u64::from(key.channels) * BYTES_PER_SAMPLE {
            let _ = fs::remove_file(&path);
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "processed audio segment has an unexpected size",
            ));
        }
        self.clock += 1;
        let segment = Segment {
            frames,
            path,
            bytes,
            last_used: self.clock,
        };
        let segments = self
            .entries
            .entry(key.clone())
            .or_insert_with(|| KeySegments {
                preview,
                ..KeySegments::default()
            });
        segments.preview &= preview;
        if quality == PcmQuality::Canonical {
            let end = start + frames;
            let covered = segments
                .provisional
                .range(start..end)
                .filter(|(segment_start, existing)| **segment_start + existing.frames <= end)
                .map(|(segment_start, _)| *segment_start)
                .collect::<Vec<_>>();
            for covered_start in covered {
                if let Some(removed) = segments.provisional.remove(&covered_start) {
                    self.used_bytes -= removed.bytes;
                    let _ = fs::remove_file(removed.path);
                }
            }
        }
        let class = segments.class(quality);
        if class
            .get(&start)
            .is_some_and(|existing| existing.frames >= frames)
        {
            // Canonical samples are identical, and the earlier provisional ones are kept.
            let _ = fs::remove_file(&segment.path);
            return Ok(());
        }
        self.used_bytes += segment.bytes;
        if let Some(replaced) = class.insert(start, segment) {
            self.used_bytes -= replaced.bytes;
            let _ = fs::remove_file(replaced.path);
        }
        self.evict_over_limit(key, start, quality);
        Ok(())
    }

    /// Drops every segment of a source activation, for example when it is replaced.
    pub fn remove_source(&mut self, load_token: u64) {
        self.remove_keys(|key, _| key.load_token == load_token);
    }

    fn remove_keys(&mut self, mut matches: impl FnMut(&RenderKey, &KeySegments) -> bool) {
        let keys = self
            .entries
            .iter()
            .filter(|(key, segments)| matches(key, segments))
            .map(|(key, _)| key.clone())
            .collect::<Vec<_>>();
        for key in keys {
            if let Some(segments) = self.entries.remove(&key) {
                for segment in segments
                    .canonical
                    .into_values()
                    .chain(segments.provisional.into_values())
                {
                    self.used_bytes -= segment.bytes;
                    let _ = fs::remove_file(segment.path);
                }
            }
        }
    }

    /// Evicts least recently used segments until both budgets hold. Preview audio goes first, so
    /// auditioning drafts never evicts committed audio while preview audio remains.
    fn evict_over_limit(
        &mut self,
        kept_key: &RenderKey,
        kept_start: u64,
        kept_quality: PcmQuality,
    ) {
        loop {
            let over_limit = self.used_bytes > self.limit_bytes;
            if !over_limit && self.preview_bytes() <= self.preview_limit_bytes {
                return;
            }
            let oldest = |preview_only: bool| {
                self.entries
                    .iter()
                    .filter(|(_, segments)| !preview_only || segments.preview)
                    .flat_map(|(key, segments)| {
                        segments
                            .segments()
                            .map(move |(quality, start, segment)| (key, quality, start, segment))
                    })
                    .filter(|(key, quality, start, _)| {
                        !(*key == kept_key && *quality == kept_quality && *start == kept_start)
                    })
                    .min_by_key(|(_, _, _, segment)| segment.last_used)
                    .map(|(key, quality, start, _)| (key.clone(), quality, start))
            };
            let Some((key, quality, start)) =
                oldest(true).or_else(|| if over_limit { oldest(false) } else { None })
            else {
                return;
            };
            if let Some(segments) = self.entries.get_mut(&key) {
                if let Some(removed) = segments.class(quality).remove(&start) {
                    self.used_bytes -= removed.bytes;
                    let _ = fs::remove_file(removed.path);
                }
                if segments.canonical.is_empty() && segments.provisional.is_empty() {
                    self.entries.remove(&key);
                }
            }
        }
    }
}

impl Drop for PcmCache {
    fn drop(&mut self) {
        if let Some(directory) = &self.directory {
            let _ = fs::remove_dir_all(directory);
        }
    }
}

/// Writes a segment beside its final path and renames it into place once complete.
pub fn write_segment_file(path: &Path, samples: &[f32]) -> io::Result<()> {
    let partial = path.with_extension("partial");
    let result = (|| {
        let mut writer = BufWriter::new(File::create(&partial)?);
        for sample in samples {
            writer.write_all(&sample.to_le_bytes())?;
        }
        writer
            .into_inner()
            .map_err(|error| error.into_error())?
            .sync_all()?;
        fs::rename(&partial, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&partial);
    }
    result
}

/// Reads `output.len() / channels` frames starting `offset_frames` into a segment file.
pub fn read_segment_frames(
    path: &Path,
    offset_frames: u64,
    channels: u16,
    output: &mut [f32],
) -> io::Result<()> {
    let mut file = File::open(path)?;
    file.seek(SeekFrom::Start(
        offset_frames * u64::from(channels) * BYTES_PER_SAMPLE,
    ))?;
    let mut bytes = vec![0_u8; output.len() * BYTES_PER_SAMPLE as usize];
    file.read_exact(&mut bytes)?;
    for (sample, chunk) in output.iter_mut().zip(bytes.chunks_exact(4)) {
        *sample = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
    }
    Ok(())
}

fn covering(
    class: &mut BTreeMap<u64, Segment>,
    position: u64,
    clock: u64,
) -> Option<(u64, u64, PathBuf)> {
    let earliest = position.saturating_sub(MAX_SEGMENT_FRAMES - 1);
    let (start, segment) = class
        .range_mut(earliest..=position)
        .filter(|(start, segment)| **start + segment.frames > position)
        .max_by_key(|(start, segment)| **start + segment.frames)?;
    segment.last_used = clock;
    Some((*start, *start + segment.frames, segment.path.clone()))
}

fn next_start(class: &BTreeMap<u64, Segment>, position: u64) -> Option<u64> {
    class.range(position + 1..).next().map(|(start, _)| *start)
}

fn create_cache_directory() -> io::Result<PathBuf> {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let directory =
        std::env::temp_dir().join(format!("easytrim-pcm-{}-{unique}", std::process::id()));
    fs::create_dir(&directory)?;
    Ok(directory)
}

#[cfg(test)]
mod tests {
    use super::{
        CoveragePart, FrameRange, PcmCache, PcmQuality, RenderKey, read_segment_frames,
        write_segment_file,
    };

    fn key(graph: &str) -> RenderKey {
        RenderKey {
            load_token: 7,
            stream_index: 1,
            graph: graph.to_owned(),
            range: FrameRange {
                start: 0,
                end: 480_000,
            },
            channels: 2,
        }
    }

    fn store(cache: &mut PcmCache, key: &RenderKey, start: u64, frames: u64, quality: PcmQuality) {
        store_audio(cache, key, start, frames, quality, false);
    }

    fn store_audio(
        cache: &mut PcmCache,
        key: &RenderKey,
        start: u64,
        frames: u64,
        quality: PcmQuality,
        preview: bool,
    ) {
        let path = cache.reserve_file().unwrap();
        let samples = (0..frames * 2)
            .map(|index| (start * 2 + index) as f32)
            .collect::<Vec<_>>();
        write_segment_file(&path, &samples).unwrap();
        cache
            .commit(key, start, frames, quality, path, preview)
            .unwrap();
    }

    fn summary(parts: &[CoveragePart]) -> Vec<(u64, u64, Option<PcmQuality>)> {
        parts
            .iter()
            .map(|part| match part {
                CoveragePart::Cached {
                    start,
                    end,
                    quality,
                    ..
                } => (*start, *end, Some(*quality)),
                CoveragePart::Missing { start, end } => (*start, *end, None),
            })
            .collect()
    }

    #[test]
    fn plans_partial_coverage_by_exact_frame_index() {
        let mut cache = PcmCache::new(u64::MAX);
        let key = key("a");
        store(&mut cache, &key, 1_000, 500, PcmQuality::Canonical);
        store(&mut cache, &key, 2_000, 1_000, PcmQuality::Provisional);

        assert_eq!(
            summary(&cache.plan(&key, 900, 2_500)),
            [
                (900, 1_000, None),
                (1_000, 1_500, Some(PcmQuality::Canonical)),
                (1_500, 2_000, None),
                (2_000, 2_500, Some(PcmQuality::Provisional)),
            ]
        );

        let CoveragePart::Cached {
            path,
            segment_start,
            ..
        } = &cache.plan(&key, 1_200, 1_201)[0]
        else {
            panic!("frame 1200 is cached");
        };
        let mut frame = [0.0; 2];
        read_segment_frames(path, 1_200 - segment_start, 2, &mut frame).unwrap();
        assert_eq!(frame, [2_400.0, 2_401.0]);
    }

    #[test]
    fn canonical_samples_replace_and_take_precedence_over_provisional_ones() {
        let mut cache = PcmCache::new(u64::MAX);
        let key = key("a");
        store(&mut cache, &key, 0, 1_000, PcmQuality::Provisional);
        store(&mut cache, &key, 500, 1_000, PcmQuality::Provisional);
        store(&mut cache, &key, 0, 1_000, PcmQuality::Canonical);

        assert_eq!(
            summary(&cache.plan(&key, 0, 1_500)),
            [
                (0, 1_000, Some(PcmQuality::Canonical)),
                (1_000, 1_500, Some(PcmQuality::Provisional)),
            ]
        );
        // The provisional segment entirely inside the canonical one was dropped from storage.
        assert_eq!(cache.used_bytes(), 2 * 1_000 * 2 * 4);
    }

    #[test]
    fn keys_isolate_chains_ranges_and_layouts() {
        let mut cache = PcmCache::new(u64::MAX);
        store(&mut cache, &key("a"), 0, 100, PcmQuality::Canonical);
        let mut other_range = key("a");
        other_range.range.start = 6;
        let mut mono = key("a");
        mono.channels = 1;
        for other in [key("b"), other_range, mono] {
            assert_eq!(summary(&cache.plan(&other, 0, 100)), [(0, 100, None)]);
        }
    }

    #[test]
    fn evicts_least_recently_used_segments_to_stay_bounded() {
        let segment_bytes = 1_000 * 2 * 4;
        let mut cache = PcmCache::new(2 * segment_bytes);
        let key = key("a");
        store(&mut cache, &key, 0, 1_000, PcmQuality::Canonical);
        store(&mut cache, &key, 1_000, 1_000, PcmQuality::Canonical);
        cache.plan(&key, 0, 10);
        store(&mut cache, &key, 2_000, 1_000, PcmQuality::Canonical);

        assert_eq!(cache.used_bytes(), 2 * segment_bytes);
        assert_eq!(
            summary(&cache.plan(&key, 0, 3_000)),
            [
                (0, 1_000, Some(PcmQuality::Canonical)),
                (1_000, 2_000, None),
                (2_000, 3_000, Some(PcmQuality::Canonical)),
            ]
        );
    }

    #[test]
    fn preview_audio_has_its_own_budget_and_is_evicted_before_committed_audio() {
        let segment_bytes = 1_000 * 2 * 4;
        let mut cache = PcmCache::new(16 * segment_bytes);
        let committed = key("committed");
        store(&mut cache, &committed, 0, 1_000, PcmQuality::Canonical);
        for (index, graph) in ["draft-a", "draft-b", "draft-c"].into_iter().enumerate() {
            store_audio(
                &mut cache,
                &key(graph),
                index as u64 * 1_000,
                1_000,
                PcmQuality::Provisional,
                true,
            );
        }

        // Two segments fit the preview budget; the oldest draft went first, committed audio stayed.
        assert_eq!(cache.used_bytes(), 3 * segment_bytes);
        assert_eq!(
            summary(&cache.plan(&key("draft-a"), 0, 1_000)),
            [(0, 1_000, None)]
        );
        assert_eq!(
            summary(&cache.plan(&committed, 0, 1_000)),
            [(0, 1_000, Some(PcmQuality::Canonical))]
        );

        // Committed use of a draft key promotes it out of the preview budget.
        store_audio(
            &mut cache,
            &key("draft-c"),
            3_000,
            1_000,
            PcmQuality::Provisional,
            false,
        );
        cache.promote(&key("draft-b"));
        store_audio(
            &mut cache,
            &key("draft-d"),
            0,
            1_000,
            PcmQuality::Provisional,
            true,
        );
        cache.remove_preview(7, 1);
        assert_eq!(cache.used_bytes(), 4 * segment_bytes);
        assert_eq!(
            summary(&cache.plan(&key("draft-d"), 0, 1_000)),
            [(0, 1_000, None)]
        );
        assert_eq!(
            summary(&cache.plan(&key("draft-c"), 2_000, 4_000)),
            [
                (2_000, 3_000, Some(PcmQuality::Provisional)),
                (3_000, 4_000, Some(PcmQuality::Provisional)),
            ]
        );
    }

    #[test]
    fn rejects_incomplete_segment_files_and_releases_sources() {
        let mut cache = PcmCache::new(u64::MAX);
        let key = key("a");
        let path = cache.reserve_file().unwrap();
        write_segment_file(&path, &[0.0; 3]).unwrap();
        assert!(
            cache
                .commit(&key, 0, 2, PcmQuality::Canonical, path.clone(), false)
                .is_err()
        );
        assert!(!path.exists());

        store(&mut cache, &key, 0, 10, PcmQuality::Canonical);
        cache.remove_source(key.load_token);
        assert_eq!(cache.used_bytes(), 0);
        assert_eq!(summary(&cache.plan(&key, 0, 10)), [(0, 10, None)]);
    }
}
