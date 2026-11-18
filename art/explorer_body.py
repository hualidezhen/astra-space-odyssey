"""EX-07 pressure hull and lifting surfaces. Blender coordinates are in metres."""
from math import cos, sin, sqrt, tau


# Y, half breadth, crown, keel. The canopy mates to the flat forward crown.
FRAMES = [
    (-4.45, .84, .30, -.46), (-4.1, 1.23, .54, -.66),
    (-3.1, 1.52, .76, -.75), (-1.0, 1.68, .85, -.79),
    (.35, 1.56, .69, -.79), (2.5, 1.27, .69, -.69),
    (3.9, .96, .54, -.55), (5.15, .62, .35, -.38),
    (6.46, .24, .17, -.16), (6.72, .13, .10, -.11),
]
SECTION = [(0,1),(.56,1),(.81,.79),(.98,.32),(1,-.06),(.77,-.76),
           (.34,-1),(-.34,-1),(-.77,-.76),(-1,-.06),(-.98,.32),
           (-.81,.79),(-.56,1)]


def interp(a,b,t):
    return tuple(p+(q-p)*t for p,q in zip(a,b))


def sample(table, coordinate):
    for lo,hi in zip(table,table[1:]):
        if coordinate<=hi[0]:
            return interp(lo,hi,(coordinate-lo[0])/(hi[0]-lo[0]))
    return table[-1]


def skin(y,facet,t,offset=0):
    _,width,top,keel=sample(FRAMES,y)
    x,z=interp(SECTION[facet],SECTION[(facet+1)%len(SECTION)],t)
    height=z*(top if z>=0 else -keel)
    return (x*(width+offset),y,height+offset*z)


def face(b,name,verts,mat,reverse=False):
    ids=list(range(len(verts)))
    b.shell(name,verts,[ids[::-1] if reverse else ids],mat)


def hull(b):
    count=len(SECTION)
    for y,name,reverse in ((FRAMES[0][0],"Aft firewall",True),(FRAMES[-1][0],"Forward coupler",False)):
        face(b,name,[skin(y,i,0) for i in range(count)],'slate',reverse)
    for k,(lo,hi) in enumerate(zip(FRAMES,FRAMES[1:])):
        for i in range(count):
            start,end=lo[0],hi[0]
            def strip(name,a,c,t0,t1,mat,raise_by=0):
                face(b,name,[skin(a,i,t0,raise_by),skin(a,i,t1,raise_by),
                             skin(c,i,t1,raise_by),skin(c,i,t0,raise_by)],mat)
            strip("Pressure vessel",start,end,0,1,'carbon')
            plate='ivory' if i in (0,1,2,10,11,12) else 'navy'
            if i in (3,9):plate='slate'
            if k==0:plate='slate'
            strip("Insulated hull skins",start+.014,end-.014,.012,.988,plate,.024)
            if i in (2,10) and 1<=k<=7:
                a,c=(.65,.86) if i==2 else (.14,.35)
                strip("Shoulder flight stripe",start+.016,end-.016,a,c,'orange',.033)
                strip("Shoulder stripe keyline",start+.016,end-.016,a-.045,a-.018,'carbon',.034)
            if i in (5,7) and k%2==0:
                strip("Keel wear strips",start+.06,end-.06,.39,.48,'alloy',.036)
    for s in (-1,1):
        # Equipment spines and segmented heat rejection shutters aft of the pilot.
        b.box("Cooling cassette",(s*.57,-2.16,.837),(.48,1.91,.11),'carbon',bevel=.04)
        for j in range(11):
            b.box("Cooling shutters",(s*.57,-2.98+j*.16,.901),(.412,.077,.038),'slate',bevel=.012)
        b.rod("Spine coolant lines",(s*.23,-3.1,.825),(s*.23,-1.11,.922),.044,'copper')
        b.rod("Engine bed diagonals",(s*1.15,-3.91,-.38),(s*2.18,-3.0,-.27),.15,'slate')
        b.rod("Engine bed diagonals",(s*1.27,-1.13,-.38),(s*2.18,-2.0,-.27),.14,'alloy')
    b.box("Dorsal avionics tray",(0,-.41,.80),(.69,.65,.14),'slate',bevel=.05)
    for x in (-.20,0,.20):
        b.box("Avionics status lamps",(x,-.63,.882),(.082,.055,.018),'teal',bevel=.005)


