# 🌌 Quantum Sound Visualizer (量子音波)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-r128-black.svg)
![WebAudio](https://img.shields.io/badge/WebAudio-API-orange.svg)
![Performance](https://img.shields.io/badge/Performance-Zero%20GC-brightgreen.svg)

> **“不要温和地走进那个良夜。”** > Quantum Sound Visualizer 是一个基于 WebGL (Three.js) 和 Web Audio API 构建的电影级宇宙天体音乐可视化引擎。它不仅仅是让粒子随音量跳动，而是将音频频段实时转化为**引力、角速度与热辐射**，在浏览器中重现《星际穿越》级别的宇宙奇观。

![Preview](https://via.placeholder.com/800x450/020204/FFFFFF?text=Insert+Your+Epic+Blackhole+GIF+Here) ## ✨ 核心视觉：三重宇宙状态机 (Tri-State Cosmic Engine)

本项目摒弃了传统的随机噪波，采用天体物理学近似算法，构建了三种完美过渡的宇宙形态：

* **🌌 创世星云 (Primordial Nebula) | 待机态**
  * 基于 fBM (分形布朗运动) 噪声算法分布的 3D 星云。
  * 在没有音频输入时，星系在虚空中进行优美的宏观自转与量子涨落，呈现深邃的深空幽蓝。
* **🕳️ 卡冈图雅 (Gargantua Black Hole) | 播放态**
  * **引力坍缩：** 音乐启动瞬间，星云被强行拉入 200 条严格的开普勒轨道。
  * **极端克制感：** 重低音 (Bass) 轰炸不会导致粒子散乱，而是全额转化为**极端的轨道角速度**。
  * **黑体辐射与多普勒束流：** 结合相对论蓝移效应，迎面高速旋转的吸积盘会爆发出 X 射线级的耀眼白光。
  * **引力透镜：** 运用空间弯折算法，再现事件视界背后光线被引力拉扯形成的“爱因斯坦环”。
* **🌀 爱因斯坦-罗森桥 (Einstein-Rosen Bridge) | 拖拽态**
  * **无缝时空穿梭：** 拖动播放进度条时，二维吸积盘瞬间在 Z 轴折叠成贯穿时空的巨型圆柱形虫洞。
  * 配合 FOV 广角拉伸与半透明流光拉丝，实现极具压迫感的光速跃迁交互。

## 🚀 极致性能：榨干 V8 引擎极限

为了在不使用 GPGPU 计算着色器的情况下，让 CPU 支撑高达 **35,000** 个发光等离子体的复杂物理运算，本项目进行了极端的底层优化：

* **Zero-Allocation Render Loop (零内存分配)：** 彻底重构了渲染循环中的色彩计算与矢量数学。消除所有 `new THREE.Color()` 和对象返回，利用预分配内存，**将每秒数百万次的垃圾回收 (GC) 降至为 0**，实现了毫秒级形态切换的绝对丝滑。
* **Math Fast-Path：** 摒弃高昂的 `Math.pow(x, 1.5)` 等指数运算，底层全部采用牛顿迭代近似展开（如 `x * Math.sqrt(x)`），压榨每一滴算力。
* **Unreal Bloom Post-Processing：** 引入好莱坞级后期管线，结合自定义的 Gaussian Plasma (高斯等离子) 贴图与 Additive Blending (加色混合)，在不增加多边形数量的前提下，渲染出完美的流体烟雾感和溢出屏幕的 HDR 高光。

## 🛠️ 安装与运行

本项目为纯前端架构，零复杂的构建依赖。

1. 克隆仓库：
   ```bash
   git clone [https://github.com/YourUsername/Quantum-Sound-Visualizer.git](https://github.com/YourUsername/Quantum-Sound-Visualizer.git)