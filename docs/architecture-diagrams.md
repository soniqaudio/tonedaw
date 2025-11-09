# Architecture Diagrams - Tone DAW

Visual system architecture and data flow diagrams using Mermaid syntax. These diagrams render automatically in GitHub, VS Code (with Mermaid extension), and many markdown viewers.

---

## High-Level System Architecture

### Current Architecture (As-Is)

```mermaid
graph TB
    subgraph "Client (Browser)"
        subgraph "UI Layer"
            AppShell[AppShell]
            TopBar[TopBar]
            Sidebar[Sidebar]
            PianoRoll[PianoRoll]
            PlaylistView[PlaylistView - Mock]
            MixerView[MixerView - Mock]
        end
        
        subgraph "State Management (Zustand)"
            MidiStore[useMidiStore<br/>MIDI clips, events, recording]
            TransportStore[useTransportStore<br/>Playback state, playhead]
            TrackStore[useTrackStore<br/>Track management]
            UIStore[useUIStore<br/>UI state, scroll, toggles]
            SoundStore[useSoundStore<br/>Sound/instrument library]
            ViewStore[useViewStore<br/>Active view]
        end
        
        subgraph "Audio Engine"
            AudioEngine[audioEngine<br/>Singleton]
            PlaybackController[playbackController<br/>Scheduler]
            SoundfontPlayer[Soundfont Player<br/>Global Piano]
        end
        
        subgraph "MIDI System"
            MidiRecorder[useMidiRecorder<br/>MIDI input]
            MidiDerive[MIDI Derivation<br/>Events → Clips]
        end
    end
    
    subgraph "External"
        MIDIDevice[MIDI Devices<br/>Hardware/Software]
        AudioOutput[Audio Output<br/>Speakers/Headphones]
    end
    
    AppShell --> TopBar
    AppShell --> Sidebar
    AppShell --> PianoRoll
    AppShell --> PlaylistView
    AppShell --> MixerView
    
    PianoRoll --> MidiStore
    PianoRoll --> TransportStore
    PianoRoll --> TrackStore
    PianoRoll --> UIStore
    
    MidiStore --> MidiDerive
    MidiRecorder --> MidiStore
    MIDIDevice --> MidiRecorder
    
    PlaybackController --> AudioEngine
    AudioEngine --> SoundfontPlayer
    SoundfontPlayer --> AudioOutput
    
    TransportStore --> PlaybackController
    MidiStore --> PlaybackController
    
    style PlaylistView fill:#ff9999
    style MixerView fill:#ff9999
    style SoundfontPlayer fill:#99ff99
```

### Target Architecture (To-Be)

```mermaid
graph TB
    subgraph "Client (Browser)"
        subgraph "UI Layer"
            AppShell[AppShell]
            TopBar[TopBar]
            Sidebar[Sidebar<br/>Browser + AI]
            PianoRoll[PianoRoll]
            PlaylistView[PlaylistView<br/>Real Integration]
            MixerView[MixerView<br/>Real Integration]
        end
        
        subgraph "State Management (Zustand)"
            MidiStore[useMidiStore]
            TransportStore[useTransportStore]
            TrackStore[useTrackStore]
            PatternStore[usePatternStore<br/>NEW: Patterns]
            UIStore[useUIStore]
            SoundStore[useSoundStore]
            ViewStore[useViewStore]
        end
        
        subgraph "Audio Engine"
            AudioEngine[audioEngine<br/>Multi-Track]
            PlaybackController[playbackController]
            subgraph "Per-Track Instruments"
                Track1Inst[Track 1 Instrument]
                Track2Inst[Track 2 Instrument]
                TrackNInst[Track N Instrument]
            end
            MasterBus[Master Bus<br/>Mixing]
        end
        
        subgraph "MIDI System"
            MidiRecorder[useMidiRecorder]
            MidiDerive[MIDI Derivation]
        end
    end
    
    subgraph "Backend (Convex)"
        ConvexAPI[Convex API]
        ProjectsDB[(Projects)]
        PatternsDB[(Patterns)]
        TracksDB[(Tracks)]
        UsersDB[(Users)]
        FilesStorage[File Storage<br/>Audio Samples]
    end
    
    subgraph "Services"
        ExportService[mediabunny<br/>Audio Export]
        AIService[AI Services<br/>Sound/Chord Generation]
    end
    
    subgraph "External"
        MIDIDevice[MIDI Devices]
        AudioOutput[Audio Output]
    end
    
    AppShell --> PianoRoll
    AppShell --> PlaylistView
    AppShell --> MixerView
    
    PianoRoll --> PatternStore
    PlaylistView --> PatternStore
    PlaylistView --> TrackStore
    
    PatternStore --> ConvexAPI
    TrackStore --> ConvexAPI
    ConvexAPI --> ProjectsDB
    ConvexAPI --> PatternsDB
    ConvexAPI --> TracksDB
    ConvexAPI --> UsersDB
    ConvexAPI --> FilesStorage
    
    PlaybackController --> AudioEngine
    AudioEngine --> Track1Inst
    AudioEngine --> Track2Inst
    AudioEngine --> TrackNInst
    Track1Inst --> MasterBus
    Track2Inst --> MasterBus
    TrackNInst --> MasterBus
    MasterBus --> AudioOutput
    
    ExportService --> AudioEngine
    AIService --> SoundStore
    
    style PatternStore fill:#99ccff
    style ConvexAPI fill:#99ccff
    style ExportService fill:#99ccff
    style AIService fill:#99ccff
    style MasterBus fill:#99ff99
```

