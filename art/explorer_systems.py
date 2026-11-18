"""Serviceable propulsion, flight deck and docking equipment of the EX-07."""
from math import cos, pi, sin, tau


def axial_shell(b, name, x, z, profile, mat, start=0, span=tau, steps=64):
    """Sweep (longitudinal station, radius) around the Y axis."""
    pts = [(x+r*cos(start+span*i/steps), y, z+r*sin(start+span*i/steps))
           for y, r in profile for i in range(steps+1)]
    stride = steps+1
    faces = [(a, a+1, a+stride+1, a+stride)
             for k in range(len(profile)-1) for i in range(steps)
             for a in (k*stride+i,)]
    b.shell(name, pts, faces, mat, True)


def drive(b, x, side):
    prefix = 'Drive ' + side + ' / '
    z = -.15
    def sweep(part, profile, material, **kw):
        axial_shell(b, prefix+part, x, z, profile, material, **kw)

    sweep('pressure vessel', [(1.20, .055), (1.14, .29), (.80, .54),
          (.29,.68),(-.42,.745),(-2.36,.76),(-3.47,.65),(-3.76,.55)], 'carbon')
    for i in range(8):
        a=tau*i/8
        sweep('ceramic clamshell', [(1.17,.08),(.99,.43),(.45,.664),
              (-.37,.775),(-1.58,.784),(-1.64,.75)], 'ivory',
              start=a+.025, span=tau/8-.05, steps=8)
        sweep('aft heat shield', [(-1.69,.754),(-1.74,.785),(-2.45,.779),
              (-2.61,.732)], 'slate' if i%4==0 else 'alloy',
              start=a+.028, span=tau/8-.056, steps=8)
        for j in range(3):
            c, s = cos(a+j*.095), sin(a+j*.095)
            b.rod(prefix+'braided feed harness', (x+.745*c,-2.52,z+.745*s),
                  (x+.62*c,-3.50,z+.62*s), .024, 'copper', 8)
    for y, r in [(-.44,.787),(-2.65,.72),(-3.13,.692),(-3.5,.65)]:
        sweep('compression collars', [(y+.072,r-.035),(y+.047,r),(y-.047,r),
              (y-.072,r-.035)], 'alloy')
    sweep('bell heat jacket', [(-3.50,.53),(-3.69,.54),(-3.92,.44),
          (-4.28,.51),(-4.91,.719),(-5.01,.737),(-5.02,.686),
          (-4.55,.524),(-4.18,.371),(-3.96,.307)], 'carbon')
    for j in range(18):
        a=tau*j/18
        sweep('actuated expansion petals', [(-3.83,.48),(-4.04,.478),(-4.28,.56),
              (-4.86,.758),(-5.015,.749),(-5.02,.717)],
              'slate' if j%3==0 else 'alloy', start=a+.012, span=tau/18-.024, steps=3)
        c,s = cos(a+.13),sin(a+.13)
        b.rod(prefix+'petal actuators',(x+.64*c,-3.44,z+.64*s),
              (x+.515*c,-4.12,z+.515*s),.035,'copper',10)
    sweep('glowing throat liner', [(-4.02,.001),(-4.02,.296),(-4.16,.341),
          (-4.19,.338)], 'engine')
    for y,r in [(-4.34,.437),(-4.54,.506),(-4.80,.594)]:
        sweep('refractory liner ribs',[(y+.025,r+.018),(y,r),(y-.026,r+.026)],'copper')


def cabin(b):
    # Front and back tapered glass surround a real recessed flight deck.
    stations=[(.25,.16,.13),(.54,.51,.69),(1.04,.72,1.00),
              (1.61,.80,1.105),(2.18,.795,1.08),(2.72,.72,.92),
              (3.28,.55,.60),(3.75,.29,.23),(3.90,.055,.045)]
    def arch(section, a):
        y,w,h=section
        return w*cos(a), y, .70+h*sin(a)
    for i in range(len(stations)-1):
        for half in range(2):
            # Use one contiguous glass panel on each side of the overhead spine.
            points=[arch(st, pi*(half+k/12)/2) for st in stations[i:i+2] for k in range(13)]
            b.shell('Flight deck / laminated glazing', points,
                    [(k,13+k,14+k,k+1) for k in range(12)], 'canopy',True)
    for idx in (0,2,5,8):
        for j in range(24):
            b.rod('Flight deck / transverse canopy frame',arch(stations[idx],pi*j/24),
                  arch(stations[idx],pi*(j+1)/24),.033,'slate',8)
    for a in (0,pi/2,pi):
        for f,t in zip(stations,stations[1:]):
            b.rod('Flight deck / canopy rail',arch(f,a),arch(t,a),.035,'alloy',10)
    b.box('Flight deck / pilot pan',(0,1.56,.858),(.63,.73,.15),'carbon',bevel=.07)
    b.box('Flight deck / back cushion',(0,1.24,1.09),(.59,.20,.49),'navy',bevel=.075)
    b.box('Flight deck / head restraint',(0,1.235,1.38),(.41,.19,.20),'carbon',bevel=.055)
    for side in (-1,1):
        b.rod('Flight deck / shoulder harness',(side*.19,1.35,1.33),
              (side*.13,1.42,.936),.034,'orange',8)
        b.box('Flight deck / side console',(side*.425,1.87,.925),(.18,.94,.16),'carbon',bevel=.038)
        for j in range(4):
            b.box('Flight deck / console switches',(side*.42,1.60+j*.135,1.015),
                  (.072,.063,.025),'warm' if j==2 else 'alloy',bevel=.006)
    b.box('Flight deck / instrument binnacle',(0,2.46,1.015),(.82,.32,.29),'carbon',bevel=.047)
    for col in (-1,0,1):
        b.box('Flight deck / MFD display',(col*.245,2.288,1.045),(.205,.026,.13),
              'glass',bevel=.009)
        for row in range(3):
            b.box('Flight deck / illuminated readouts',(col*.245,2.271,1.014+.031*row),
                  (.12-row*.023,.008,.009),'teal')
    b.rod('Flight deck / control stick',(0,1.96,.87),(0,2.02,1.1),.027,'slate')


def build(b):
    cabin(b)
    for sign in (-1,1):
        drive(b, sign*2.2, 'port' if sign<0 else 'starboard')
        b.box('RCS / wingtip valve cassette',(sign*5.61,-2.96,0),(.43,.83,.35),'carbon',bevel=.072)
        for zsign in (-1,1):
            at=(sign*5.63,-2.99,zsign*.18)
            b.rod('RCS / ceramic outlet',at,(at[0],at[1],zsign*.215),.118,'alloy',20)
            b.rod('RCS / axial orifice',(at[0],at[1],zsign*.215),
                  (at[0],at[1],zsign*.221),.077,'carbon',20)
        b.rod('RCS / lateral outlet',(sign*5.79,-2.94,0),(sign*5.9,-2.94,0),.134,'slate',20)
        b.rod('RCS / lateral aperture',(sign*5.895,-2.94,0),(sign*5.905,-2.94,0),.083,'carbon',20)
    axial_shell(b,'Capture probe / telescoping body',0,0,
                [(7.15,.012),(7.135,.048),(7.09,.102),(7.01,.121),
                 (6.98,.087),(6.6,.087),(6.55,.17),(6.38,.19),(6.27,.30),(6.06,.31)],'alloy')
    for y in (6.72,6.83,6.93):
        axial_shell(b,'Capture probe / conductive bands',0,0,
                    [(y+.019,.089),(y+.011,.105),(y-.011,.105),(y-.019,.089)],'gold')
