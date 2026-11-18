"""Rebuild the EX-07 Blender master, game mesh and two orbital stills.

blender -b --factory-startup --python-exit-code 1 -P art/build_explorer.py -- OUTPUT_DIRECTORY
"""
from math import radians
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ART = Path(__file__).resolve().parent
ASSETS = ART.parent / 'dist' / 'assets'
OUT = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ART))
from mesh_builder import Builder
import explorer_body
import explorer_systems

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.name = 'EX-07 · Orbital reconnaissance'
scene.unit_settings.system = 'METRIC'

def linear(hexcode):
    values = [int(hexcode[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v < .04045 else ((v+.055)/1.055)**2.4 for v in values)+(1,)

# Coordinated with the station livery. Dielectrics retain broad highlights;
# polished edges, insulated pipes and heat-darkened alloy have narrower ones.
swatches = {
    'ivory': ('CBC9B8', .31, .38), 'chalk': ('ECEBDD', .25, .35),
    'carbon': ('272E36', .46, .46), 'slate': ('586773', .65, .33),
    'alloy': ('B2C1C8', .86, .24), 'copper': ('B77850', .76, .34),
    'gold': ('E1AB57', .72, .32), 'navy': ('253D52', .52, .33),
    'violet': ('514968', .72, .34), 'glass': ('193644', .37, .18),
    'canopy': ('618595', .15, .13), 'red': ('C94734', .32, .34),
    'orange': ('D77735', .31, .35), 'teal': ('7AD8E4', .26, .27),
    'warm': ('FFB866', .27, .27), 'engine': ('85E7FF', .25, .23),
    'cell': ('2B405C', .52, .29), 'cell2': ('35485C', .5, .31),
}
for key, (hexcode, metal, rough) in swatches.items():
    mat = bpy.data.materials.new(key)
    mat.use_nodes = True
    color = linear(hexcode)
    mat.diffuse_color = color
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = color
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if key == 'canopy':
        bs.inputs['Alpha'].default_value = .37
        bs.inputs['Coat Weight'].default_value = .6
        mat.diffuse_color = (*color[:3], .37)
    if key in ('teal', 'warm', 'engine'):
        bs.inputs['Emission Color'].default_value = color
        bs.inputs['Emission Strength'].default_value = 4 if key == 'engine' else 1.4
    if key in ('ivory','chalk','alloy','navy','slate','carbon'):
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        tex=nodes.new('ShaderNodeTexCoord')
        noise=nodes.new('ShaderNodeTexNoise')
        noise.label='Uneven ceramic and brushed finish'
        noise.inputs['Scale'].default_value=6
        links.new(tex.outputs['Object'],noise.inputs['Vector'])
        finish=nodes.new('ShaderNodeValToRGB')
        for stop,scale in zip(finish.color_ramp.elements,(.76,1.04)):
            stop.color=tuple(min(1,v*scale) for v in color[:3])+(1,)
        links.new(noise.outputs['Fac'],finish.inputs[0])
        links.new(finish.outputs[0],bs.inputs['Base Color'])
        micro=nodes.new('ShaderNodeTexNoise')
        micro.inputs['Scale'].default_value=155
        links.new(tex.outputs['Object'],micro.inputs['Vector'])
        bump=nodes.new('ShaderNodeBump')
        bump.inputs['Distance'].default_value=.0028
        bump.inputs['Strength'].default_value=.14
        links.new(micro.outputs['Fac'],bump.inputs['Height'])
        links.new(bump.outputs[0],bs.inputs['Normal'])

groups = []
for name, component in [('Airframe',explorer_body), ('Flight systems',explorer_systems)]:
    builder=Builder(name)
    component.build(builder)
    builder.finish()
    groups.append(builder)

def stencil(name, text, point, size, color):
    letters=bpy.data.curves.new(name,'FONT')
    letters.body=text
    letters.size=size
    letters.align_x=letters.align_y='CENTER'
    letters.materials.append(bpy.data.materials[color])
    obj=bpy.data.objects.new(name,letters)
    groups[0].collection.objects.link(obj)
    obj.parent=groups[0].root
    obj.location=point
    obj.rotation_euler.z=radians(180)

for side,label in [(-1,'ASTRA'),(1,'EX-07')]:
    pos=explorer_body.wingpoint(side,4.80,.52,lift=.020)
    stencil('Wing registration '+label,label,pos,.235,'navy')
    pos=explorer_body.wingpoint(side,4.80,.60,lift=.019)
    stencil('Wing inspection mark '+label,'ORBITAL SURVEY',pos,.066,'carbon')

rig = bpy.data.collections.new('Photography · orbital backdrop')
scene.collection.children.link(rig)
def point_at(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def camera(name, eye, target, focal):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    rig.objects.link(obj)
    obj.location = eye
    point_at(obj,target)
    data.lens = focal
    data.clip_end = 1500
    return obj

hero = camera('01 · Forward quarter', (13,18,10), (0,0,.05), 58)
aft = camera('02 · Engine and radiator detail', (-9,-14,6.8), (0,-1.25,.25), 47)
scene.camera = hero

def light(name, eye, color, energy, size, target=(0,0,0)):
    lamp = bpy.data.lights.new(name, 'AREA')
    lamp.energy, lamp.color, lamp.shape, lamp.size = energy, color, 'DISK', size
    obj = bpy.data.objects.new(name, lamp)
    rig.objects.link(obj)
    obj.location = eye
    point_at(obj,target)

light('Sunward soft edge', (-7,5,13), (1,.85,.68), 3950, 4)
light('Orbital blue reflection', (9,2,4), (.50,.71,1), 1400, 9)
light('Aft rim', (2,-10,8), (.79,.88,1), 2600, 6)
light('Lower return', (-4,-2,-6), (.38,.55,.84), 430, 8)

world = bpy.data.worlds.new('Starlight')
scene.world = world
world.use_nodes = True
nodes, links = world.node_tree.nodes, world.node_tree.links
bg = nodes.get('Background')
bg.inputs[0].default_value = (.22,.28,.39,1)
bg.inputs[1].default_value = .38
coords = nodes.new('ShaderNodeTexCoord')
stars = nodes.new('ShaderNodeTexVoronoi')
stars.inputs['Scale'].default_value = 180
links.new(coords.outputs['Generated'], stars.inputs['Vector'])
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = .029
ramp.color_ramp.elements[0].color = (.68,.77,.91,1)
ramp.color_ramp.elements[1].position = .085
ramp.color_ramp.elements[1].color = (.002,.004,.009,1)
links.new(stars.outputs['Distance'],ramp.inputs[0])
visible = nodes.new('ShaderNodeBackground')
links.new(ramp.outputs[0],visible.inputs[0])
split = nodes.new('ShaderNodeMixShader')
links.new(nodes.new('ShaderNodeLightPath').outputs['Is Camera Ray'],split.inputs[0])
links.new(bg.outputs[0],split.inputs[1])
links.new(visible.outputs[0],split.inputs[2])
links.new(split.outputs[0],nodes.get('World Output').inputs[0])

# The Earth belongs to the photographic set. Its imagery is packed in the
# editable master, and the selected-object export leaves it out of the ship.
q = hero.rotation_euler.to_quaternion()
center = hero.location + q @ Vector((-29,-107,-170))
bpy.ops.mesh.primitive_uv_sphere_add(segments=192,ring_count=96,radius=92,location=center)
earth=bpy.context.object
earth.name='Earth · blue limb'
earth.rotation_euler=(radians(24),radians(-16),radians(114))
for coll in list(earth.users_collection):
    coll.objects.unlink(earth)
rig.objects.link(earth)
for p in earth.data.polygons: p.use_smooth=True
surface=bpy.data.materials.new('Orbital Earth')
surface.use_nodes=True
n,l=surface.node_tree.nodes,surface.node_tree.links
day=n.new('ShaderNodeTexImage')
day.image=bpy.data.images.load(str(ASSETS/'real/earth-day.jpg'))
cloud=n.new('ShaderNodeTexImage')
cloud.image=bpy.data.images.load(str(ASSETS/'real/clouds.jpg'))
mix=n.new('ShaderNodeMixRGB')
mix.inputs[2].default_value=(.71,.80,.88,1)
l.new(cloud.outputs[0],mix.inputs[0])
l.new(day.outputs[0],mix.inputs[1])
limb=n.new('ShaderNodeLayerWeight')
edge=n.new('ShaderNodeValToRGB')
edge.color_ramp.elements[0].position=.015
edge.color_ramp.elements[0].color=(.09,.33,.51,1)
edge.color_ramp.elements[1].position=.27
edge.color_ramp.elements[1].color=(0,0,0,1)
l.new(limb.outputs['Fresnel'],edge.inputs[0])
edge.color_ramp.elements[0].position=.1
edge.color_ramp.elements[0].color=(0,0,0,1)
edge.color_ramp.elements[1].position=.82
edge.color_ramp.elements[1].color=(.13,.42,.75,1)
blend=n.new('ShaderNodeMixRGB')
blend.blend_type='ADD'
blend.inputs[0].default_value=1
l.new(mix.outputs[0],blend.inputs[1])
l.new(edge.outputs[0],blend.inputs[2])
bs=n.get('Principled BSDF')
l.new(blend.outputs[0],bs.inputs['Emission Color'])
bs.inputs['Emission Strength'].default_value=.62
bs.inputs['Base Color'].default_value=(.005,.01,.035,1)
earth.data.materials.append(surface)
earth.hide_set(True)
bpy.data.texts.new('Orbital image credits').write((ASSETS/'real/ATTRIBUTION.md').read_text('utf8'))
bpy.ops.file.pack_all()

scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y=1536,960
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath='//Explorer-EX07.png'
scene.view_settings.view_transform='AgX'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        space=area.spaces.active
        space.region_3d.view_rotation=hero.rotation_euler.to_quaternion()
        space.region_3d.view_location=(0,0,0)
        space.region_3d.view_distance=16
        space.shading.color_type='MATERIAL'
        space.shading.show_cavity=True
        space.overlay.show_overlays=False
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active=None
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Explorer-EX07.blend'),compress=True)

for cam, filename in [(hero,'Explorer-EX07.png'),(aft,'Explorer-Engines.png')]:
    scene.camera=cam
    scene.render.filepath=str(OUT/filename)
    bpy.ops.render.render(write_still=True)

# The interactive renderer supplies its own mip-filtered finish at this scale.
for key in swatches:
    material=bpy.data.materials[key]
    shader=material.node_tree.nodes.get('Principled BSDF')
    for socket in ('Base Color','Normal'):
        for link in list(shader.inputs[socket].links):
            material.node_tree.links.remove(link)
for builder in groups:
    objs=[obj for obj in builder.collection.objects if obj.type in ('MESH','FONT','CURVE')]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objs: obj.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    bpy.context.object.name=builder.root.name+' geometry'
bpy.ops.object.select_all(action='DESELECT')
for builder in groups:
    for obj in builder.collection.objects: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ASSETS/'explorer-ex07.glb'),export_format='GLB',
                          use_selection=True,export_yup=True,export_animations=False,
                          export_cameras=False,export_lights=False,export_texcoords=False)