---

## Data Flow Architecture

### MIDI Event Flow (Recording → Playback)

```mermaid
sequenceDiagram
    participant User
    participant MIDIDevice
    participant MidiRecorder
    participant MidiStore
    participant MidiDerive
    participant PianoRoll
    participant PlaybackController
    participant AudioEngine
    
    User->>MIDIDevice: Play Note
    MIDIDevice->>MidiRecorder: MIDI Message
    MidiRecorder->>MidiStore: appendEvents(noteOn)
    MidiStore->>MidiDerive: deriveFromEvents()
    MidiDerive->>MidiStore: Update clips
    MidiStore->>PianoRoll: Re-render with new clip
    
    User->>MIDIDevice: Release Note
    MIDIDevice->>MidiRecorder: MIDI Message
    MidiRecorder->>MidiStore: appendEvents(noteOff)
    MidiStore->>MidiDerive: deriveFromEvents()
    MidiDerive->>MidiStore: Update clip duration
    MidiStore->>PianoRoll: Re-render updated clip
    
    User->>PlaybackController: Play
    PlaybackController->>MidiStore: Get clips
    MidiStore->>PlaybackController: Return clips
    PlaybackController->>AudioEngine: scheduleEvents()
    AudioEngine->>AudioEngine: Schedule notes
    AudioEngine->>User: Audio Output
```

### Pattern System Flow (FL Studio-style)

```mermaid
graph LR
    subgraph "Pattern Editing"
        PianoRoll[Piano Roll Editor]
        PatternStore[Pattern Store]
        ActivePattern[Active Pattern]
    end
    
    subgraph "Pattern Storage"
        Pattern1[Pattern 1<br/>Drums]
        Pattern2[Pattern 2<br/>Bass]
        Pattern3[Pattern 3<br/>Chords]
    end
    
    subgraph "Playlist Arrangement"
        PlaylistView[Playlist View]
        PlaylistClip1[Clip: Pattern 1 @ 0:00]
        PlaylistClip2[Clip: Pattern 1 @ 0:16]
        PlaylistClip3[Clip: Pattern 2 @ 0:00]
        PlaylistClip4[Clip: Pattern 3 @ 0:08]
    end
    
    subgraph "Playback"
        PlaybackController[Playback Controller]
        Timeline[Timeline: 0:00 - 0:32]
    end
    
    PianoRoll --> ActivePattern
    ActivePattern --> PatternStore
    PatternStore --> Pattern1
    PatternStore --> Pattern2
    PatternStore --> Pattern3
    
    PlaylistView --> PlaylistClip1
    PlaylistView --> PlaylistClip2
    PlaylistView --> PlaylistClip3
    PlaylistView --> PlaylistClip4
    
    PlaylistClip1 -.->|References| Pattern1
    PlaylistClip2 -.->|References| Pattern1
    PlaylistClip3 -.->|References| Pattern2
    PlaylistClip4 -.->|References| Pattern3
    
    PlaylistView --> PlaybackController
    PlaybackController --> Timeline
    Timeline --> Pattern1
    Timeline --> Pattern2
    Timeline --> Pattern3
```

