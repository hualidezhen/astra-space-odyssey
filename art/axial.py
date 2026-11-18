"""Odyssey's axial pressure vessel, heat rejection system and tracking antennas.

Blender coordinates are in station units, with +Z toward the command bridge.
The parent builder assigns each assembly to its own collection.
"""

from math import cos, pi, sin, tau


def _point(angle, radius, tangent, height):
    """A point traced from a radial frame on the hull."""
    c, s = cos(angle), sin(angle)
    return (c * radius - s * tangent, s * radius + c * tangent, height)


def _prism(b, name, angle, radius, height, outline, thickness, material):
    """Extruded hatch or stiffener. Outline is CCW in tangent/height axes."""
    n = len(outline)
    verts = [_point(angle, r, t, height + z)
             for r in (radius, radius + thickness) for t, z in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces.extend((i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n))
    b.shell(name, verts, faces, material)


def _hatch(b, name, angle, radius, height, width, length, thickness, material, cut=.18):
    w, h = width * .5, length * .5
    k = min(cut, w * .8, h * .8)
    outline = [(-w + k, -h), (w - k, -h), (w, -h + k), (w, h - k),
               (w - k, h), (-w + k, h), (-w, h - k), (-w, -h + k)]
    _prism(b, name, angle, radius, height, outline, thickness, material)


def _box(b, name, a, r, t, z, radial, width, height, mat):
    b.box(name, _point(a, r, t, z), (radial, width, height), mat, rz=a)


def _wire(b, name, points, radius, material, sides=8):
    for start, end in zip(points, points[1:]):
        b.rod(name, start, end, radius, material, sides=sides)


def _collar(b, name, radius, height, width, depth, material, sides):
    r, h, z = radius, width * .5, height
    # The inner faces sit inside the vessel wall.
    profile = [(r - depth, z - h), (r - .09, z - h), (r, z - h * .47),
               (r, z + h * .47), (r - .09, z + h), (r - depth, z + h),
               (r - depth, z - h)]
    b.lathe(name, profile, material, sides=sides)


def core(b):
    b.lathe("Axial pressure hull",
            [(.01,-12),(4.85,-12),(5.9,-10.8),(5.9,-4.1),(7.45,-2.4),
             (7.45,2.1),(6.15,3.25),(6.15,9.5),(5.75,10.65),(5.75,23.15),
             (5.25,24.1),(4.28,30.7),(3.42,32.2),(2.80,35.5),(2.70,36.75),
             (.01,36.75)], "slate", sides=48)
    # Separable raised cladding leaves a gasket line around every hatch.
    for i in range(12):
        a = tau * (i + .5) / 12
        for j in range(3):
            metal = "chalk" if (i + j * 3) % 5 == 0 else "ivory"
            _hatch(b, "Pressure doors | lower barrel", a, 6.11, 4.24+j*2.16,
                   2.89,1.94,.18,metal)
        for j in range(2):
            z = 14.0 + 5.52*j
            _hatch(b,"Avionics bay | removable covers",a,5.70,z,
                   2.69,5.06,.24,"slate" if i%4==2 and j==0 else "ivory",.36)
            _box(b,"Avionics bay | latches",a,5.98,.88,z+1.55,.11,.17,.40,"carbon")
            _box(b,"Avionics bay | latches",a,5.98,-.88,z-1.55,.11,.17,.40,"carbon")
        if i%3 == 0:
            for t in (-.77,.77):
                _wire(b,"Service risers | thermal loop",
                      [_point(a,5.92,t,10.7),_point(a,6.45,t,11.35),
                       _point(a,6.45,t,21.7),_point(a,5.82,t,22.45)],
                      .14,"copper",10)
                for z in (12.0,15.5,19.0,21.25):
                    _box(b,"Pipe hangers",a,6.21,t,z,.62,.56,.24,"alloy")
        # Tangential rails on the vented underside of the main junction collar.
        for j in range(3):
            _box(b,"Collar vents",a,5.94,0,-8.65+j*.9,.32,2.15,.36,"alloy")
    for r,z,w,d,m in [(6.1,-11.1,.52,.60,"alloy"),(6.4,-3.95,.49,.64,"carbon"),
                       (7.85,-1.65,1.12,.64,"ivory"),(8.05,.6,.68,.74,"alloy"),
                       (6.58,3.12,.40,.68,"alloy"),(6.42,9.75,.36,.74,"carbon"),
                       (6.36,10.35,.58,.84,"alloy"),(6.05,22.75,.46,.58,"alloy")]:
        _collar(b,"Main junction | cast flanges",r,z,w,d,m,48)

    # Two sharply projecting decks frame a recessed polygonal bridge.
    b.lathe("Bridge | lower shield and soffit",
            [(5.02,23.52),(6.29,23.60),(7.42,24.54),(8.56,25.05),(8.94,25.29),
             (8.94,25.63),(8.51,25.79),(6.12,25.79),(5.02,25.59),(5.02,23.52)],
            "ivory",sides=16)
    b.lathe("Bridge | pressure glazing",
            [(5.15,25.53),(8.45,25.53),(8.09,27.78),(5.15,27.78),(5.15,25.53)],
            "glass",sides=16)
    b.lathe("Bridge | crown overhang",
            [(5.10,27.62),(8.62,27.62),(8.87,27.91),(8.64,28.27),
             (6.90,28.52),(5.90,29.88),(5.12,29.88),(5.10,27.62)],
            "chalk",sides=16)
    _collar(b,"Bridge | dark expansion joint",8.78,25.32,.16,.46,"carbon",16)
    for i in range(16):
        a = tau*i/16
        b.rod("Bridge | window mullions",_point(a,8.44,0,25.61),
              _point(a,8.11,0,27.67),.125,"alloy",sides=8)
        middle = a+pi/16
        b.rod("Bridge | intermediate mullions",_point(middle,8.29,0,25.68),
              _point(middle,7.99,0,27.7),.060,"carbon",sides=8)
        # Fine strips of cabin light along the bottom of occupied windows.
        if i not in (3,6,7,13):
            _box(b,"Bridge | cabin lighting",middle,8.26,.46,25.92,.09,.83,.10,"warm")
        b.rod("Bridge | cantilever braces",_point(middle,5.38,0,22.90),
              _point(middle,8.24,0,25.05),.17,"slate",sides=8)

    b.lathe("Cupola | octagonal drum",[(3.46,29.56),(5.06,29.56),(5.06,31.57),
            (4.5,32.1),(3.65,32.1),(3.46,29.56)],"ivory",sides=8)
    b.lathe("Cupola | inclined glazing",[(3.41,32.06),(4.48,32.06),
            (3.11,34.65),(2.28,34.65),(2.28,32.06)],"glass",sides=8)
    for i in range(8):
        a=tau*i/8
        b.rod("Cupola | sash",_point(a,4.47,0,32.05),_point(a,3.10,0,34.65),
              .105,"alloy",sides=8)
    _collar(b,"Cupola | top seal",3.18,34.65,.37,.54,"chalk",8)

    # A service pod and instrument locker break the rotational symmetry.
    for a,z,reach in ((-.65,15.1,7.0),(2.49,18.0,6.92)):
        for t in (-.78,.78):
            b.rod("EVA lockers | stand-offs",_point(a,5.74,t,z-2.7),
                  _point(a,reach,t,z-1.38),.15,"alloy",sides=8)
        _hatch(b,"EVA lockers | case",a,5.94,z,2.47,4.8,reach-5.94,"slate",.38)
        _hatch(b,"EVA lockers | outer covers",a,reach,z,2.10,4.48,.13,"chalk",.30)
        _box(b,"EVA lockers | ID stripe",a,reach+.16,0,z+1.3,.05,1.88,.35,"orange")
        for j in range(3):
            _box(b,"EVA lockers | louvers",a,reach+.21,0,z-1.11+j*.28,.08,1.2,.10,"carbon")

    # Tapered three-legged truss, complete with a compact sensor head and whip.
    b.lathe("Mast | swivel plinth",[(.01,36.52),(2.72,36.52),(2.72,37.25),
            (1.92,37.75),(1.65,38.0),(.01,38.0)],"alloy",sides=20)
    levels=[(1.55,37.85),(1.22,41.38),(.91,44.87),(.58,48.43),(.32,51.25)]
    for k,(r,z) in enumerate(levels[:-1]):
        rn,zn=levels[k+1]
        for i in range(3):
            a=tau*i/3
            p=_point(a,r,0,z)
            b.rod("Mast | longerons",p,_point(a,rn,0,zn),.123,"alloy",sides=8)
            b.rod("Mast | lattice web",p,_point(a+tau/3,rn,0,zn),.075,"slate",sides=6)
            b.rod("Mast | lattice web",p,_point(a+tau/3,r,0,z),.083,"slate",sides=6)
    b.rod("Mast | tracking whip",(0,0,51.14),(0,0,57.2),.095,"alloy",sides=10)
    b.rod("Mast | tip beacon",(0,0,56.93),(0,0,57.38),.19,"red",sides=10)
    for z,length in ((47.6,1.67),(50.0,1.1),(52.7,.76)):
        b.rod("Mast | dipoles",(-length,0,z),(length,0,z),.072,"alloy",sides=8)


def reactor(b):
    b.lathe("Reactor | segmented pressure vessel",[(.01,-35.25),(2.94,-35.25),
            (3.93,-33.45),(4.50,-29.5),(4.70,-22.0),(4.27,-18.4),
            (4.72,-16.30),(5.56,-14.60),(5.56,-12.13),(4.64,-11.85),
            (.01,-11.85)],"slate",sides=36)
    for r,z in ((3.67,-33.1),(4.22,-30.6),(4.48,-28.0),(4.53,-25.6),
                (4.69,-23.1),(4.56,-20.9),(4.42,-18.81)):
        _collar(b,"Reactor | coil retainers",r+.12,z,.66,.72,"alloy",36)
        _collar(b,"Reactor | heat exchangers",r+.07,z+.49,.16,.49,"copper",36)
    _collar(b,"Reactor | upper adapter flange",5.73,-13.40,.59,.76,"chalk",36)
    _collar(b,"Reactor | thrust plate",3.83,-33.76,.78,.60,"carbon",24)
    b.lathe("Reactor | lower service hatch",[(.01,-36.0),(2.08,-36.0),
            (2.95,-35.29),(2.95,-34.95),(.01,-34.95)],"alloy",sides=24)
    for i in range(8):
        a=tau*(i+.5)/8
        # A radiator has two fluted faces, a rigid perimeter and a supply loop.
        polygon=[(4.48,-29.56),(8.63,-30.93),(10.27,-29.78),(10.27,-19.75),
                 (8.87,-16.87),(5.03,-17.80)]
        # Polygon coordinates are (radius, height), so its CCW normal is -tangent.
        verts=[_point(a,r,t,z) for t in (.14,-.14) for r,z in polygon]
        n=len(polygon)
        faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
        faces += [(j,(j+1)%n,n+(j+1)%n,n+j) for j in range(n)]
        b.shell("Reactor | tapered radiator blades",verts,faces,"carbon")
        for j,(r,z) in enumerate(polygon):
            rn,zn=polygon[(j+1)%n]
            b.rod("Reactor | radiator frames",_point(a,r,0,z),_point(a,rn,0,zn),
                  .16,"alloy",sides=8)
        for t in (-.19,.19):
            for j in range(11):
                z=-29.10+j*.98
                _box(b,"Reactor | radiator channels",a,7.37,t,z,4.78,.11,.13,"slate")
        _wire(b,"Reactor | pumped heat loop",[_point(a,4.29,.45,-31.79),
              _point(a,6.18,.45,-29.25),_point(a,6.18,.45,-18.25),
              _point(a,5.11,.45,-15.38)],.17,"copper",10)
        b.rod("Reactor | shield supports",_point(a,5.29,0,-14.0),
              _point(a,8.82,0,-16.90),.20,"ivory",sides=8)


def _dish(b, bearing, elevation, radius, origin, number):
    s,c=sin(bearing),cos(bearing)
    pitch,level=sin(elevation),cos(elevation)
    u=(-s,c,0)
    v=(-pitch*c,-pitch*s,level)
    axis=(level*c,level*s,pitch)
    depth=radius*.26
    prefix=f"Antenna {number:02d} | "

    def xyz(x,y,z):
        return tuple(origin[j]+u[j]*x+v[j]*y+axis[j]*z for j in range(3))

    def surface(rad,theta,offset=0):
        return xyz(rad*cos(theta),rad*sin(theta),depth*(rad/radius)**2+offset)

    # The reflective faces have narrow true seams, with a continuous dark backing.
    segments=24
    for j in range(segments):
        left=tau*j/segments
        right=tau*(j+1)/segments
        # Rear skin is smooth and shallow; rim turns forward to the panel face.
        rings=[.015,.26,.50,.75,1.0]
        for rear in (False,True):
            start=left if rear else left+.008
            end=right if rear else right-.008
            verts=[surface(radius*r,t,-.115 if rear else 0) for r in rings
                   for t in (start,(start+end)*.5,end)]
            faces=[]
            for row in range(len(rings)-1):
                for col in range(2):
                    i=row*3+col
                    face=(i,i+3,i+4,i+1)
                    faces.append(tuple(reversed(face)) if rear else face)
            mat="slate" if rear else ("chalk" if j%6==0 else "ivory")
            b.shell(prefix+("rear shield" if rear else "reflector petals"),verts,faces,mat,True)
        b.rod(prefix+"rolled perimeter",surface(radius,left),surface(radius,right),
              .065*radius/4.9,"alloy",sides=8)
        if j%2==0:
            _wire(b,prefix+"rear radial ribs",[surface(radius*r,left,-.13) for r in rings],
                  .086*radius/4.9,"alloy",8)
    f=radius**2/(4*depth)
    b.rod(prefix+"hub motor",xyz(0,0,-.90),xyz(0,0,.16),radius*.195,"slate",sides=16)
    for j in range(3):
        ang=tau*(j+.25)/3
        b.rod(prefix+"feed tripod",surface(.89*radius,ang),
              xyz(.13*cos(ang),.13*sin(ang),f*.90),.068*radius/4.9,"alloy",sides=8)
    b.rod(prefix+"receiver",xyz(0,0,f*.86),xyz(0,0,f*.97),
          radius*.075,"gold",sides=16)
    b.rod(prefix+"feed horn",xyz(0,0,f*.84),xyz(0,0,f*.87),
          radius*.105,"carbon",sides=16)
    # Trunnions and yoke transmit the load from the dish back to its pedestal.
    base=(origin[0]-axis[0]*.95,origin[1]-axis[1]*.95,origin[2]-radius*.67)
    b.rod(prefix+"elevation axle",xyz(-radius*.36,0,-.44),xyz(radius*.36,0,-.44),
          radius*.095,"alloy",sides=12)
    for side in (-1,1):
        b.rod(prefix+"fork",base,xyz(side*radius*.36,0,-.44),
              radius*.095,"slate",sides=10)
    b.rod(prefix+"azimuth bearing",(base[0],base[1],base[2]-.40),base,
          radius*.28,"ivory",sides=20)
    return (base[0],base[1],base[2]-.37)


def comms(b):
    for index,(a,r,z,elevation) in enumerate(((-2.25,5.10,27.15,.96),
                                              (-.05,3.95,25.68,.58),
                                              (2.00,3.25,26.38,1.11))):
        origin=_point(a,12.77+index*.28,0,z)
        base=_dish(b,a+.36,elevation,r,origin,index+1)
        for t in (-.69,.69):
            p=_point(a,5.16,t,23.67)
            q=_point(a,5.42,t,20.48)
            b.rod("Tracking platforms | upper spars",p,base,.24,"slate",sides=10)
            b.rod("Tracking platforms | lower spars",q,base,.18,"alloy",sides=10)
            b.rod("Tracking platforms | bay diagonals",q,_point(a,9.25,0,23.17),
                  .12,"alloy",sides=8)
