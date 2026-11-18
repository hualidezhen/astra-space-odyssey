"""Build the native Odyssey asset, the game GLB and the studio render with Blender.

blender -b --factory-startup -P art/build_station.py -- OUTPUT_DIRECTORY
"""
from collections import defaultdict
from math import cos, sin, tau, pi
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ART = Path(__file__).resolve().parent
sys.path.insert(0, str(ART))
import axial
import ring
import service

OUT = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
MODEL = ART.parent / "dist/assets/odyssey-station.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
bpy.context.preferences.filepaths.save_version = 0

# sRGB art-direction swatches, converted for the linear Principled shader.
PALETTE = {
    "ivory": ("D4D1BB", .33, .43), "chalk": ("EAE8D9", .22, .5),
    "slate": ("56626D", .68, .37), "carbon": ("252C34", .57, .43),
    "alloy": ("B0B6BC", .8, .29), "copper": ("AB7050", .75, .35),
    "gold": ("CB9B50", .72, .38), "glass": ("214858", .57, .16),
    "cell": ("253A60", .45, .33), "cell2": ("31486A", .53, .32),
    "teal": ("9AE5DE", .28, .24), "warm": ("F9D5A0", .23, .28),
    "red": ("D64232", .25, .39), "orange": ("C56631", .36, .41),
}

def linear(rgb):
    def channel(n):
        v = int(n, 16) / 255
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return tuple(channel(rgb[i:i+2]) for i in (0, 2, 4)) + (1,)

materials = {}
for key, (hexcode, metallic, roughness) in PALETTE.items():
    mat = bpy.data.materials.new(key)
    mat.diffuse_color = linear(hexcode)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = mat.diffuse_color
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = roughness
    if key in ("ivory", "chalk", "slate", "alloy", "carbon"):
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        coords = nodes.new('ShaderNodeTexCoord')
        texture = nodes.new('ShaderNodeTexNoise')
        texture.label = "Fine surface grain"
        texture.inputs["Scale"].default_value = 5.0
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .14
        bump.inputs['Distance'].default_value = .018
        links.new(coords.outputs['Object'], texture.inputs['Vector'])
        links.new(texture.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    if key in ("warm", "teal"):
        bs.inputs["Emission Color"].default_value = mat.diffuse_color
        bs.inputs["Emission Strength"].default_value = 1.8
    materials[key] = mat


class Builder:
    """Batch repeated pieces by serviceable part, keeping editable polygon geometry."""
    def __init__(self, key):
        self.collection = bpy.data.collections.new(key)
        scene.collection.children.link(self.collection)
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
            for m in slots:mesh.materials.append(materials[m])
            mesh.polygons.foreach_set("material_index",[slots[m] for m in ms])
            mesh.polygons.foreach_set("use_smooth",ss)
            mesh.validate()
            mesh.update()
            obj=bpy.data.objects.new(name,mesh)
            self.collection.objects.link(obj)
            obj.parent=self.root
        self.parts.clear()


builders={}
for key,func in (("core",axial.core),("habitat",ring.habitat),("spokes",service.spokes),
                 ("solar",ring.solar),("dock",service.dock),("reactor",axial.reactor),
                 ("labs",service.labs),("comms",axial.comms)):
    b=Builder(key);builders[key]=b;func(b);b.finish()

def lettering(name,text,r,angle,z,size):
    curve=bpy.data.curves.new(name,"FONT")
    curve.body=text
    curve.size=size
    curve.align_x='CENTER';curve.align_y='CENTER'
    curve.materials.append(materials["chalk"])
    obj=bpy.data.objects.new(name,curve)
    builders["habitat"].collection.objects.link(obj)
    obj.parent=builders["habitat"].root
    obj.location=(r*cos(angle),r*sin(angle),z)
    obj.rotation_euler.z=angle+pi/2
    return obj

for i,label in enumerate(("ODYSSEY","HAB  /  02","ODYSSEY","HAB  /  04")):
    lettering("Deck stencil "+str(i+1),label,48,pi/8+i*pi/2,4.18,1.5)

# Keep the studio rig out of the GLB and separate from the eight editable assemblies.
rig=bpy.data.collections.new("Studio · cameras and lights")
scene.collection.children.link(rig)
def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new("Hero camera")
camera=bpy.data.objects.new("Hero · transfer approach",camera_data)
rig.objects.link(camera)
camera.location=(131,-194,129)
aim(camera,(0,0,2))
camera_data.type='ORTHO';camera_data.ortho_scale=194;camera_data.clip_end=1000
scene.camera=camera
close_data=bpy.data.cameras.new("Berth 01 camera")
close=bpy.data.objects.new("Detail · approach to berth 01",close_data)
rig.objects.link(close)
close.location=(14,-94,12)
aim(close,(0,-53,3))
close_data.lens=42

def light(name,location,color,energy,size):
    data=bpy.data.lights.new(name,'AREA')
    data.shape='DISK';data.size=size;data.energy=energy;data.color=color
    obj=bpy.data.objects.new(name,data);rig.objects.link(obj)
    obj.location=location;aim(obj,(0,0,0))

light("Sunlit hull",(-85,-94,150),(1,.87,.72),930000,62)
light("Earth bounce",(40,65,95),(.55,.75,1),440000,100)
light("Starboard rim",(110,-45,16),(.76,.9,1),185000,75)
light("Lower service fill",(-20,-30,-80),(.42,.59,.85),140000,85)
world=bpy.data.worlds.new("Deep space studio")
scene.world=world;world.use_nodes=True
nodes=world.node_tree.nodes;links=world.node_tree.links
bg=nodes.get("Background");bg.inputs[0].default_value=(.25,.31,.39,1);bg.inputs[1].default_value=.45
back=nodes.new('ShaderNodeBackground');back.inputs[0].default_value=(.007,.013,.026,1)
mix=nodes.new('ShaderNodeMixShader');ray=nodes.new('ShaderNodeLightPath')
links.new(ray.outputs['Is Camera Ray'],mix.inputs[0]);links.new(bg.outputs[0],mix.inputs[1]);links.new(back.outputs[0],mix.inputs[2])
links.new(mix.outputs[0],nodes.get("World Output").inputs[0])
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath="//Odyssey-Station.png"
scene.view_settings.view_transform="AgX"
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        space=area.spaces.active
        space.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
        space.region_3d.view_distance=180;space.region_3d.view_location=(0,0,3)
        space.overlay.show_overlays=False;space.shading.color_type='MATERIAL';space.clip_end=2000

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"Odyssey-Station.blend"),compress=True)

# Render from the native objects to retain their local material coordinates.
scene.render.filepath=str(OUT/"Odyssey-Station.png")
bpy.ops.render.render(write_still=True)
scene.camera=close
scene.render.filepath=str(OUT/"Odyssey-Berth-01.png")
bpy.ops.render.render(write_still=True)
scene.camera=camera

# Merge for runtime after saving the fully editable source. Blender's glTF exporter
# then emits one mesh per module, with independent primitives for its materials.
for b in builders.values():
    bpy.ops.object.select_all(action='DESELECT')
    mesh_objects=[obj for obj in b.collection.objects if obj.type in ('MESH','FONT')]
    for obj in mesh_objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=mesh_objects[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name=b.root.name+" geometry"
bpy.ops.object.select_all(action='DESELECT')
for b in builders.values():
    for obj in b.collection.objects:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(MODEL),export_format='GLB',use_selection=True,
                          export_yup=True,export_texcoords=False,export_tangents=False,
                          export_animations=False,export_cameras=False,export_lights=False)
print("Runtime asset:",MODEL,MODEL.stat().st_size,flush=True)