# Span station, leading edge Y, trailing edge Y, upper and lower skin heights.
WING = [(.85,3.18,-3.78,.40,-.29),(1.58,2.12,-3.94,.32,-.31),
        (2.38,.74,-3.94,.19,-.25),(3.17,.06,-3.62,.13,-.16),
        (5.43,-2.08,-3.64,.08,-.10),(5.94,-2.62,-3.43,.05,-.06)]


def wingpoint(s,x,t,upper=True,lift=0):
    _,lead,trail,top,bot=sample(WING,x)
    # Three chords form a faceted airfoil, tapering to both cutting edges.
    h=sample([(0,.08),(.23,1),(.68,.85),(1,.08)],t)[1]
    return (s*x,lead+(trail-lead)*t,(top if upper else bot)*h+lift)


def wingmark(b,s,name,coords,mat,raise_by=.015):
    face(b,name,[wingpoint(s,x,t,lift=raise_by) for x,t in coords],mat,s<0)


def wings(b,s):
    for i,(lo,hi) in enumerate(zip(WING,WING[1:])):
        a,c=lo[0],hi[0]
        for top in (True,False):
            for t,u in zip((0,.23,.68),(.23,.68,1)):
                # Ordering walks along the chord before walking outboard.
                coords=[(a,t),(a,u),(c,u),(c,t)]
                verts=[wingpoint(s,x,p,top) for x,p in coords]
                face(b,"Swept wing torsion box",verts,'navy' if top else 'carbon',(s<0)==top)
                if top:
                    margin=.012
                    wingmark(b,s,"Wing skin panels",[(a+margin,t+.007),(a+margin,u-.007),
                             (c-margin,u-.007),(c-margin,t+.007)],'ivory' if t!=.68 else 'slate',.007)
            for t in (0,1):
                if top:
                    face(b,"Wing edge web",[wingpoint(s,a,t),wingpoint(s,c,t),wingpoint(s,c,t,False),
                                           wingpoint(s,a,t,False)],'alloy',(s<0)!=(t==1))
    for t,u in zip((0,.23,.68),(.23,.68,1)):
        face(b,"Outer wing cap",[wingpoint(s,5.94,t),wingpoint(s,5.94,u),
                                wingpoint(s,5.94,u,False),wingpoint(s,5.94,t,False)],'slate',s<0)
    for lo,hi in ((3.18,5.41),(5.45,5.92)):
        for t,u,mat in ((.215,.245,'carbon'),(.249,.34,'orange'),(.344,.37,'chalk')):
            wingmark(b,s,"Search-and-rescue visibility band",[(lo,t),(lo,u),(hi,u),(hi,t)],mat,.024)
    # EX-07's serial number is formed from inlaid strokes on each inspection panel.
    segments=[((0,1),(1,1)),((1,1),(1,.5)),((1,.5),(1,0)),((0,0),(1,0)),
              ((0,.5),(0,0)),((0,1),(0,.5)),((0,.5),(1,.5))]
    for idx,strokes in enumerate(((0,1,2,3,4,5),(0,1,2))):
        for j in strokes:
            (x,y),(u,v)=segments[j]
            xa=3.45+.36*idx+.25*x
            xb=3.45+.36*idx+.25*u
            ta=.63-.205*y
            tb=.63-.205*v
            # Use metric stroke widths, accounting for local chord length.
            dx=xb-xa;dt=(tb-ta)*3
            length=sqrt(dx*dx+dt*dt)
            ux=-dt/length*.021;ut=dx/length*.007
            wingmark(b,s,"07 serial stencil",[(xa+ux,ta+ut),(xb+ux,tb+ut),
                                              (xb-ux,tb-ut),(xa-ux,ta-ut)],'navy',.033)


