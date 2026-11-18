from collections import defaultdict
from math import cos, sin, tau

import bpy
from mathutils import Vector


class Builder:
    """Batch repeated pieces by serviceable part, keeping editable polygon geometry."""
    def __init__(self, key):
        self.collection = bpy.data.collections.new(key)
        bpy.context.scene.collection.children.link(self.collection)
        self.root = bpy.data.objects.new(key, None)
        self.root.empty_display_size = 3
        self.collection.objects.link(self.root)
        self.parts = defaultdict(lambda: ([], [], [], []))

    def shell(self, name, vertices, faces, material, smooth=False):
        vs, fs, ms, ss = self.parts[name]
        offset = len(vs)
        vs.extend(tuple(v) for v in vertices)
        for face in faces:
            fs.append(tuple(offset + i for i in face))
            ms.append(material)
            ss.append(smooth)

    def box(self, name, center, size, material, rz=0, bevel=0):
        a,b,c = (float(s)/2 for s in size)
        cut = min(bevel, min(a,b,c)*.8)
        vertices, lookup, faces = [], {}, []
        # Clip all twelve edges. Each broad panel retains a planar face, not a rounded pillow.
        dims = (a,b,c)
        from itertools import product
        for signs in product((-1,1), repeat=3):
            for normal in range(3):
                v = tuple(signs[i]*(dims[i]-(cut if i!=normal else 0)) for i in range(3))
                lookup[signs,normal]=len(vertices)
                vertices.append(Vector(v))
        def face(indices, normal):
            pts=[vertices[i] for i in indices]
            pivot=sum(pts,Vector())/len(pts)
            n=Vector(normal).normalized()
            u=(pts[0]-pivot).normalized()
            from math import atan2
            v=n.cross(u)
            faces.append(sorted(indices,key=lambda i:atan2((vertices[i]-pivot).dot(v),(vertices[i]-pivot).dot(u))))
        for dim in range(3):
            for side in (-1,1):
                normal=[0,0,0];normal[dim]=side
                face([i for (s,d),i in lookup.items() if s[dim]==side and d==dim],normal)
        if cut:
            for i,j in ((0,1),(0,2),(1,2)):
                for si,sj in product((-1,1), repeat=2):
                    normal=[0,0,0];normal[i]=si;normal[j]=sj
                    face([k for (s,d),k in lookup.items() if s[i]==si and s[j]==sj and d in (i,j)],normal)
            for s in product((-1,1), repeat=3):
                face([lookup[s,i] for i in range(3)],s)
        cx,cy,cz = center
        cr,sr = cos(rz),sin(rz)
        coords=[(cx+cr*x-sr*y,cy+sr*x+cr*y,cz+z) for x,y,z in vertices]
        self.shell(name,coords,faces,material)

    def rod(self,name,start,end,radius,material,sides=10):
        a,b = Vector(start),Vector(end)
        axis=(b-a).normalized()
        if not axis.length: return
        u=axis.orthogonal().normalized()*radius
        v=axis.cross(u)
        points=[p+u*cos(tau*i/sides)+v*sin(tau*i/sides) for p in (a,b) for i in range(sides)]
        faces=[(i,(i+1)%sides,sides+(i+1)%sides,sides+i) for i in range(sides)]
        self.shell(name,points,faces+[tuple(reversed(range(sides))),tuple(range(sides,2*sides))],material)

    def lathe(self,name,profile,material,center=(0,0,0),sides=64):
        cx,cy,cz=center
        points=[(cx+r*cos(tau*i/sides),cy+r*sin(tau*i/sides),cz+z) for r,z in profile for i in range(sides)]
        faces=[(k*sides+i,k*sides+(i+1)%sides,(k+1)*sides+(i+1)%sides,(k+1)*sides+i)
               for k in range(len(profile)-1) for i in range(sides)]
        self.shell(name,points,faces,material,True)

    def finish(self):
        for name,(vs,fs,ms,ss) in self.parts.items():
            mesh=bpy.data.meshes.new(name)
            mesh.from_pydata(vs,[],fs)
            slots={m:i for i,m in enumerate(dict.fromkeys(ms))}
            for m in slots:mesh.materials.append(bpy.data.materials[m])
            mesh.polygons.foreach_set("material_index",[slots[m] for m in ms])
            mesh.polygons.foreach_set("use_smooth",ss)
            mesh.validate()
            mesh.update()
            obj=bpy.data.objects.new(name,mesh)
            self.collection.objects.link(obj)
            obj.parent=self.root
        self.parts.clear()