---

## Component Architecture

### Piano Roll Component Structure

```mermaid
graph TB
    subgraph "PianoRoll Component"
        PianoRoll[PianoRoll<br/>Container]
        
        subgraph "Hooks"
            DerivedState[usePianoRollDerivedState<br/>Computed values]
            CanvasSize[useCanvasSize<br/>Viewport dimensions]
            ScrollSync[usePianoRollScrollSync<br/>Scroll management]
            Interactions[usePianoRollInteractions<br/>User interactions]
            KeyboardShortcuts[usePianoRollKeyboardShortcuts<br/>Keyboard handlers]
        end
        
        subgraph "Sub-Components"
            Timeline[Timeline<br/>Time ruler]
            PianoKeys[PianoKeys<br/>Note labels]
            VelocityLane[VelocityLane<br/>Velocity editor]
        end
        
        subgraph "Canvas Layers"
            StaticGrid[StaticGrid<br/>Background grid]
            NotesLayer[NotesLayer<br/>MIDI notes]
            GhostNotesLayer[GhostNotesLayer<br/>Reference notes]
            DynamicOverlay[DynamicOverlay<br/>Playhead, selection]
        end
    end
    
    subgraph "Stores"
        MidiStore[useMidiStore]
        TransportStore[useTransportStore]
        TrackStore[useTrackStore]
        UIStore[useUIStore]
    end
    
    PianoRoll --> DerivedState
    PianoRoll --> CanvasSize
    PianoRoll --> ScrollSync
    PianoRoll --> Interactions
    PianoRoll --> KeyboardShortcuts
    
    PianoRoll --> Timeline
    PianoRoll --> PianoKeys
    PianoRoll --> VelocityLane
    
    PianoRoll --> StaticGrid
    PianoRoll --> NotesLayer
    PianoRoll --> GhostNotesLayer
    PianoRoll --> DynamicOverlay
    
    DerivedState --> MidiStore
    DerivedState --> TransportStore
    DerivedState --> TrackStore
    DerivedState --> UIStore
    
    Interactions --> MidiStore
    Interactions --> TransportStore
```

---

## Audio Pipeline Architecture

### Current Audio Pipeline (Single Track)

```mermaid
graph LR
    subgraph "MIDI Source"
        Clips[MIDI Clips]
    end
    
    subgraph "Playback Controller"
        Scheduler[Look-ahead Scheduler<br/>26ms ticks, 180ms horizon]
        PrepareClips[prepareClipsForPlayback<br/>Sort & order clips]
    end
    
    subgraph "Audio Engine"
        AudioContext[AudioContext]
        MasterGain[Master Gain Node<br/>0.9]
        Instrument[Soundfont Instrument<br/>Global Piano]
    end
    
    subgraph "Output"
        Destination[Audio Destination<br/>Speakers/Headphones]
    end
    
    Clips --> PrepareClips
    PrepareClips --> Scheduler
    Scheduler --> AudioContext
    AudioContext --> Instrument
    Instrument --> MasterGain
    MasterGain --> Destination
```

### Target Audio Pipeline (Multi-Track)