def fins(b,s):
    # Canted split empennage, silver leading cap and an inset orange tip.
    outline=[(2.91,-1.48,.10),(3.14,-3.14,1.62),(3.15,-3.76,1.46),(2.96,-3.48,.10)]
    def panel(name,outline,mat):
        outer=[(s*(x+.072),y,z) for x,y,z in outline]
        inner=[(s*(x-.072),y,z) for x,y,z in outline]
        faces=[(0,1,2,3),(7,6,5,4)]
        faces += [((j+1)%4,j,4+j,4+(j+1)%4) for j in range(4)]
        if s<0:faces=[tuple(reversed(f)) for f in faces]
        b.shell(name,outer+inner,faces,mat)
    panel("Canted stabilizer",outline,'navy')
    b.rod("Stabilizer leading edge",(s*2.91,-1.48,.10),(s*3.14,-3.14,1.62),.063,'alloy')
    for offset in (-.074,.074):
        a,c,d,e=outline
        stripe=[interp(a,c,.77),interp(a,c,.90),interp(e,d,.90),interp(e,d,.77)]
        face(b,"Tail recognition flash",[(s*(x+offset),y,z) for x,y,z in stripe],'orange',(s<0)!=(offset<0))


def service_panel(b, name, project, side, lid, sockets=False):
    # Local panel coordinates follow a single wing or fuselage skin facet. The
    # gasket, rebate and lid share clipped corners and separate height levels.
    def decal(label,coords,depth,material):
        face(b,name+" / "+label,[project(u,v,depth) for u,v in coords],material,side<0)

    for inset,lift,mat in ((0,.016,'carbon'),(.024,.025,'alloy'),(.051,.033,lid)):
        low,high=inset,1-inset
        cut=.106
        coords=[(low+cut,low),(high-cut,low),(high,low+cut),(high,high-cut),
                (high-cut,high),(low+cut,high),(low,high-cut),(low,low+cut)]
        decal("Recess and service lid",coords,lift,mat)
    for x in (.135,.865):
        for y in (.15,.85):
            rim=[(x+.042*cos(tau*k/8),y+.029*sin(tau*k/8)) for k in range(8)]
            decal("Captive fasteners",rim,.039,'alloy')
            decal("Quarter turn slots",[(x-.022,y-.006),(x+.022,y-.006),
                                       (x+.022,y+.006),(x-.022,y+.006)],.044,'carbon')
    if sockets:
        for y in (.30,.48,.66):
            decal("Sealed avionics sockets",[(.29,y-.047),(.56,y-.047),(.59,y),
                                            (.56,y+.047),(.29,y+.047),(.26,y)],.043,'carbon')
            decal("Socket identification tabs",[(.65,y-.022),(.75,y-.022),
                                               (.75,y+.022),(.65,y+.022)],.043,'gold')
    else:
        decal("Flush latch pocket",[(.34,.70),(.66,.70),(.66,.78),(.34,.78)],.042,'carbon')
        decal("Latch handle",[(.38,.725),(.62,.725),(.62,.747),(.38,.747)],.047,'alloy')


def inspection_fittings(b,side):
    for y0,y1 in ((-2.71,-1.66),(.66,1.34)):
        def shoulder(u,v,h):
            t=.09+.82*u
            return skin(y0+(y1-y0)*v,1 if side>0 else 11,t if side>0 else 1-t,.037+h)
        avionics=side<0 and y0<0
        service_panel(b,"Avionics umbilical" if avionics else "Shoulder access",
                      shoulder,side,'slate' if avionics else 'chalk',avionics)

    def wing(u,v,h):
        return wingpoint(side,4.43+.61*u,.643-.21*v,lift=.017+h)
    service_panel(b,"Wing feed disconnect",wing,side,'chalk')
    # High-visibility markings point to the feed lid and stay clear of its latch.
    for i in range(2):
        x=4.11+i*.13
        wingmark(b,side,"Feed isolation arrows",[(x,.481),(x,.522),(x+.095,.501)],'orange',.031)
    wingmark(b,side,"Maintenance walkway",[(3.26,.864),(3.26,.885),
             (5.11,.885),(5.22,.83),(5.22,.78),(5.19,.78),(5.19,.823),(5.10,.864)],'chalk',.026)


def build(b):
    hull(b)
    for side in (-1,1):
        wings(b,side)
        fins(b,side)
        inspection_fittings(b,side)
