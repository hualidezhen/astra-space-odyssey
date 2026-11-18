"""Transit tunnels, research capsules and capture berths. Blender coordinates, metres."""

from math import cos, pi, sin


class RadialFrame:
    """Build in a right-handed frame with X pointing away from the station hub."""

    def __init__(self, builder, bearing):
        self.b = builder
        self.bearing = bearing
        self.c = cos(bearing)
        self.s = sin(bearing)

    def point(self, r, t, z):
        return (self.c*r - self.s*t, self.s*r + self.c*t, z)

    def box(self, name, center, size, mat, bevel=0):
        self.b.box(name, self.point(*center), size, mat, rz=self.bearing, bevel=bevel)

    def rod(self, name, a, b, radius, mat, sides=8):
        self.b.rod(name, self.point(*a), self.point(*b), radius, mat, sides=sides)

    def loft(self, name, levels, cx, cz, mat, sides=24, hollow=False, phase=0):
        """Loft concentric elliptical sections along X, optionally closing a return profile."""
        vertices = []
        for r, width, height in levels:
            for j in range(sides):
                angle = phase + 2*pi*j/sides
                vertices.append(self.point(r, cx + width*cos(angle), cz + height*sin(angle)))
        faces = []
        n = len(levels)
        for k in range(n if hollow else n-1):
            a, b = k*sides, (k+1) % n*sides
            for j in range(sides):
                v = (j+1) % sides
                faces.append((a+j, a+v, b+v, b+j))
        if not hollow:
            faces.append(tuple(reversed(range(sides))))
            faces.append(tuple((n-1)*sides+j for j in range(sides)))
        self.b.shell(name, vertices, faces, mat)

    def collar(self, name, r, t, z, radius, width, wall, mat, sides=32):
        chamfer = min(width*.22, wall*.5)
        x0, x1 = r-width/2, r+width/2
        xr = [(x0, radius-chamfer), (x0+chamfer, radius),
              (x1-chamfer, radius), (x1, radius-chamfer),
              (x1, radius-wall), (x0, radius-wall)]
        self.loft(name, [(x, y, y) for x, y in xr], t, z, mat, sides, hollow=True)

    def panel(self, name, r0, r1, t, z, radius, a0, a1, mat, steps=4, depth=.045):
        """An arc of shielding. Its raised edge remains visible in oblique light."""
        verts = []
        for rad in (radius, radius+depth):
            for r in (r0,r1):
                for j in range(steps+1):
                    a = a0 + (a1-a0)*j/steps
                    verts.append(self.point(r,t+rad*cos(a),z+rad*sin(a)))
        k=steps+1
        faces=[]
        for j in range(steps):
            faces.extend([(2*k+j,2*k+j+1,3*k+j+1,3*k+j),
                          (j,k+j,k+j+1,j+1),(j,j+1,2*k+j+1,2*k+j),
                          (k+j,3*k+j,3*k+j+1,k+j+1)])
        faces.extend([(0,2*k,3*k,k),(k-1,2*k-1,4*k-1,3*k-1)])
        self.b.shell(name,verts,faces,mat)


def spokes(b):
    """Octagonal pressure tunnels inside a triangulated load-bearing frame."""
    for i in range(8):
        f=RadialFrame(b, i*pi/4)
        base=f'Transfer bridge {i+1:02d}'
        f.loft(base+' / pressure vessel',[(5.7,1.35,1.24),(6.3,1.52,1.36),
               (42.6,1.52,1.36),(44.6,1.35,1.24)],0,0,'slate',8,phase=pi/8)
        for j in range(8):
            r=7.0+4.55*j
            f.box(base+' / removable roof cassettes',(r+1.95,0,1.32),
                  (3.88,2.02,.23),'chalk' if j in (1,5) else 'ivory')
            for side in (-1,1):
                f.box(base+' / chord pads',(r,side*1.94,.95),(.70,.60,.32),'slate')
                z0,z1=(-1.45,.98) if j%2==0 else (.98,-1.45)
                f.rod(base+' / diagonal webs',(r,side*1.94,z0),
                      (r+4.55,side*1.94,z1),.115,'alloy',6)
        for side in (-1,1):
            for z in (-1.52,1):
                f.rod(base+' / longitudinal chords',(6.2,side*1.94,z),(44.7,side*1.94,z),
                      .16 if z<0 else .14,'alloy',8)
            f.rod(base+' / insulated mains',(7.0,side*1.37,-.95),(44.2,side*1.37,-.95),
                  .22,'copper' if side==1 else 'slate')
        for r in (6.6,16.1,25.2,34.3,43.4):
            for side in (-1,1):
                f.rod(base+' / ring frames',(r,side*1.94,-1.52),(r,side*1.94,1.02),.12,'slate')
            f.rod(base+' / ring frames',(r,-1.94,-1.52),(r,1.94,-1.52),.12,'slate')
        for r in (6.0,44.15):
            f.collar(base+' / pressure flanges',r,0,0,1.65,.48,.31,'alloy',16)
        for r in (12,24,36):
            f.box(base+' / service lighting',(r,1.04,1.48),(.8,.12,.09),'teal')


