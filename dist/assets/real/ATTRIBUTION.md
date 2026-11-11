# Planet and sky textures for ASTRA realism update

Solar System Scope / INOVE planetary texture pack
Source: https://www.solarsystemscope.com/textures/
License: Creative Commons Attribution 4.0 International
License URL: https://creativecommons.org/licenses/by/4.0/

Attribution to include in application credits / README:
“Planet and star textures: Solar System Scope (https://www.solarsystemscope.com/textures/), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Textures are mapped to 3D spheres and may be downsampled / color adjusted for this scene.”

The official source describes these as equirectangular real planetary maps based on NASA imagery and elevation data, with some missing regions filled and color/saturation adjustments. They are authored visualization textures, not unmodified instrument data.

Earth normal/specular maps are from the Three.js r160 examples repository:
https://github.com/mrdoob/three.js/tree/r160/examples/textures/planets
https://github.com/mrdoob/three.js/blob/r160/LICENSE
Keep the Three.js MIT notice already included in the project.

Files with -2k suffix are lighter web versions downloaded directly from the official source, not locally edited. Original 8k downloads are retained when available.

Suggested runtime policy:
- Earth day map: high resolution; use night/specular/normal maps at 2k.
- All other bodies: 2k to 4k, or lazy-load a higher resolution on approach.
- 8k RGB decoded texture + mipmaps can consume about 171 MiB GPU memory; avoid loading every 8k asset at native dimensions simultaneously.
- Saturn ring image is a horizontal radial strip with alpha: remap RingGeometry UV.x by normalized radius and use the RGBA map for transparency.
