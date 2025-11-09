# System Design - Tone DAW

High-level system design document covering architecture patterns, design decisions, and system boundaries.

---

## System Overview

Tone DAW is a **client-side web application** with planned backend integration for persistence and collaboration. The system follows a **layered architecture** with clear separation between UI, state management, audio processing, and data persistence.

### Core Principles

1. **Client-First**: All audio processing happens in the browser
2. **Event-Driven**: MIDI events are the source of truth
3. **Reactive**: UI updates reactively based on state changes
4. **Modular**: Clear boundaries between features
5. **Performance-Critical**: Audio requires low-latency, real-time processing

---

## System Boundaries

### Client-Side (Browser)

**Responsibilities:**
- Audio synthesis and playback
- MIDI recording and editing
- UI rendering and interactions
- Real-time audio scheduling
- Local state management

**Technologies:**
- Next.js (React framework)
- Web Audio API (browser-native)
- Canvas API (piano roll rendering)
- Web MIDI API (MIDI device access)

**Constraints:**
- Browser security policies (autoplay, MIDI access)
- AudioContext limitations (32 AudioNodes per context)
- Memory limits (especially for audio buffers)
- Single-threaded JavaScript (main thread blocking)

### Server-Side (Convex)

**Responsibilities:**
- Project persistence
- User authentication
- Audio sample storage
- Real-time collaboration (future)
- Export job queuing (future)

**Technologies:**
- Convex (backend-as-a-service)
- File storage (Convex file storage or CDN)

**Constraints:**
- Rate limits
- File size limits
- Query/mutation limits

### External Services

**mediabunny (Audio Export)**
- Server-side audio rendering
- Format conversion (WAV, MP3, FLAC)
- Long-running export jobs

**AI Services (Future)**
- Sound generation
- Chord progression generation
- Pattern suggestions

---

## Architecture Patterns

### 1. Layered Architecture

```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│  (React Components, Canvas Layers) │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│        Application Layer           │
│    (Zustand Stores, Hooks)         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Domain Layer                │
│  (MIDI Logic, Audio Engine)         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Infrastructure Layer           │
│  (Web APIs, Convex Client)         │
└─────────────────────────────────────┘
```

### 2. Event-Driven Architecture

**MIDI Event Flow:**
```
MIDI Input → Domain Events → Derivation → Clips → UI
```

**Key Principle:** Events are immutable, clips are derived. This enables:
- Undo/redo (replay events)
- Time-travel debugging
- Event sourcing (future)

### 3. Observer Pattern

**State Management:**
- Zustand stores use observer pattern
- Components subscribe to store slices
- Automatic re-renders on state changes

**Audio Scheduling:**
- Playback controller observes transport state
- Schedules audio events based on playhead position

### 4. Singleton Pattern

**Audio Engine:**
- Single `audioEngine` instance
- Shared AudioContext
- Centralized audio resource management

**Playback Controller:**
- Single `playbackController` instance
- Manages playback state globally

### 5. Strategy Pattern

**Audio Instruments:**
- Different instrument types (soundfont, oneshot, synth)
- Strategy pattern for instrument loading/playback
- Future: Plugin system for custom instruments

---

## Data Models

### Core Entities

**MidiNoteClip**
```typescript
{
  id: string;
  noteNumber: number;      // 0-127
  noteName: string;        // "C4", "A#3", etc.
  channel: number;         // MIDI channel
  velocity: number;        // 0-127
  start: number;           // milliseconds
  duration: number;        // milliseconds
  trackId: string;         // Which track owns this clip
}
```

**Pattern** (Future)
```typescript
{
  id: string;
  name: string;
  trackId: string;
  clips: MidiNoteClip[];
  color: string;
  lengthBeats: number;
}
```

**Track**
```typescript
{
  id: string;
  name: string;
  soundId: string | null;
  volume: number;          // 0-1
  muted: boolean;
  solo: boolean;
  color: string;
  order: number;           // Display order
}
```

**Project** (Future)
```typescript
{
  id: string;
  userId: string;
  name: string;
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  patterns: Pattern[];
  playlistClips: PlaylistClip[];
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}
```

---

## State Management Strategy

### Store Organization

**Domain Stores** (Business Logic):
- `useMidiStore` - MIDI clips, events, recording
- `usePatternStore` - Patterns (future)
- `useTrackStore` - Track management
- `useSoundStore` - Sound library

**UI Stores** (Presentation):
- `useUIStore` - UI state (scroll, toggles)
- `useViewStore` - Active view
- `useMetronomeStore` - Metronome UI state

**Application Stores** (Orchestration):
- `useTransportStore` - Playback coordination
- `useMusicTheoryStore` - Tempo, scales

### State Synchronization

**Within Client:**
- Stores communicate via actions
- No direct store-to-store dependencies
- Components subscribe to multiple stores

**With Backend (Future):**
- Convex subscriptions for real-time sync
- Optimistic updates
- Conflict resolution

---

## Audio Processing Pipeline

### Current Pipeline (Single Track)

```
MIDI Clips
  ↓
Playback Controller (Scheduler)
  ↓
Audio Engine
  ↓
Soundfont Instrument
  ↓
Master Gain
  ↓
Audio Output
```

### Target Pipeline (Multi-Track)

```
MIDI Clips (per track)
  ↓
Playback Controller (Scheduler)
  ↓
Audio Engine
  ↓
Per-Track Instruments
  ↓
Per-Track Gain Nodes
  ↓
Mute/Solo Logic
  ↓
Master Bus (Summing)
  ↓
Master Gain
  ↓
Master Effects (Future)
  ↓
Audio Output
```

### Audio Scheduling