def labs(b):
    """Four shielded science cylinders with radial access, a rotating optical head and utility rails."""
    for i in range(4):
        f=RadialFrame(b,-pi/8+i*pi/2)
        base=f'Survey laboratory {i+1:02d}'
        z=3.5
        f.loft(base+' / pressure vessel',[(24.1,.88,.88),(24.5,1.55,1.55),(25.8,2.51,2.51),
               (26.6,2.79,2.79),(36.5,2.79,2.79),(37.3,2.63,2.63),
               (39,1.49,1.49),(39.5,1.26,1.26)],0,z,'slate',32)
        for section,(r0,r1) in enumerate(((26.7,29.8),(30,33.1),(33.3,36.35))):
            for k in range(8):
                angle=pi*k/4
                finish='chalk' if (section+k+i)%5==0 else 'ivory'
                # A glazed observation belt on the sunward shoulder of the central barrel.
                if section==1 and k in (1,2):
                    finish='glass'
                f.panel(base+' / Whipple panels',r0,r1,0,z,2.82,angle+.025,
                        angle+pi/4-.025,finish,steps=4,depth=.11)
        for r in (26.55,29.91,33.19,36.5):
            f.collar(base+' / restraint hoops',r,0,z,2.99,.19,.22,'alloy',32)
        for side in (-1,1):
            f.box(base+' / payload rail',(31.6,side*2.96,z-.3),(10.6,.40,.64),'alloy')
            for r in (28.1,35.2):
                f.box(base+' / sample carriers',(r,side*3.18,z-.30),(1.77,.60,1.12),'chalk')
            f.rod(base+' / coolant pipes',(26.7,side*2.48,z-1.72),(36.6,side*2.48,z-1.72),
                  .165,'copper')
        f.loft(base+' / optical head',[(23.0,.81,.81),(23.15,1.07,1.07),(24.18,1.12,1.12)],
               0,z,'carbon',24)
        f.collar(base+' / lens hood',23.05,0,z,1.08,.26,.18,'alloy',32)
        f.loft(base+' / objective',[(23.04,.84,.84),(23.16,.87,.87)],0,z,'glass',32)
        f.rod(base+' / access tunnel',(39.1,0,z),(45.6,0,.85),1.17,'ivory',16)
        for r in (39.3,40.7,42.1,43.5,44.9):
            h=z-(r-39.1)*2.65/6.5
            f.rod(base+' / tunnel coupling',(r-.15,0,h+.06),(r+.15,0,h-.06),1.27,'slate',16)
        f.box(base+' / flight recorder',(27.7,0,6.63),(1.47,1.09,.66),'orange')
        for side in (-1,1):
            f.box(base+' / telemetry strips',(35.1,side*1.28,6.1),(1.27,.16,.15),'warm')