```mermaid
graph TB
    subgraph "MIDI Sources"
        Track1Clips[Track 1 Clips]
        Track2Clips[Track 2 Clips]
        TrackNClips[Track N Clips]
    end
    
    subgraph "Playback Controller"
        Scheduler[Look-ahead Scheduler]
        PrepareClips[prepareClipsForPlayback<br/>Per-track]
    end
    
    subgraph "Audio Engine"
        AudioContext[AudioContext]
        
        subgraph "Track 1"
            Track1Inst[Instrument 1]
            Track1Gain[Gain Node]
            Track1Mute[Mute/Solo]
        end
        
        subgraph "Track 2"
            Track2Inst[Instrument 2]
            Track2Gain[Gain Node]
            Track2Mute[Mute/Solo]
        end
        
        subgraph "Track N"
            TrackNInst[Instrument N]
            TrackNGain[Gain Node]
            TrackNMute[Mute/Solo]
        end
        
        MasterBus[Master Bus<br/>Summing]
        MasterGain[Master Gain]
        MasterEffects[Master Effects<br/>Future]
    end
    
    subgraph "Output"
        Destination[Audio Destination]
    end
    
    Track1Clips --> PrepareClips
    Track2Clips --> PrepareClips
    TrackNClips --> PrepareClips
    
    PrepareClips --> Scheduler
    Scheduler --> AudioContext
    
    AudioContext --> Track1Inst
    AudioContext --> Track2Inst
    AudioContext --> TrackNInst
    
    Track1Inst --> Track1Gain
    Track2Inst --> Track2Gain
    TrackNInst --> TrackNGain
    
    Track1Gain --> Track1Mute
    Track2Gain --> Track2Mute
    TrackNGain --> TrackNMute
    
    Track1Mute --> MasterBus
    Track2Mute --> MasterBus
    TrackNMute --> MasterBus
    
    MasterBus --> MasterGain
    MasterGain --> MasterEffects
    MasterEffects --> Destination
```

---

## State Management Flow

### Zustand Store Relationships

```mermaid
graph TB
    subgraph "UI Stores"
        UIStore[useUIStore<br/>Scroll, toggles, grid resolution]
        ViewStore[useViewStore<br/>Active view: piano-roll/playlist/mixer]
    end
    
    subgraph "Domain Stores"
        MidiStore[useMidiStore<br/>MIDI clips, events, recording<br/>WITH UNDO/REDO]
        PatternStore[usePatternStore<br/>Patterns - FUTURE]
        TrackStore[useTrackStore<br/>Tracks, active track]
        SoundStore[useSoundStore<br/>Sound library]
        TransportStore[useTransportStore<br/>Playback state, playhead]
        MetronomeStore[useMetronomeStore<br/>Metronome state]
        MusicTheoryStore[useMusicTheoryStore<br/>Tempo, scales]
    end
    
    subgraph "Components"
        PianoRoll[PianoRoll]
        PlaylistView[PlaylistView]
        MixerView[MixerView]
        TopBar[TopBar]
    end
    
    PianoRoll --> MidiStore
    PianoRoll --> TransportStore
    PianoRoll --> TrackStore
    PianoRoll --> UIStore
    
    PlaylistView --> PatternStore
    PlaylistView --> TrackStore
    PlaylistView --> TransportStore
    
    MixerView --> TrackStore
    MixerView --> TransportStore
    
    TopBar --> TransportStore
    TopBar --> MetronomeStore
    TopBar --> MusicTheoryStore
    
    TrackStore --> SoundStore
    MidiStore --> TrackStore
    PatternStore --> MidiStore
```

---

## Backend Integration Flow

### Convex Integration Architecture

```mermaid
graph TB
    subgraph "Client (Browser)"
        subgraph "Stores"
            MidiStore[useMidiStore]
            PatternStore[usePatternStore]
            TrackStore[useTrackStore]
            ProjectStore[useProjectStore<br/>FUTURE]
        end
        
        ConvexClient[Convex Client<br/>React Hooks]
    end
    
    subgraph "Convex Backend"
        ConvexAPI[Convex API]
        
        subgraph "Database Tables"
            Projects[(Projects)]
            Patterns[(Patterns)]
            Tracks[(Tracks)]
            PlaylistClips[(Playlist Clips)]
            Users[(Users)]
        end
        
        subgraph "File Storage"
            AudioSamples[Audio Samples]
            Exports[Exported Projects]
        end
        
        subgraph "Functions"
            Queries[Queries<br/>Read data]
            Mutations[Mutations<br/>Write data]
            Actions[Actions<br/>External APIs]
        end
    end
    
    subgraph "External Services"
        AIService[AI Service<br/>Sound Generation]
        ExportService[mediabunny<br/>Audio Export]
    end
    
    MidiStore --> ConvexClient
    PatternStore --> ConvexClient
    TrackStore --> ConvexClient
    ProjectStore --> ConvexClient
    
    ConvexClient --> ConvexAPI
    
    ConvexAPI --> Queries
    ConvexAPI --> Mutations
    ConvexAPI --> Actions
    
    Queries --> Projects
    Queries --> Patterns
    Queries --> Tracks
    Queries --> PlaylistClips
    
    Mutations --> Projects
    Mutations --> Patterns
    Mutations --> Tracks
    Mutations --> PlaylistClips
    
    Actions --> AIService
    Actions --> ExportService
    
    Mutations --> AudioSamples
    Actions --> Exports
```

