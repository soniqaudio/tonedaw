! tone is still in very early development !

what is tone:

- tone is an open source, web based DAW inspired by fl studio, ableton and other daw's
  it runs fully in the browser and is based around 3 main modes 
  
  - pianoroll: a comprehensive and fully featured piano roll, including note edits, velocity, midi/computer keyboard, recording, copy/paste/cut and more 
  - playlist: the arrangement view for your beats and songs, this is where you lay out the individual patterns, audio files and structure your music
  - mixer: here you can manage the volume per track and eventually add various effects like reverb, eq and more 

  these 3 views wrap around the main ui, which has default daw controls like playback, recording, selecting a scale/key to work in, bpm, grid and more 

  the left panel has 2 functionalities: 
  - sound/drum presets: similar to your daw, you can use your own drum sounds and synth oneshots and organize them
  - ai features: at a later stage tone will have ai features like oneshot generation, chord progression generation and more built in 


what is soniqaudio:

- soniqaudio is the main brand behind tone and various other products, generally you can expect about anything in the audio/music/dev/ai space 
- the vision is to build a ecosystem around audio and music tools so that different tools can be used from other tools and be interchangeable


tech stack and architecture:

- built with next.js, typescript, tailwind and biome
- pnpm install / pnpm run dev to run the project locally
- web midi api and web audio api for midi/audio functionalities 
- hosted on vercel
- (future) backend on convex, elevenlabs for ai features, mediabunny for render/export, mintlify for docs 

- libraries we use:
  - tone: general audio processing and features
  - tonejs: midi keyboard support, recording, midi note events, pedal support, ...
  - soundfont-player: used for working with existing synth/sound libraries, currently only a realistic piano sound
  - zundo: undo/redo functionalities
  - zustand: global state management 
  - (soon) tonal: music theory logic 
  - (soon) mediabunny for audio rendering/exporting


  - roadmap (last update 13.11.2025):
   
  - extract audio engine and midi engine into independent repositories so all future projects can easily integrate them and everything is standardized
  - create good code, architecture and system design documentation
  - build comphrehensive mixer components and features
  - build comprehensive playlist components and features 
  - build comprehensive music theory features that integrate with midi deeply (also in a independent repository)
  - rework the ui/ux and design language 
  - implement ai features 
  - build a drumkit/sounds folder, syncing with local stored soundkits 
  - build comprehensive state management & sync engine
  - build a convex-based backend for project saving, cloud sync, authentication and more 
  - regular code checks, tests and refactoring opportunities
