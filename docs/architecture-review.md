# Architecture Review - Tone DAW

Comprehensive architecture review, system design decisions, performance considerations, and scalability analysis.

---

## Executive Summary

The Tone DAW codebase demonstrates a solid foundation with clean separation of concerns, production-grade audio scheduling, and well-structured React components. However, several architectural decisions need to be made, and some critical issues require attention before scaling to a full-featured DAW.

**Key Strengths:**
- Clean state management with Zustand
- Production-grade audio scheduler
- Layered canvas rendering architecture
- Event-driven MIDI system

**Critical Areas for Improvement:**
- Component complexity (PianoRoll needs refactoring)
- Missing error boundaries
- No per-track audio routing yet
- Pattern system infrastructure exists but not fully implemented

---

## System Design Decisions Needed

### 1. Pattern System Architecture

**Current State:**
- Ghost notes infrastructure exists (can show notes from other patterns)
- Single pattern editing in piano roll
- No pattern store or pattern management UI

**Decision Required:**
- ✅ **FL Studio-style pattern system** (CONFIRMED)
  - Patterns are reusable MIDI sequences
  - Patterns can be placed multiple times in playlist
  - Each pattern belongs to a track
  - Patterns can be edited independently

**Implementation Plan:**
1. Create `usePatternStore` with pattern CRUD operations
2. Pattern structure:
   ```typescript
   interface Pattern {
     id: string;
     name: string;
     trackId: string;
     clips: MidiNoteClip[]; // MIDI clips in this pattern
     color: string;
     lengthBeats: number; // Pattern length
   }
   ```
3. Piano roll edits current pattern (activePatternId in UIStore)
4. Playlist clips reference patterns (not direct MIDI clips)
5. Ghost notes show other patterns' clips

**Challenges:**
- Pattern length management (variable-length patterns)
- Pattern versioning (undo/redo per pattern?)
- Pattern sharing between tracks (copy vs reference)

---

### 2. Per-Track Audio Routing

**Current State:**
- Single global soundfont piano (`audioEngine.instrument`)
- All MIDI clips play through same instrument
- `loadOneshotForTrack()` is stubbed
- `setTrackVolume()` affects master gain (not per-track)

**Decision Required:**
- ✅ **Per-track audio routing** (CONFIRMED)
  - Each track has independent instrument/sound
  - Tracks route to master bus
  - Support 15-20+ tracks simultaneously

**Implementation Plan:**

**Phase 1: Track Instrument System**
```typescript
interface TrackInstrument {
  trackId: string;
  type: 'soundfont' | 'oneshot' | 'tonejs-synth';
  soundId: string | null;
  audioBuffer?: AudioBuffer; // For oneshot samples
  instrument?: Player | Tone.Instrument; // Loaded instrument instance
}
```

**Phase 2: Audio Graph Architecture**
```
Track 1 → GainNode → Master Bus → Master Gain → Destination
Track 2 → GainNode → Master Bus → Master Gain → Destination
Track 3 → GainNode → Master Bus → Master Gain → Destination
...
```

**Phase 3: Audio Engine Refactor**
- Replace singleton `instrument` with `Map<trackId, Instrument>`
- Per-track gain nodes
- Master bus mixing
- Track mute/solo implementation

**Challenges:**
- AudioContext resource limits (max 32 AudioNodes per context)
- Memory management (unload unused instruments)
- Latency consistency across tracks
- Sample-accurate timing for multi-track playback

---

### 3. Backend Integration (Convex)

**Current State:**
- No backend integration
- No project persistence
- No user authentication
- All state is client-side only

**Decision Required:**
- ✅ **Convex for backend** (CONFIRMED)
  - Project saving/loading
  - User authentication
  - Cloud storage for audio samples
  - Real-time collaboration (future)

**Data Model Design:**

**Projects Table:**
```typescript
{
  _id: Id<"projects">;
  userId: Id<"users">;
  name: string;
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  createdAt: number;
  updatedAt: number;
}
```

**Patterns Table:**
```typescript
{
  _id: Id<"patterns">;
  projectId: Id<"projects">;
  trackId: string;
  name: string;
  clips: MidiNoteClip[];
  color: string;
  lengthBeats: number;
}
```

**Playlist Clips Table:**
```typescript
{
  _id: Id<"playlistClips">;
  projectId: Id<"projects">;
  patternId: Id<"patterns">;
  trackId: string;
  startMs: number;
  durationMs: number;
}
```

**Tracks Table:**
```typescript
{
  _id: Id<"tracks">;
  projectId: Id<"projects">;
  name: string;
  soundId: string | null;
  volume: number;
  muted: boolean;
  solo: boolean;
  color: string;
  order: number;
}
```

**Implementation Considerations:**
- Incremental saves (debounced, not every keystroke)
- Conflict resolution for concurrent edits
- Offline support (local-first architecture?)
- Audio sample storage (Convex file storage or separate CDN?)

---

### 4. Audio Export (mediabunny)

