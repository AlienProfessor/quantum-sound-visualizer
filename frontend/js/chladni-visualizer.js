/**
 * Cyber-Chladni Visualizer (Jarvis Bio-Swarm Edition)
 * 赋予克拉尼图形生物感和量子流动特性
 */

class ChladniApp {
    constructor() {
        this.canvas = document.getElementById('chladni-canvas') || document.getElementById('canvas-container').appendChild(document.createElement('canvas'));
        // 兼容原有的挂载方式
        if (this.canvas.tagName !== 'CANVAS') {
            const canvas = document.createElement('canvas');
            canvas.id = 'chladni-canvas';
            this.canvas.appendChild(canvas);
            this.canvas = canvas;
        }

        this.ws = null;
        this.audioContext = null;
        this.analyser = null;
        this.audioSource = null;
        this.audioBuffer = null;
        this.isPlaying = false;
        this.isStreaming = false;
        this.isMicActive = false;
        this.animationId = null;
        this.startTime = 0;
        this.pauseTime = 0;
        this.gainNode = null;

        // 配置
        this.config = {
            particleCount: 8000,
            zScale: 0.35,
            damping: 0.88,        // 生物阻尼系数 (决定粘滞感)
            springForce: 0.08,    // 弹簧拉力 (决定向目标靠拢的激进程度)
            rotationSpeed: 0.001
        };

        // Three.js 对象
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particleSystem = null;
        this.surfaceMesh = null;

        // 生物场物理数据 (Jarvis Core)
        this.targetPositions = null; // 后端下发的克拉尼目标点
        this.velocities = null;      // 粒子的当前速度
        this.phases = null;          // 每个粒子的独立呼吸相位

        this.init();
    }

