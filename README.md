# Paper Crumple — React × Three.js × Houdini VAT

An interactive React application featuring 3D crumpled paper balls: click one to unfold it into a card facing the camera, drag to pick it up, and flick to toss it into the physics scene. The crumpling and unfolding animation is driven by a Houdini Vellum simulation baked as **VAT (Vertex Animation Textures)**, decoded and rendered in Three.js, with Cannon.js handling rigid-body physics.

## Features Ported & Preserved

- **Houdini VAT Playback**: Decodes FBX geometry and 32-bit floating point EXR displacement textures, with automatic motion delta trimming and point-averaged smooth normals.
- **Procedural Canvas Textures**: Custom grid paper with responsive hand-drawn typography (Caveat and Yomogi handwriting fonts), dynamic text measurement & line-wrapping, and vector SVG branding badges.
- **Interactive Physics**: Cannon.js simulation with realistic mass, restitution, friction, rolling resistance, boundary pulling, and velocity inertia when thrown.
- **Card State Machine**: Smooth transitions between folded paper balls, unfolding cards facing the camera, grabbed states, and tossing/discarding back into the scene.
- **Simulation GUI Controls**: Integrated Lil-GUI panel providing real-time tweaking of lighting (ambient, key light, fill light), screen-space ambient occlusion (SSAO), background and floor colors, animation speed, open frame, paper count, and camera settings.
- **React Architecture**: Fully encapsulated in a modular React + TypeScript architecture with Tailwind CSS styling and lifecycle management.

## Tech Stack

- **React 19**
- **Vite 6**
- **TypeScript 5**
- **Three.js & cannon-es**
- **lil-gui**
- **Tailwind CSS v4**

## Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```