**Current State:**
- No export functionality
- No audio rendering pipeline

**Decision Required:**
- ✅ **mediabunny for audio export** (CONFIRMED)

**Implementation Plan:**
1. Render MIDI to audio:
   - Schedule all clips across timeline
   - Render each track independently
   - Mix tracks together
   - Apply master effects (if any)
   - Export to WAV/MP3

2. Render pipeline:
   ```
   MIDI Clips → Audio Engine → Per-Track Buffers → Mixer → Master Buffer → mediabunny → File
   ```

**Challenges:**
- Real-time vs offline rendering (offline for export)
- Memory management for long projects
- Sample rate conversion
- Format options (WAV, MP3, FLAC, etc.)

---

### 5. Error Handling Strategy

**Current State:**
- ❌ No error boundaries
- Errors can crash entire app
- No error recovery mechanisms

**Decision Required:**
- Implement React error boundaries
- Graceful degradation
- Error reporting (optional: Sentry integration)

**Implementation Plan:**
1. **App-level error boundary** - Catch all React errors
2. **Feature-level boundaries** - Piano roll, playlist, mixer
3. **Audio error handling** - Catch AudioContext errors, instrument loading failures
4. **MIDI error handling** - Invalid MIDI files, device errors

**Error Recovery:**
- Save state before operations that might fail
- Provide "retry" options
- Fallback to safe defaults

---

## Performance Considerations

### Current Performance Profile

**Strengths:**
- Look-ahead audio scheduler (26ms ticks, 180ms horizon)
- Viewport-based canvas rendering
- Memoized derived state
- Efficient MIDI event derivation

**Bottlenecks Identified:**

1. **Double `usePianoRollDerivedState()` Call**
   - Called twice per render (PianoRoll.tsx lines 62, 122)
   - Expensive computation (note mapping, clip filtering, grid calculations)
   - **Impact**: Unnecessary re-renders, wasted CPU cycles
   - **Fix**: Consolidate to single call, cache results

2. **Canvas Rendering**
   - Multiple canvas layers redraw on every scroll/zoom
   - No dirty region tracking
   - **Impact**: Frame drops during scrolling
   - **Fix**: Implement dirty region tracking, only redraw changed areas

3. **MIDI Event Derivation**
   - Full derivation on every event change
   - O(n) complexity for large projects
   - **Impact**: Lag with 1000+ clips
   - **Fix**: Incremental derivation, only derive changed sections

4. **Recording Preview Updates**
   - RAF loop updates preview clips every frame
   - State updates trigger re-renders
   - **Impact**: High CPU usage during recording
   - **Fix**: Throttle updates, batch state changes

### Optimization Strategies

**Short-term (High Impact, Low Effort):**
- Fix double hook call
- Add React.memo to canvas layers
- Throttle scroll handlers
- Debounce state updates

**Medium-term (High Impact, Medium Effort):**
- Implement dirty region tracking for canvas
- Incremental MIDI derivation
- Virtual scrolling for piano keys (if needed)
- Web Workers for MIDI processing (SON-39)

**Long-term (High Impact, High Effort):**
- OffscreenCanvas for rendering (SON-40)
- SharedArrayBuffer for audio (SON-41)
- WASM for DSP (SON-42)
- WebGL for canvas rendering (if needed)

### Performance Monitoring

**Metrics to Track:**
- Frame rate (target: 60fps)
- Audio latency (target: <20ms)
- Memory usage (target: <500MB for typical project)
- CPU usage (target: <50% on mid-range hardware)

**Implementation:**
- Performance monitoring system (SON-38)
- Real-time metrics dashboard (dev mode)
- Performance regression testing

---

## Scalability Concerns

### Current Limitations

**MIDI Clips:**
- No hard limits on clip count
- Derivation becomes slow with 1000+ clips
- **Solution**: Implement pagination/virtualization, incremental derivation

**Tracks:**
- Currently unlimited, but audio routing not implemented
- **Solution**: Per-track audio routing (SON-32), track limits (e.g., 64 tracks max)

**Patterns:**
- Not yet implemented
- **Solution**: Pattern system (SON-22), pattern limits per project

**Audio Samples:**
- No sample management yet
- **Solution**: Sample library system, compression, lazy loading

**Project Size:**
- No limits on project length
- **Solution**: Timeline limits (e.g., 1 hour max), project size warnings

### Scalability Architecture

**Client-Side:**
- Lazy loading of patterns/clips
- Virtual scrolling for long timelines
- Incremental state updates
- Memory-efficient audio buffers

**Server-Side (Convex):**
- Pagination for large projects
- Incremental sync (only changed data)
- Compression for stored data
- CDN for audio samples

**Real-time Collaboration (Future):**
- Operational transforms (OT) or CRDTs for conflict resolution
- Per-pattern locking
- Presence indicators
- Change notifications

---

## Integration Points

### Convex Integration

**When to Integrate:**
- Project saving/loading
- User authentication
- Audio sample storage
- Real-time collaboration (future)