---

## User Interaction Flow

### Note Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant PianoRoll
    participant Interactions
    participant MidiStore
    participant AudioEngine
    participant PianoRollUI
    
    User->>PianoRoll: Click on grid
    PianoRoll->>Interactions: handleGridPointerDown()
    Interactions->>Interactions: createNoteAt(x, y)
    Interactions->>MidiStore: addClip(newClip)
    MidiStore->>MidiStore: Derive clips from events
    MidiStore->>PianoRollUI: Re-render with new clip
    PianoRollUI->>User: Show new note
    
    User->>PianoRoll: Drag note
    PianoRoll->>Interactions: handleGridPointerMove()
    Interactions->>MidiStore: updateClips([{id, start, noteNumber}])
    MidiStore->>MidiStore: Update events
    MidiStore->>MidiStore: Derive clips
    MidiStore->>PianoRollUI: Re-render moved clip
    
    User->>PianoRoll: Release note
    PianoRoll->>Interactions: handleGridPointerUp()
    Interactions->>MidiStore: Finalize update
```

### Recording Flow

```mermaid
sequenceDiagram
    participant User
    participant TopBar
    participant TransportStore
    participant MidiStore
    participant MidiRecorder
    participant MIDIDevice
    participant AudioEngine
    participant PianoRoll
    
    User->>TopBar: Click Record
    TopBar->>MidiStore: setRecording(true)
    TopBar->>TransportStore: beginPlayback()
    TransportStore->>AudioEngine: Start playback
    AudioEngine->>User: Audio output
    
    MIDIDevice->>MidiRecorder: MIDI Note On
    MidiRecorder->>MidiStore: beginRecordingPreview()
    MidiStore->>PianoRoll: Show preview clip
    
    loop While Recording
        TransportStore->>MidiStore: updateRecordingPreviews(currentMs)
        MidiStore->>PianoRoll: Update preview clip duration
    end
    
    MIDIDevice->>MidiRecorder: MIDI Note Off
    MidiRecorder->>MidiStore: endRecordingPreview()
    MidiRecorder->>MidiStore: appendEvents([noteOn, noteOff])
    MidiStore->>MidiStore: Derive clips
    MidiStore->>PianoRoll: Show final clip
    
    User->>TopBar: Click Stop
    TopBar->>MidiStore: setRecording(false)
    TopBar->>TransportStore: stop()
    TransportStore->>AudioEngine: Stop playback
    MidiStore->>MidiStore: Finalize clips from events
    MidiStore->>PianoRoll: Update with final clips
```

---

## Legend

- **Green boxes**: Implemented and working
- **Red boxes**: Mock/placeholder (not fully implemented)
- **Blue boxes**: Planned/future features
- **Dashed arrows**: References/relationships
- **Solid arrows**: Data flow/function calls

---

## How to View These Diagrams

### VS Code
1. Install "Markdown Preview Mermaid Support" extension
2. Open this file
3. Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows) to preview

### GitHub
- Diagrams render automatically in markdown files
- View directly in repository

### Online
- Copy Mermaid code blocks to [Mermaid Live Editor](https://mermaid.live/)
- Or use any Mermaid-compatible markdown viewer

---

*Last Updated: Initial architecture diagrams*
*Diagrams use Mermaid syntax - compatible with GitHub, VS Code, and most markdown viewers*

