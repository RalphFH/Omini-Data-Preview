"""
生成测试用例文件：.npy, .npz, .pkl, .hdf5
在 dataviewer conda 环境下运行:
  conda activate dataviewer
  python test/generate_samples.py
"""

import os
import numpy as np
import h5py
import pickle

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "samples")
os.makedirs(SAMPLES_DIR, exist_ok=True)


# === 1. .npy 文件 ===

# 1a. 一维 float64 数组
arr_1d = np.arange(0.0, 10.0, 0.5, dtype=np.float64)
np.save(os.path.join(SAMPLES_DIR, "array_1d_float64.npy"), arr_1d)

# 1b. 二维 int32 矩阵
arr_2d = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]], dtype=np.int32)
np.save(os.path.join(SAMPLES_DIR, "matrix_3x3_int32.npy"), arr_2d)

# 1c. 三维 float32（模拟小型图像 2x4x3）
arr_3d = np.random.rand(2, 4, 3).astype(np.float32)
np.save(os.path.join(SAMPLES_DIR, "tensor_2x4x3_float32.npy"), arr_3d)

print("[npy] 3 files generated")


# === 2. .npz 文件 ===

# 包含多个数组的压缩归档
np.savez(
    os.path.join(SAMPLES_DIR, "multi_arrays.npz"),
    x=np.linspace(0, 1, 50, dtype=np.float64),
    y=np.random.randint(0, 100, size=(5, 5), dtype=np.int32),
    labels=np.array([0, 1, 1, 0, 2], dtype=np.int64),
)

print("[npz] 1 file generated")


# === 3. .pkl 文件 ===

# 3a. 简单字典
data_dict = {
    "name": "test_experiment",
    "version": 2,
    "scores": [95.5, 88.3, 76.1, 92.0],
    "config": {
        "learning_rate": 0.001,
        "batch_size": 32,
        "epochs": 100,
    },
    "tags": ["train", "v2", "final"],
}
with open(os.path.join(SAMPLES_DIR, "config_dict.pkl"), "wb") as f:
    pickle.dump(data_dict, f, protocol=4)

# 3b. 嵌套列表
nested = [[1, 2, 3], [4, [5, 6]], {"a": 7, "b": [8, 9]}]
with open(os.path.join(SAMPLES_DIR, "nested_list.pkl"), "wb") as f:
    pickle.dump(nested, f, protocol=4)

print("[pkl] 2 files generated")


# === 4. .hdf5 文件 ===

with h5py.File(os.path.join(SAMPLES_DIR, "experiment.hdf5"), "w") as f:
    # 顶层数据集
    f.create_dataset("timestamps", data=np.arange(0, 100, dtype=np.float64))

    # 分组: train
    train = f.create_group("train")
    train.create_dataset("features", data=np.random.rand(10, 4).astype(np.float32))
    train.create_dataset("labels", data=np.array([0, 1, 1, 0, 2, 1, 0, 2, 1, 0], dtype=np.int32))

    # 分组: eval
    ev = f.create_group("eval")
    ev.create_dataset("features", data=np.random.rand(5, 4).astype(np.float32))
    ev.create_dataset("labels", data=np.array([1, 0, 2, 1, 0], dtype=np.int32))

print("[hdf5] 1 file generated")

print(f"\nAll samples saved to: {SAMPLES_DIR}")
for fname in sorted(os.listdir(SAMPLES_DIR)):
    fpath = os.path.join(SAMPLES_DIR, fname)
    size = os.path.getsize(fpath)
    print(f"  {fname:40s} {size:>8d} bytes")
