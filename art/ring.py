"""Odyssey's segmented habitation wheel and articulated photovoltaic blankets.

Distances are in the station's local metres. Z is the spin axis. This module
emits geometry through the shared Blender mesh builder in the active collection.
"""
from math import cos, pi, sin, tau


def polar(radius, angle, height):
    return (radius * cos(angle), radius * sin(angle), height)


def local(angle, radial, lateral, height):
    c, s = cos(angle), sin(angle)
    return (radial * c - lateral * s, radial * s + lateral * c, height)


def belt(b, name, profile, start, end, material, segments=4):
    """Sweep a closed (radius, height) section from start to end in azimuth."""
    width = len(profile)
    vertices = []
    faces = []
    for step in range(segments + 1):
        angle = start + (end - start) * step / segments
        vertices.extend(polar(radius, angle, height) for radius, height in profile)
        if step < segments:
            for idx in range(width):
                a = step * width + idx
                d = step * width + (idx + 1) % width
                faces.append((a, a + width, d + width, d))
    if end - start < tau - .00001:
        faces.append(tuple(range(width)))
        faces.append(tuple(reversed(range(segments * width, (segments + 1) * width))))
    b.shell(name, vertices, faces, material)


def band(b, name, inner, outer, bottom, top, start, end, material, segments=4):
    belt(b, name, ((inner, bottom), (outer, bottom), (outer, top), (inner, top)),
         start, end, material, segments)


def member(b, name, angle, begin, end, radius, material, sides=8):
    b.rod(name, local(angle, *begin), local(angle, *end), radius, material, sides)


def fit(b, name, angle, center, size, material, bevel=0):
    b.box(name, local(angle, *center), size, material, rz=angle, bevel=bevel)