**Integration Points:**
1. **Project Store** - Sync with Convex projects table
2. **Pattern Store** - Sync with Convex patterns table
3. **Track Store** - Sync with Convex tracks table
4. **User Store** - Authentication, user preferences
5. **File Storage** - Audio samples, exports

**Migration Strategy:**
- Start with read-only sync (load from Convex)
- Add write-back (save to Convex)
- Implement real-time updates (subscriptions)
- Add conflict resolution

### AI Features Integration

**Planned Features:**
- Sound generation (left panel "AI" tab)
- Chord progression generation
- Pattern suggestions

**Integration Points:**
1. **Sound Generation API** - Generate audio samples
2. **MIDI Generation API** - Generate chord progressions/patterns
3. **UI Integration** - Left panel AI tab
4. **Store Integration** - Add generated sounds to sound store

**Architecture:**
- API routes in Next.js (server-side)
- External AI service integration (ElevenLabs, etc.)
- Caching for generated content
- Rate limiting

### mediabunny Integration

**When to Integrate:**
- Audio export feature
- Project rendering

**Integration Points:**
1. **Export Service** - Render project to audio
2. **Format Conversion** - WAV, MP3, FLAC support
3. **UI Integration** - Export dialog, progress indicator
4. **Storage** - Save exports to Convex or download

**Architecture:**
- Server-side rendering (Next.js API route)
- Queue system for long renders
- Progress tracking
- Error handling

---

## Security Considerations

### Client-Side Security
- **MIDI File Validation** - Validate MIDI files before loading
- **Input Sanitization** - Sanitize user inputs (project names, etc.)
- **XSS Prevention** - React's built-in XSS protection
- **CSP Headers** - Content Security Policy for audio resources

### Server-Side Security (Convex)
- **Authentication** - User authentication required
- **Authorization** - Users can only access their projects
- **Rate Limiting** - Prevent abuse
- **Input Validation** - Validate all Convex mutations
- **File Upload Limits** - Limit audio file sizes

### Audio Security
- **AudioContext Policies** - Handle autoplay restrictions
- **MIDI Device Access** - Secure MIDI API usage
- **Sample Validation** - Validate audio samples before loading

---

## Testing Strategy

### Unit Tests
- Store actions (Zustand)
- MIDI derivation logic
- Audio engine functions
- Utility functions

### Integration Tests
- Piano roll interactions
- Recording flow
- Playback flow
- Pattern system (when implemented)

### E2E Tests
- Full project creation workflow
- Export workflow
- Save/load workflow

### Performance Tests
- Large project handling (1000+ clips)
- Multi-track playback
- Memory leak detection
- Frame rate monitoring

---

## Migration & Breaking Changes

### Planned Breaking Changes
- **Pattern System** - Will change clip structure
- **Per-Track Audio** - Will change audio engine API
- **Convex Integration** - Will require data migration

### Migration Strategy
- Version project files
- Migration scripts for old projects
- Backward compatibility where possible
- Clear upgrade path

---

## Recommendations

### Immediate Actions (This Sprint)
1. ✅ Fix double `usePianoRollDerivedState()` call
2. ✅ Add error boundaries
3. ✅ Fix ResizeObserver cleanup (verify)
4. ✅ Fix active notes cleanup (verify edge cases)
5. ✅ Extract magic numbers to constants

### Short-term (Next 2-3 Sprints)
1. Implement pattern system
2. Per-track audio routing
3. Playlist/Mixer real integration
4. Piano roll zoom
5. Cut tool

### Medium-term (Next Quarter)
1. Convex backend integration
2. Audio export (mediabunny)
3. Performance optimizations
4. Test coverage
5. Error handling improvements

### Long-term (Future)
1. Real-time collaboration
2. AI features
3. Advanced performance optimizations (Web Workers, WASM)
4. Mobile support (if needed)
5. Plugin system (if needed)

---

## Open Questions

1. **Offline Support**: Should projects work offline? (Local-first architecture?)
2. **Version Control**: Should projects have version history?
3. **Collaboration**: Real-time or async collaboration?
4. **Mobile**: Mobile app or mobile web?
5. **Plugins**: Plugin system for custom instruments/effects?
6. **VST Support**: Web-based VST support? (Very complex)
7. **MIDI Export**: Export to standard MIDI files?
8. **Project Templates**: Pre-made project templates?

---

## Conclusion

The Tone DAW architecture is solid but needs refinement in several areas. The most critical improvements are:

1. **Component refactoring** - Reduce complexity, improve maintainability
2. **Pattern system** - Core feature for FL Studio-style workflow
3. **Per-track audio** - Essential for multi-track production
4. **Error handling** - Prevent crashes, improve UX
5. **Performance** - Optimize for large projects

With these improvements, the DAW will be well-positioned for scaling to a full-featured production tool.

---

*Last Updated: Initial architecture review*
*Next Review: After pattern system implementation*