**Look-Ahead Scheduler:**
- 26ms tick interval
- 180ms scheduling horizon
- 20ms catch-up threshold
- Prevents audio dropouts
- Handles timing drift

**Scheduling Flow:**
```
1. Calculate current timeline position
2. Find clips in scheduling window
3. Convert MIDI clips to audio events
4. Schedule events with AudioContext
5. Repeat every 26ms
```

---

## Performance Considerations

### Critical Paths

1. **Audio Scheduling** - Must be real-time, low-latency
2. **Canvas Rendering** - Must maintain 60fps
3. **MIDI Derivation** - Must be fast for large projects
4. **State Updates** - Must not block main thread

### Optimization Strategies

**Audio:**
- Look-ahead scheduling (already implemented)
- Pre-allocated audio buffers
- Efficient note lookup (Map-based)

**Rendering:**
- Viewport-based rendering (only visible area)
- Canvas layer separation (independent updates)
- Memoization of expensive computations

**State:**
- Shallow selectors (prevent unnecessary re-renders)
- Batched updates (debounce/throttle)
- Incremental derivation (only derive changed sections)

**Future Optimizations:**
- Web Workers for MIDI processing
- OffscreenCanvas for rendering
- SharedArrayBuffer for audio
- WASM for DSP

---

## Security Model

### Client-Side Security

**Input Validation:**
- Validate MIDI files before loading
- Sanitize user inputs (project names, etc.)
- Validate audio samples

**XSS Prevention:**
- React's built-in XSS protection
- No `dangerouslySetInnerHTML` usage
- Content Security Policy headers

**MIDI Security:**
- User permission required for MIDI access
- Validate MIDI messages
- Rate limit MIDI input

### Server-Side Security (Convex)

**Authentication:**
- User authentication required
- JWT tokens
- Session management

**Authorization:**
- Users can only access their projects
- Project sharing (future) with explicit permissions
- Role-based access control

**Data Validation:**
- Validate all mutations
- Type checking
- Size limits (file uploads, project size)

---

## Scalability Limits

### Current Limits

**MIDI Clips:**
- No hard limit
- Performance degrades with 1000+ clips
- **Solution**: Virtualization, pagination

**Tracks:**
- No limit
- Audio routing not implemented yet
- **Solution**: Per-track routing, track limits (64 max)

**Project Length:**
- No limit
- Memory grows with project size
- **Solution**: Timeline limits (1 hour), compression

**Audio Samples:**
- No management yet
- Memory limited by browser
- **Solution**: Lazy loading, compression, streaming

### Scaling Strategies

**Horizontal Scaling:**
- Not applicable (client-side app)
- Backend (Convex) scales automatically

**Vertical Scaling:**
- Optimize algorithms
- Reduce memory footprint
- Improve rendering performance

**Caching:**
- Cache derived state
- Cache audio buffers
- Cache rendered canvas layers

---

## Error Handling Strategy

### Error Boundaries

**App-Level:**
- Catch all React errors
- Show error UI
- Log errors (optional: Sentry)

**Feature-Level:**
- Piano roll error boundary
- Playlist error boundary
- Mixer error boundary

**Audio Errors:**
- Catch AudioContext errors
- Handle instrument loading failures
- Graceful degradation

### Error Recovery

**State Recovery:**
- Save state before risky operations
- Rollback on error
- Provide retry options

**Audio Recovery:**
- Fallback to default instrument
- Continue playback on non-critical errors
- User notification for critical errors

---

## Testing Strategy

### Unit Tests

**Stores:**
- Test actions
- Test state updates
- Test selectors

**Domain Logic:**
- MIDI derivation
- Audio engine functions
- Utility functions

### Integration Tests

**Features:**
- Piano roll interactions
- Recording flow
- Playback flow
- Pattern system (when implemented)

### E2E Tests

**User Flows:**
- Create project
- Record MIDI
- Edit notes
- Export project
- Save/load project

### Performance Tests

**Metrics:**
- Frame rate (target: 60fps)
- Audio latency (target: <20ms)
- Memory usage (target: <500MB)
- CPU usage (target: <50%)

---

## Deployment Architecture

### Current Deployment

**Vercel:**
- Next.js app deployment
- Static assets (audio samples)
- Edge functions (if needed)

**No Backend:**
- Fully client-side
- No persistence

### Target Deployment

**Vercel (Frontend):**
- Next.js app
- Static assets
- API routes (for export, AI features)

**Convex (Backend):**
- Database
- Authentication
- File storage
- Real-time subscriptions

**CDN (Optional):**
- Audio sample library
- Large assets

---

## Monitoring & Observability

### Client-Side Monitoring

**Performance:**
- Frame rate monitoring
- Audio latency tracking
- Memory usage tracking
- CPU usage tracking

**Errors:**
- Error boundary logging
- Console error tracking
- User-reported errors

**Analytics:**
- Feature usage
- Performance metrics
- User behavior (optional)

### Server-Side Monitoring (Convex)

**Convex Built-in:**
- Query performance
- Mutation performance
- Error tracking
- Usage metrics

**Custom:**
- Export job monitoring
- File upload tracking
- User activity

---

## Future Considerations

### Real-Time Collaboration

**Architecture:**
- Operational Transforms (OT) or CRDTs
- Per-pattern locking
- Presence indicators
- Change notifications

**Challenges:**
- Conflict resolution
- Network latency
- State synchronization

### Mobile Support

**Considerations:**
- Touch interactions
- Smaller screen sizes
- Performance on mobile devices
- Mobile browser limitations

### Plugin System

**Architecture:**
- Plugin API
- Custom instruments
- Custom effects
- Sandboxed execution

**Challenges:**
- Security
- Performance
- API design

---

*Last Updated: Initial system design document*
*This document should be updated as the system evolves*

