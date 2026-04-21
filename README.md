# Visionary

<div align="center">

<img width="140" height="96" alt="Logo_深色竖版英文" src="https://github.com/user-attachments/assets/2d2f2c37-9fd5-438a-bb42-8163b5f8aa7a" />

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![WebGPU](https://img.shields.io/badge/WebGPU-Ready-green?style=flat-square)](https://www.w3.org/TR/webgpu/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)

[English](README.md) | [中文](README-zh.md)

<h1 style="font-size:32px; margin: 6px 0 4px 0;">Visionary: The World Model Carrier Built on WebGPU-Powered Gaussian Splatting Platform</h1>
<p style="margin: 0 0 12px 0; font-size: 14px;">Shanghai AI Laboratory · Sichuan University · The University of Tokyo · Shanghai Jiao Tong University · Northwestern Polytechnical University</p>

 [Online Editor](https://visionary-laboratory.github.io/visionary/index_visionary.html) | [Project Page](https://visionary-laboratory.github.io/visionary/) | [Paper](https://arxiv.org/abs/2512.08478) | [Video](https://youtu.be/-K8EjMfk09c) | [WebGPU Issues](https://github.com/Visionary-Laboratory/visionary/issues/1) | [Document](https://ai4sports.opengvlab.com/help/index.html) 

</div>

---

> **TL;DR:** Visionary is an open, web-native platform built on WebGPU and ONNX Runtime. Enabling real-time rendering of diverse Gaussian Splatting variants (3DGS, MLP-based 3DGS, 4DGS, Neural Avatars and <span style="font-family: 'Brush Script MT', cursive; font-size: 1.2em; color: #FFD700; text-shadow: 1px 1px 2px black;">✨**any future algorithms**✨</span>), and traditional 3d Mesh, directly in the browser. We also support post-processing using feed-forward networks.

<details>
<summary><b>Abstract</b></summary>
Neural rendering, particularly 3D Gaussian Splatting (3DGS), has evolved rapidly and become a key component for building world models. In this work, we present Visionary, an open, web-native platform for real-time various Gaussian Splatting and meshes rendering. Built on an efficient WebGPU renderer with per-frame ONNX inference, Visionary enables dynamic neural processing while maintaining a lightweight, "click-to-run" browser experience. It introduces a standardized Gaussian Generator contract, which not only supports standard 3DGS rendering but also allows plug-and-play algorithms to generate or update Gaussians each frame. Such inference also enables us to apply feedforward generative post-processing. The platform further offers a plug in three.js library with a concise TypeScript API for seamless integration into existing web applications. Experiments show that, under identical 3DGS assets, Visionary achieves superior rendering efficiency compared to current Web viewers due to GPU-based primitive sorting. It already supports multiple variants, including MLP-based 3DGS, 4DGS, neural avatars, and style transformation or enhancement networks. By unifying inference and rendering directly in the browser, Visionary significantly lowers the barrier to reproduction, comparison, and deployment of 3DGS-family methods, serving as a unified World Model Carrier for both reconstructive and generative paradigms.
</details>

We have developed a powerful [Online Editor](https://visionary-laboratory.github.io/visionary/index_visionary.html) based on Visionary to help users easily manage and edit 3D scenes in one click. If you want to develop your own web project using this project, please refer to [Quick Start](#quick-start).

https://github.com/user-attachments/assets/6824de84-e4db-4c3f-90e8-1061ff309579

## ✨ Feature


- **⚡️ Native WebGPU Powered**: Utilizes `webgpu` to achieve high-performance parallel sorting and rendering of millions of Gaussian particles.
- **🎨 Hybrid Rendering Architecture**: Automatically handles depth mixing (Depth Compositing) between Gaussian point clouds and standard Meshes, perfectly solving occlusion issues and supporting complex scene compositions.
- **📦 Universal Asset Loader**: Single interface to intelligently identify and load multiple formats:
  - **Static Gaussians**: PLY, SPLAT, KSplat, SPZ, SOG
  - **Standard Mesh Models**: GLB, GLTF, FBX, OBJ
  - **4DGS/Avatar/scaffold-GS**: ONNX
  - **<span style="font-family: 'Brush Script MT', cursive; font-size: 1.1em; color: #FF4500;">🔥Your own algorithom</span>**: See [Export your algorithm to ONNX](onnx-export/README.md) in detail.

## News
- We have updated a comprehensive demonstration for how to export your own customized onnx model: https://drive.google.com/file/d/1W8C1OINxDPUoiYtDi9KKz4AmwTcuVbKX/view


## WebGPU Requirements & Known Issues

- **Browser:** A recent version of Chrome (or Chromium-based browser) with WebGPU enabled is required.
- **Recommended platform:** Windows 10/11 with a **discrete GPU** (NVIDIA / AMD) is strongly recommended for stable performance.
- **Ubuntu:** Currently **not supported**. Due to a Chrome WebGPU bug, fp16 is not properly supported on Ubuntu, which breaks our fp16 ONNX pipelines. We will enable official Ubuntu support after the upstream issue is fixed.
- **macOS:** GPU performance on most Macs is limited for heavy 3D Gaussian Splatting workloads. Unless you are using a high-end chip (e.g., M4 Max or better), we **do not recommend** macOS as the primary platform, as the viewer may run very slowly or stutter.



<a id="quick-start"></a>
## 🚀 Quick Start

### 1. Install Dependencies

Ensure that [Node.js](https://nodejs.org/) (v18+ recommended) is installed in your environment.

```bash
# Clone the repository
git clone https://github.com/Visionary-Laboratory/visionary.git
cd visionary

# Install dependencies
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

After successful startup, visit the following address to view the example:
👉 **http://localhost:3000/demo/simple/index.html**

Feel free to try all our [demos](/demo/).

### 2.1 LAN Access and WebGPU Trust

The dev server now listens on `0.0.0.0` by default, so other devices on the same LAN can open the project with:

```text
http://<your-lan-ip>:3000/
```

However, WebGPU features such as the editor are usually only reliable on:

- `http://localhost:3000`
- or a trusted `https://...` origin

If a remote device opens `http://<your-lan-ip>:3000` and WebGPU is unavailable, use local HTTPS development:

1. After `npm install`, the project will only check whether local HTTPS dev is ready. It will not install or trust certificates automatically.
2. On Windows, if `mkcert` is missing, install it with:

```powershell
winget install FiloSottile.mkcert
```

3. Run the project helper:

```bash
npm run dev:https:setup
```

This command will:

- run `mkcert -install`
- generate `certs/dev-server-cert.pem` and `certs/dev-server-key.pem`
- include `localhost`, the current hostname, and the current LAN IPv4 addresses
- create `.env.local` if it does not already exist

4. If you prefer to do it manually, the equivalent first step is:

```bash
mkcert -install
```

5. A manual certificate example:

```bash
mkcert -key-file certs/dev-server-key.pem -cert-file certs/dev-server-cert.pem localhost 127.0.0.1 ::1 192.168.1.10
```

Replace `192.168.1.10` with the actual LAN IP of the machine running the dev server.

6. Manual `.env.local` example:

```bash
VISIONARY_DEV_HTTPS=1
VISIONARY_DEV_CERT_FILE=certs/dev-server-cert.pem
VISIONARY_DEV_KEY_FILE=certs/dev-server-key.pem
```

7. Restart `npm run dev`, then open:

```text
https://<your-lan-ip>:3000/
```

8. Trust steps for other LAN devices:

- Export the local root CA from the machine that ran `mkcert -install`.
- Install that root CA into the operating system/browser trust store of every client device that will open the HTTPS LAN URL.
- Then reopen `https://<your-lan-ip>:3000/`.

Without that trust step, the certificate will still be treated as unsafe on remote devices, and WebGPU may remain unavailable.

### 3. Model Assets

![Teaser](assets/examples.PNG)
![Teaser](assets/examples2.PNG)

You can import our provided example assets [ (1,Neural Avater + 4DGS)](https://drive.google.com/drive/folders/1nk5slXl-_-jRyDggXoBpRwz2VajmQizQ?usp=drive_link), [ (2,LHM Example)](https://drive.google.com/drive/folders/13GwSHV1N8Alzjx7VhIJCcSKchRBIPB09?usp=sharing), [ (3,LHM Example2)](https://drive.google.com/drive/folders/13GwSHV1N8Alzjx7VhIJCcSKchRBIPB09?usp=sharing) or your own 3DGS/4DGS/Avater assets in the page. For details on creating 4DGS/Avater/Custom assets, see [Convert to ONNX](#convert-to-onnx). 

<a id="export-your-algorithm-to-onnx"></a>
## 🛠️ Export your algorithm to ONNX

This project supports rendering of various 3DGS/4DGS/Avater/Custom representations. To achieve this, trained 3D representations need to be exported to the ONNX format. This project provides conversion examples for 4DGS/Dynamic Avatar/Scaffold-GS, see [export instruction](onnx-export/README.md) for details.

## 🤝 Contributions & Acknowledgments

This project is deeply inspired and supported by the following open source projects:

- **[3D Gaussian Splatting](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)**
- **[ONNX Runtime Web](https://onnxruntime.ai/)**
- **[Three.js](https://threejs.org/)**
- **[web-splat](https://github.com/KeKsBoTer/web-splat/)**
- **[image-to-line-drawing](https://github.com/luckycucu/image-to-line-drawing/)**

## 📄 Citation

If you use Visionary in your research or projects, please consider citing:

```bibtex
@article{gong2025visionary,
      title={Visionary: The World Model Carrier Built on WebGPU-Powered Gaussian Splatting Platform}, 
      author={Gong, Yuning and Liu, Yifei and Zhan, Yifan and Niu, Muyao and Li, Xueying and Liao, Yuanjun and Chen, Jiaming and Gao, Yuanyuan and Chen, Jiaqi and Chen, Minming and Zhou, Li and Zhang, Yuning and Wang, Wei and Hou, Xiaoqing and Huang, Huaxi and Tang, Shixiang and Ma, Le and Zhang, Dingwen and Yang, Xue and Yan, Junchi and Zhang, Yanchi and Zheng, Yinqiang and Sun, Xiao and Zhong, Zhihang},
      journal={arXiv preprint arXiv:2512.08478},
      year={2025}
}
```

## 📝 License

This project is licensed under the [Apache-2.0 license](LICENSE).