def habitat(b):
    # Continuous dark pressure hull visible in the seams between removable shields.
    belt(b, 'Annulus pressure vessel',
         ((43.8, -2.2), (45, -3.25), (50.8, -3.25), (52.15, -1.7),
          (52.15, 1.55), (50.85, 3.15), (45.25, 3.15), (43.8, 1.95)),
         0, tau, 'slate', 160)
    lower = ((43.35, -2.08), (44.7, -3.68), (50.9, -3.68), (52.65, -2.05),
             (52.65, -.95), (52.26, -.72), (51.45, -1.32), (44.35, -1.32))
    upper = ((43.4, 1.45), (44.42, 1.05), (51.65, 1.05), (52.63, 1.28),
             (52.63, 2.0), (50.9, 3.72), (45.15, 3.72), (43.4, 2.32))
    pitch = tau / 16
    for sector in range(16):
        a = sector * pitch
        start, end = a - pitch / 2 + .0055, a + pitch / 2 - .0055
        # Paired roof plates leave an expansion joint at the centre of each sector.
        belt(b, 'Micrometeoroid keel shields', lower, start, end, 'chalk', 5)
        belt(b, 'Dorsal shield plates', upper, start, a - .002, 'ivory', 3)
        belt(b, 'Dorsal shield plates', upper, a + .002, end, 'ivory', 3)
        band(b, 'Panoramic glazing', 52.08, 52.29, -.72, 1.12, start + .007,
             end - .007, 'glass', 6)
        # Outer glazing has blind opaque bays, warm occupied rooms and cool-lit bays.
        for bay in range(7):
            w = (end - start - .028) / 7
            bay_start = start + .014 + w * bay
            bay_end = bay_start + w
            band(b, 'Window jambs', 52.13, 52.38, -.8, 1.18, bay_start,
                 bay_start + .0044, 'alloy', 1)
            if (bay + sector) % 5 in (1, 2, 4):
                band(b, 'Occupied window bays', 52.25, 52.32, -.22, .35,
                     bay_start + .008, bay_end - .005, 'warm', 2)
                band(b, 'Split transoms', 52.30, 52.36, -.10, -.04,
                     bay_start + .007, bay_end - .005, 'carbon', 2)
            elif bay == 5:
                band(b, 'Navigation repeaters', 52.26, 52.34, .40, .58,
                     bay_start + .014, bay_end - .007, 'teal', 1)
        band(b, 'Inner gallery windows', 43.68, 43.82, -.6, 1.1, start + .02,
             end - .02, 'glass', 6)
        for k in (1, 2, 3):
            wa = start + (end - start) * k / 4
            band(b, 'Inner gallery transoms', 43.6, 43.72, -.1, .38,
                 wa - .008, wa + .008, 'warm', 1)
        # Corrugated couplings show through between shielded sectors.
        seam = a + pitch / 2
        for line in (-.003, .003):
            belt(b, 'Bulkhead flanges', ((43.4, -2.1), (44.8, -3.48), (50.9, -3.48),
                 (52.48, -1.74), (52.48, 1.76), (50.8, 3.47), (45, 3.47),
                 (43.4, 2.07)), seam + line - .0015, seam + line + .0015, 'alloy', 1)
        for z in (-2.38, -2.83):
            band(b, 'Thermal return manifolds', 52.07, 52.51, z, z + .14,
                 start + .014, end - .014, 'copper', 6)
        # Slightly raised instrument housings break up the uniform shield silhouette.
        if sector % 4 == 1:
            # White type from the main scene goes on this black quadrantal plate.
            fit(b, 'Quadrant ID plates', a, (48, 0, 3.94), (2.60, 8.40, .42), 'carbon', .10)
            for side in (-1, 1):
                fit(b, 'ID plate registration bars', a, (48, side * 4.45, 3.92),
                    (2.57, .26, .31), 'orange')
        elif sector % 2 == 0:
            fit(b, 'Louver coamings', a, (48, -.45, 3.89), (3.68, 6.9, .44), 'slate', .14)
            for k in range(10):
                fit(b, 'Louver blades', a, (48, -3.16 + k * .60, 4.14),
                    (3.30, .26, .15), 'alloy')
        else:
            for dy in (-2.45, 2.45):
                fit(b, 'ECLSS chiller cassettes', a, (47.9, dy, 4.02),
                    (3.15, 3.85, .79), 'chalk', .20)
                fit(b, 'Chiller access panels', a, (47.8, dy, 4.45),
                    (1.9, 2.23, .11), 'slate')
                for dx in (-1.8, 1.8):
                    member(b, 'Chiller pipework', a, (47.9 + dx, dy - 1.5, 3.88),
                           (47.9 + dx, dy + 1.50, 3.88), .16, 'copper', 8)
        for offset in (-.131, .131):
            band(b, 'Roof panel edge clips', 45.48, 50.48, 3.70, 3.86,
                 a + offset - .002, a + offset + .002, 'slate', 1)
        # Eight outboard refuges alternate with the main transit and docking axes.
        if sector % 2 == 1:
            fit(b, 'Lifeboat cradles', a, (52.35, 0, -.78), (2.65, 5.95, 2.3), 'carbon', .36)
            fit(b, 'Emergency capsules', a, (53.15, 0, -.62), (2.45, 5.2, 2.15), 'orange', .48)
            for dy in (-1.52, 1.52):
                fit(b, 'Capsule restraints', a, (53.45, dy, -.57),
                    (2.08, .24, 2.28), 'slate', .10)
            fit(b, 'Capsule top hatches', a, (53.1, 0, .49), (1.25, 1.47, .13), 'ivory', .06)
    # A deeper secondary utility ring on diagonal A-frames gives the wheel a
    # distinctly different lower profile when the player orbits underneath.
    belt(b, 'Lower utility deck', ((38, -8.6), (38.6, -9.35), (40.8, -9.35),
         (41.65, -8.4), (41.65, -7.22), (40.8, -6.83), (38.5, -6.83),
         (38, -7.36)), 0, tau, 'slate', 128)
    band(b, 'Utility deck outer lip', 41.3, 41.75, -8.55, -8.18, 0, tau, 'ivory', 128)
    for n in range(32):
        a = tau * n / 32
        member(b, 'Utility deck inclined braces', a, (40, -1, -7.31), (45.7, -2.0, -2.80), .22, 'alloy')
        member(b, 'Utility deck inclined braces', a, (40, -1, -7.31), (46.4, 2.5, -2.80), .16, 'slate')
        band(b, 'Utility deck service apertures', 41.55, 41.73, -7.85, -7.56,
             a - .026, a + .026, 'teal' if n % 4 == 0 else 'glass', 2)