    async init() {
        this.initThreeJS();
        this.initUI();
        await this.connectWebSocket();
        const loader = document.getElementById('loader');
        if(loader) loader.classList.add('hidden');
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.2);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
        this.camera.position.set(0, 1.8, 2.5);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);

        this.setupLighting();
        this.createParticles();
        this.createSurface();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(2, 3, 2);
        this.scene.add(mainLight);
    }

    createParticles() {
        const count = this.config.particleCount;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        // 初始化生物物理数组
        this.targetPositions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            // 初始随机分布
            const x = (Math.random() - 0.5) * 2;
            const y = 0;
            const z = (Math.random() - 0.5) * 2;

            positions[i3] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;

            this.targetPositions[i3] = x;
            this.targetPositions[i3 + 1] = y;
            this.targetPositions[i3 + 2] = z;

            this.phases[i] = Math.random() * Math.PI * 2; // 随机赋予生命呼吸起点

            colors[i3] = 0.5; colors[i3 + 1] = 0.5; colors[i3 + 2] = 1.0;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.022,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
    }

    createSurface() {
        const geometry = new THREE.PlaneGeometry(2, 2, 50, 50);
        const material = new THREE.MeshBasicMaterial({
            color: 0x007AFF,
            wireframe: true,
            transparent: true,
            opacity: 0.08
        });

        this.surfaceMesh = new THREE.Mesh(geometry, material);
        this.surfaceMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.surfaceMesh);
    }

    async connectWebSocket() {
        return new Promise((resolve) => {
            this.ws = new WebSocket(`ws://localhost:8000/ws`);
            this.ws.onopen = () => resolve();
            this.ws.onmessage = (event) => this.handleWebSocketMessage(JSON.parse(event.data));
            this.ws.onclose = () => setTimeout(() => this.connectWebSocket(), 3000);
        });
    }

    handleWebSocketMessage(data) {
        if (data.type === 'visualization') {
            this.updateVisualization(data.data);
        }
    }

    updateVisualization(data) {
        // 【核心改变】不再直接修改粒子的真实位置，而是修改粒子的“目标点”
        if (data.particles && this.particleSystem) {
            const particles = data.particles;
            for (let i = 0; i < Math.min(particles.length, this.config.particleCount); i++) {
                const i3 = i * 3;
                const p = particles[i];

                this.targetPositions[i3] = p[0];
                this.targetPositions[i3 + 1] = p[2] * this.config.zScale; // ThreeJS 中 Y 是向上
                this.targetPositions[i3 + 2] = p[1];
            }
        }

        // 更新底部幽灵网格
        if (data.surface && this.surfaceMesh) {
            const z = data.surface.z;
            const positions = this.surfaceMesh.geometry.attributes.position.array;
            for (let i = 0; i < positions.length / 3; i++) {
                const row = Math.floor(i / 51);
                const col = i % 51;
                if (row < z.length && col < z[0].length) {
                    positions[i * 3 + 2] = z[row][col] * this.config.zScale * 0.5; // 网格起伏轻微一点
                }
            }
            this.surfaceMesh.geometry.attributes.position.needsUpdate = true;
        }
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        const time = performance.now() * 0.001;

        if (this.particleSystem) {
            const positions = this.particleSystem.geometry.attributes.position.array;
            const colors = this.particleSystem.geometry.attributes.color.array;

            for (let i = 0; i < this.config.particleCount; i++) {
                const i3 = i * 3;

                // 1. 获取目标向量 (向后端的克拉尼图形靠拢)
                const dx = this.targetPositions[i3] - positions[i3];
                const dy = this.targetPositions[i3 + 1] - positions[i3 + 1];
                const dz = this.targetPositions[i3 + 2] - positions[i3 + 2];

                // 2. 有机呼吸游荡感 (Jarvis 待机微动)
                const wanderX = Math.sin(time * 2.0 + this.phases[i]) * 0.001;
                const wanderY = Math.cos(time * 1.5 + this.phases[i]) * 0.001;
                const wanderZ = Math.sin(time * 1.8 - this.phases[i]) * 0.001;

                // 3. 施加力并更新速度 (弹簧系统)
                this.velocities[i3] += dx * this.config.springForce + wanderX;
                this.velocities[i3 + 1] += dy * this.config.springForce + wanderY;
                this.velocities[i3 + 2] += dz * this.config.springForce + wanderZ;

                // 4. 生物阻尼 (防止粒子无限加速)
                this.velocities[i3] *= this.config.damping;
                this.velocities[i3 + 1] *= this.config.damping;
                this.velocities[i3 + 2] *= this.config.damping;

                // 5. 更新实际位置
                positions[i3] += this.velocities[i3];
                positions[i3 + 1] += this.velocities[i3 + 1];
                positions[i3 + 2] += this.velocities[i3 + 2];

                // 6. 动态情感颜色渲染
                // 粒子速度越快，颜色越偏向暖色(红色/黄色)；速度越慢，越偏向冷色(蓝色/青色)
                const speed = Math.sqrt(this.velocities[i3]**2 + this.velocities[i3+1]**2 + this.velocities[i3+2]**2);
                const height = Math.abs(positions[i3 + 1]);

                // Hue (色相): 基础色 0.6(蓝) -> 减去速度影响趋向 0(红)
                let hue = 0.6 - speed * 8.0;
                if (hue < 0) hue += 1.0; // 颜色循环

                // 速度快的粒子更亮、饱和度更高
                const color = new THREE.Color().setHSL(
                    hue,
                    Math.min(1.0, 0.6 + speed * 5.0),
                    Math.min(0.8, 0.4 + height * 0.4 + speed * 2.0)
                );

                colors[i3] = color.r;
                colors[i3 + 1] = color.g;
                colors[i3 + 2] = color.b;
            }

            this.particleSystem.geometry.attributes.position.needsUpdate = true;
            this.particleSystem.geometry.attributes.color.needsUpdate = true;

            // 缓慢旋转整个量子场
            this.particleSystem.rotation.y += this.config.rotationSpeed;
            if(this.surfaceMesh) this.surfaceMesh.rotation.z -= this.config.rotationSpeed * 0.5;
        }

        // 相机轻微跟随呼吸摆动
        this.camera.position.x = Math.sin(time * 0.3) * 0.15;
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ============ 下方保留你原有的音频控制逻辑 ============
    async initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100, latencyHint: 'interactive'
            });
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.8;
        }
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    }

    async loadAudioFile(file) {
        await this.initAudioContext();
        const arrayBuffer = await file.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        const titleEl = document.getElementById('status');
        if(titleEl) titleEl.textContent = file.name;
        return true;
    }

    play(force = false) {
        if (!this.audioBuffer) return;
        if (!force && this.isPlaying) { this.pause(); return; }

        this.initAudioContext();
        if (this.audioSource) { this.audioSource.stop(); this.audioSource = null; }

        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        const offset = this.pauseTime;
        this.audioSource.start(0, offset);
        this.startTime = this.audioContext.currentTime - offset;
        this.isPlaying = true;

        this.audioSource.onended = () => { if (this.isPlaying) this.stop(); };
        this.startAudioStreaming();

        const btn = document.getElementById('btn-play');
        if(btn) btn.classList.add('playing');
    }

    pause() {
        if (this.audioSource) {
            this.pauseTime = this.audioContext.currentTime - this.startTime;
            this.audioSource.stop();
            this.audioSource = null;
        }
        this.isPlaying = false;
        const btn = document.getElementById('btn-play');
        if(btn) btn.classList.remove('playing');
    }

    stop() {
        if (this.audioSource) { this.audioSource.stop(); this.audioSource = null; }
        this.isPlaying = false;
        this.isStreaming = false;
        this.pauseTime = 0;
        this.startTime = 0;
        const btn = document.getElementById('btn-play');
        if(btn) btn.classList.remove('playing');
    }

    startAudioStreaming() {
        if (this.isStreaming && this.isPlaying) return;
        this.isStreaming = true;
        const dataArray = new Float32Array(this.analyser.frequencyBinCount);

        const sendAudioData = () => {
            if (!this.isStreaming) return;
            this.analyser.getFloatTimeDomainData(dataArray);
            const downsampled = new Float32Array(Math.floor(dataArray.length / 4));
            for (let i = 0; i < downsampled.length; i++) downsampled[i] = dataArray[i * 4];

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'audio_data', audio: Array.from(downsampled) }));
            }
            requestAnimationFrame(sendAudioData);
        };
        sendAudioData();
    }

    initUI() {
        const btnFile = document.getElementById('btn-file');
        const fileInput = document.getElementById('file-input');
        const btnPlay = document.getElementById('btn-play');

        if(btnFile && fileInput) {
            btnFile.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files[0]) await this.loadAudioFile(e.target.files[0]);
            });
        }

        if(btnPlay) {
            btnPlay.addEventListener('click', () => this.play());
        }
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChladniApp();
});