def capture_port(f,base,end,z,primary):
    f.loft(base+' / transfer barrel',[(51.1,1.76,1.76),(52.1,2.20,2.20),
           (end-4.6,2.20,2.20),(end-4.2,2.42,2.42),(end-1.55,2.42,2.42)],
           0,z,'slate',32)
    for j in range(8):
        a=2*pi*j/8+.08
        f.panel(base+' / white barrel jackets',53.0,end-5.15,0,z,2.23,a,
                a+pi/4-.17,'ivory' if j%3 else 'chalk',steps=4,depth=.14)
    for r in (52.35,end-5.0,end-3.12):
        f.collar(base+' / coupling bands',r,0,z,2.51,.34,.32,'alloy')
    # Thick stepped collar with a recessed gasket. The central return section is truly open.
    f.loft(base+' / capture housing',[(end-3.50,2.35,2.35),(end-1.19,2.78,2.78),
           (end-.44,2.78,2.78),(end-.19,2.57,2.57),(end-.19,1.94,1.94),
           (end-.92,1.74,1.74),(end-3.50,1.74,1.74)],0,z,'carbon',48,hollow=True)
    f.collar(base+' / soft capture lip',end-.17,0,z,2.67,.26,.39,'alloy',48)
    f.collar(base+' / seal',end-.38,0,z,2.23,.18,.16,'copper',48)
    # Door sits within the throat, behind the game's actuated locking jaws.
    f.loft(base+' / pressure door',[(end-3.43,1.76,1.76),(end-3.12,1.76,1.76)],0,z,'ivory',32)
    f.box(base+' / hatch split',(end-3.08,0,z),(.065,.07,3.32),'carbon')
    for side in (-1,1):
        f.box(base+' / door glazing',(end-3.075,side*.68,z+.47),(.072,.75,.39),'glass')
        f.box(base+' / grab handles',(end-3.02,side*.90,z-.58),(.09,.60,.09),'orange')
    for j in range(12 if primary else 8):
        n=12 if primary else 8
        a=2*pi*j/n
        y=2.51*cos(a)
        h=z+2.51*sin(a)
        f.rod(base+' / face fasteners',(end-.10,y,h),(end+.018,y,h),.12,'slate',6)
        if j%2==0:
            a+=pi/n
            y=2.43*cos(a)
            h=z+2.43*sin(a)
            f.rod(base+' / capture guide lamps',(end-.12,y,h),(end-.025,y,h),
                  .104,'teal' if j%4==0 else 'warm',8)
        f.panel(base+' / painted safety index',end-1.21,end-.84,0,z,2.78,
                2*pi*j/n+.03,2*pi*j/n+.16,'orange',2)


def dock(b):
    """Four berth platforms; the starboard servicing crane identifies the active berth."""
    for i in range(4):
        f=RadialFrame(b,-pi/2+i*pi/2)
        primary=i==0
        end=68.0 if primary else 64.9
        z=2.0 if primary else 1.1
        base=f'Berth {i+1:02d}'
        capture_port(f,base,end,z,primary)
        f.box(base+' / cargo platform',((46+end-1)/2,0,-1.07),(end-47,7.1,.9),'slate')
        for side in (-1,1):
            f.rod(base+' / outboard chords',(46,side*3.6,-1.41),(end-.71,side*3.6,-1.41),.24,'alloy')
            for r in (49.1,53.2,57.3,61.4):
                f.box(base+' / service gratings',(r+1.27,side*2.89,-.44),(2.40,1.17,.29),'carbon')
                f.box(base+' / kerb lamps',(r+1.27,side*3.50,-.24),(.70,.13,.12),'teal')
                f.box(base+' / curb brackets',(r,side*3.51,-.47),(.37,.50,.51),'ivory')
            f.rod(base+' / underslung braces',(49,side*2.6,-3.87),(end-3.7,side*2.9,-1.37),
                  .25,'slate')
            f.rod(base+' / utility trunks',(51.5,side*3.20,-1.43),(end-2.7,side*3.20,-1.43),
                  .27,'copper')
        if primary:
            f.box(base+' / crane outrigger',(56.5,4.38,-.96),(3.2,4.6,.72),'ivory')
            f.rod(base+' / crane footing',(56.5,5.7,-.72),(56.5,5.7,.25),1.14,'carbon',16)
            f.rod(base+' / crane slew ring',(56.5,5.7,.19),(56.5,5.7,.53),.94,'orange',16)
            points=[(56.5,5.70,.55),(56.9,5.70,5.44),(62.45,5.36,6.26),(64.07,4.35,4.44)]
            for j,(a,c) in enumerate(zip(points,points[1:])):
                for side in (-1,1):
                    f.rod(base+' / crane box arm',(a[0],a[1]+side*.32,a[2]),
                          (c[0],c[1]+side*.32,c[2]),.34-j*.065,'ivory',6)
                f.rod(base+' / exposed actuator',(a[0]+.55,a[1],a[2]+.18),
                      (c[0]+.55,c[1],c[2]-.18),.13,'copper',8)
                f.rod(base+' / pivot',(c[0],c[1]-.66,c[2]),(c[0],c[1]+.66,c[2]),
                      .55-j*.09,'slate',16)
            for side in (-1,1):
                f.rod(base+' / service gripper',(64.07,4.35+side*.24,4.44),
                      (64.5,4.35+side*.36,3.80),.105,'gold')