def solar(b):
    """Four gimballed double wings with folding spars and tiled cell blankets."""
    for arm in range(4):
        a = pi / 4 + arm * pi / 2
        member(b, 'Inboard trunnions', a, (47.7, 0, -2.3), (56, 0, -3.48), .76, 'alloy', 16)
        for side in (-1, 1):
            member(b, 'Truss main chords', a, (50.2, side*.83, -3.4), (90.6, side*.83, -3.4), .18, 'alloy')
        member(b, 'Truss lower chord', a, (50, 0, -5.1), (90.6, 0, -5.1), .16, 'slate')
        for k in range(10):
            x = 50.4 + k * 4
            for side in (-1, 1):
                member(b, 'Truss diagonal battens', a, (x, side*.83, -3.4), (x+2, 0, -5.1), .1, 'alloy')
                member(b, 'Truss diagonal battens', a, (x+2, 0, -5.1), (x+4, side*.83, -3.4), .1, 'alloy')
        for bank in range(3):
            x = 57.3 + bank * 13.2
            for side in (-1, 1):
                member(b, 'Wing gimbal shafts', a, (x, side*.58, -3.4), (x, side*3.25, -3.4), .58, 'slate', 16)
                member(b, 'Gimbal bearing collars', a, (x, side*2.42, -3.4), (x, side*2.77, -3.4), .77, 'gold', 16)
                tilt = (.155, .182, .21)[bank] * (1 if arm % 2 == 0 else -1)
                def point(u, v, z=0):
                    return local(a, x+u, side*(3.12 + v*cos(tilt) - z*sin(tilt)),
                                 -3.4 + v*sin(tilt) + z*cos(tilt))

                def plate(name, outline, height, depth, mat):
                    n = len(outline)
                    bottom = [point(u, v, height-depth) for u, v in outline]
                    top = [point(u, v, height) for u, v in outline]
                    fs = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
                    fs.extend((i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n))
                    if side < 0:
                        fs = [tuple(reversed(f)) for f in fs]
                    b.shell(name, bottom+top, fs, mat)

                span = (14.65, 17.1, 16.15)[bank]
                half = 6.32
                outline = [(-half+.54, 0), (half-.54, 0), (half, .54),
                           (half, span-.60), (half-.60, span), (-half+.60, span),
                           (-half, span-.60), (-half, .54)]
                plate('Blanket backing frames', outline, 0, .20, 'slate')
                # Three macro sections with generous fold seams and visible rear struts.
                for fold in range(3):
                    start = .42 + (span-.84)*fold/3
                    stop = .42 + (span-.84)*(fold+1)/3 - .14
                    b.rod('Blanket fold battens', point(-half+.22, start-.12, .05),
                          point(half-.22, start-.12, .05), .074, 'alloy', 6)
                    for ix in range(6):
                        u = -5.98 + ix*2.0
                        for iy in range(4):
                            dh = (stop - start)/4
                            v = start+iy*dh
                            corners = [(u+.075,v), (u+1.91,v), (u+1.965,v+.065),
                                       (u+1.965,v+dh-.08), (u+1.90,v+dh-.014),
                                       (u+.065,v+dh-.014), (u,v+dh-.079), (u,v+.075)]
                            face = list(range(len(corners)))
                            if side < 0:
                                face.reverse()
                            mat = 'cell2' if (ix+iy+fold+bank)%7 in (0, 3) else 'cell'
                            b.shell('Photovoltaic cell strings', [point(i,j,.041) for i,j in corners], [face], mat)
                    for edge in (-half+.10, half-.10):
                        b.rod('Peripheral conductor rails', point(edge,start,.065),
                              point(edge,stop,.065), .068, 'copper', 6)
                # Thin bottom skins cover the open backs of the textured laminates.
                for u in (-4.25, 4.25):
                    b.rod('Rear blanket ribs', point(u,.2,-.23), point(u,span-.2,-.23), .09, 'alloy', 6)
                    b.rod('Deployment stays', point(0,-.16,-.62), point(u,span*.55,-.30), .13, 'slate', 8)
                b.rod('Blanket leading tubes', point(-half+.56,span-.25,.02),
                      point(half-.56,span-.25,.02), .095, 'gold', 8)
