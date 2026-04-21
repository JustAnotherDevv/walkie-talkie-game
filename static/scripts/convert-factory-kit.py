"""
Convert the Factory Modular Kit FBX into a compressed GLB for the web app.

Invoked headless by scripts/convert-factory-kit.sh via the Blender CLI.
Strategy: import the FBX, decimate meshes to reduce triangle count for a
browser build, drop unused materials, then export a Draco-compressed GLB
into public/models/factory_kit.glb.
"""

import os
import sys

import bpy

SRC_FBX = "../assets/Factory Modular Kit/source/Modular_factory_v1_0.fbx"
OUT_GLB = "public/models/factory_kit.glb"
TARGET_FACE_RATIO = 0.15  # Decimate to 15% of original triangle count.


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)
    for block in list(bpy.data.images):
        bpy.data.images.remove(block)


def import_fbx(path: str) -> None:
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    bpy.ops.import_scene.fbx(filepath=path)


def decimate_all_meshes(ratio: float) -> None:
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new(name="Decimate", type="DECIMATE")
        mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=mod.name)


def export_glb(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # Draco compression is intentionally disabled — @react-three/drei's
    # useGLTF defaults to no Draco decoder, and forcing decoder download
    # from a CDN on the main thread can hang the tab on flaky networks.
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_draco_mesh_compression_enable=False,
        export_apply=True,
        export_texture_dir="",
        export_image_format="AUTO",
    )


def main() -> int:
    # Resolve paths relative to the static/ directory (the Blender CLI runs
    # with its current working directory honored).
    src = os.path.abspath(SRC_FBX)
    out = os.path.abspath(OUT_GLB)

    print(f"[convert-factory-kit] src={src}")
    print(f"[convert-factory-kit] out={out}")

    clear_scene()
    import_fbx(src)
    decimate_all_meshes(TARGET_FACE_RATIO)
    export_glb(out)
    print("[convert-factory-kit] done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
