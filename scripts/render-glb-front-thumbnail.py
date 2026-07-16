#!/usr/bin/env python3
import argparse
import math
import os
import sys


def script_argv():
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1 :]
    return sys.argv[1:]


def parse_args():
    parser = argparse.ArgumentParser(description="Render a single front thumbnail PNG from a GLB.")
    parser.add_argument("--glb", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--resolution", type=int, default=512)
    parser.add_argument("--yaw", type=float, default=0.0)
    return parser.parse_args(script_argv())


def clear_scene(bpy):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_glb(bpy, filepath):
    old_names = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=filepath)
    return [obj for obj in bpy.data.objects if obj.name not in old_names]


def scene_mesh_bounds(objects):
    from mathutils import Vector

    min_co = Vector((float("inf"), float("inf"), float("inf")))
    max_co = Vector((float("-inf"), float("-inf"), float("-inf")))
    found = False
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            min_co.x = min(min_co.x, world.x)
            min_co.y = min(min_co.y, world.y)
            min_co.z = min(min_co.z, world.z)
            max_co.x = max(max_co.x, world.x)
            max_co.y = max(max_co.y, world.y)
            max_co.z = max(max_co.z, world.z)
            found = True
    return (min_co, max_co) if found else None


def normalize_model(bpy, imported, yaw_deg):
    from mathutils import Vector

    bounds = scene_mesh_bounds(imported)
    if not bounds:
        return
    min_co, max_co = bounds
    center = (min_co + max_co) * 0.5
    dims = max_co - min_co
    max_dim = max(dims.x, dims.y, dims.z, 0.001)
    scale = 4.2 / max_dim
    roots = [obj for obj in imported if obj.parent is None]
    for obj in roots:
        obj.location -= Vector((center.x, center.y, min_co.z))
        obj.scale = (obj.scale.x * scale, obj.scale.y * scale, obj.scale.z * scale)
        obj.rotation_mode = "XYZ"
        obj.rotation_euler.z += math.radians(yaw_deg)
    bpy.context.view_layer.update()


def look_at(obj, target):
    from mathutils import Vector

    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_camera_and_light(bpy, resolution):
    bpy.ops.object.light_add(type="AREA", location=(0.0, -4.0, 7.0))
    light = bpy.context.object
    light.name = "Thumbnail_Key_Light"
    light.data.energy = 520
    light.data.size = 5.0

    bpy.ops.object.camera_add(location=(5.2, -6.2, 4.6))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.clip_end = 200.0
    camera.data.ortho_scale = 4.6
    look_at(camera, (0.0, 0.0, 1.1))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    try:
        engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
        if "BLENDER_EEVEE_NEXT" in engines:
            scene.render.engine = "BLENDER_EEVEE_NEXT"
        elif "BLENDER_EEVEE" in engines:
            scene.render.engine = "BLENDER_EEVEE"
    except Exception:
        pass
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 15
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.world.color = (1.0, 1.0, 1.0)
    return camera


def fit_orthographic_camera_to_bounds(bpy, camera, objects, padding=1.08):
    from mathutils import Vector

    bounds = scene_mesh_bounds(objects)
    if not bounds:
        return
    min_co, max_co = bounds
    center = (min_co + max_co) * 0.5
    view_direction = Vector((5.2, -6.2, 4.6)).normalized()
    distance = 9.0
    camera.location = center + (view_direction * distance)
    look_at(camera, center)
    bpy.context.view_layer.update()

    camera_space = camera.matrix_world.inverted()
    xs = []
    ys = []
    for x in (min_co.x, max_co.x):
        for y in (min_co.y, max_co.y):
            for z in (min_co.z, max_co.z):
                point = camera_space @ Vector((x, y, z))
                xs.append(point.x)
                ys.append(point.y)
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    camera.data.ortho_scale = max(width, height, 0.01) * padding


def main():
    args = parse_args()
    import bpy

    clear_scene(bpy)
    imported = import_glb(bpy, args.glb)
    normalize_model(bpy, imported, args.yaw)
    camera = setup_camera_and_light(bpy, args.resolution)
    fit_orthographic_camera_to_bounds(bpy, camera, imported)
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    bpy.context.scene.render.filepath = args.output
    bpy.ops.render.render(write_still=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
