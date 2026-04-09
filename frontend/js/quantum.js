/**
 * Quantum Sound Visualizer - 终极宇宙演化版 (原汁原味回滚版)
 * 核心：保留最极致的光影与物理公式，仅做最安全的 GC 性能修复，还原最震撼的星云与黑洞。
 */

class QuantumVisualizer {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = null; this.camera = null; this.renderer = null; this.particles = null;

        this.audioContext = null; this.analyser = null; this.audioSource = null; this.audioBuffer = null;
        this.isPlaying = false; this.isMicActive = false; this.startTime = 0; this.pauseTime = 0; this.gainNode = null;

        this.isDragging = false;
        this.lastDragPercent = undefined;
        this.dragVelocity = 0;

        this.smoothedAudio = { bass: 0, mid: 0, treble: 0 };

        this.stateWeights = { nebula: 1.0, blackhole: 0.0, wormhole: 0.0 };

        this.params = {
            particleCount: 35000,
            flowSpeed: 5.0,
            baseHue: 220,
            particleSize: 0.35
        };

        this.frequencyData = new Uint8Array(256);
        this.isCameraDragging = false; this.previousMousePosition = { x: 0, y: 0 };
        this.cameraRotation = { x: 0.8, y: 0 }; this.cameraDistance = 6.5;

        this.positions = null; this.velocities = null; this.phases = null;
        this.shapeNebula = null;
        this.shapeBH_R = null;
        this.shapeBH_A = null;
        this.shapeBH_Y = null;

        this.currentShake = 0; this.targetShake = 0;
        this.blackHoleMesh = null;

        // 【唯一安全优化】预分配颜色对象，杜绝每秒几百万次的内存创建导致的卡顿
        this._tempColorNeb = new THREE.Color();
        this._tempColorWh = new THREE.Color();

        this.init();
    }

    init() {
        try {
            this.initThreeJS();
            this.initParticles();
            this.initUI();
            this.initInteraction();
            this.animate();
            document.getElementById('loader').classList.add('hidden');
        } catch (e) {
            console.error('Init error:', e);
        }
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.05);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
        this.updateCameraPosition();

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 1);
        this.container.appendChild(this.renderer.domElement);

        const bhGeo = new THREE.SphereGeometry(1.24, 128, 128);
        const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: true });
        this.blackHoleMesh = new THREE.Mesh(bhGeo, bhMat);
        this.blackHoleMesh.visible = false;
        this.scene.add(this.blackHoleMesh);
    }

    // 原汁原味的高斯等离子光斑
    generateGaussianPlasma() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);

        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        gradient.addColorStop(0.05, 'rgba(200, 220, 255, 0.8)');
        gradient.addColorStop(0.15, 'rgba(100, 150, 255, 0.25)');
        gradient.addColorStop(0.5, 'rgba(50, 80, 200, 0.02)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return texture;
    }

    initParticles() {
        const count = this.params.particleCount;
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.phases = new Float32Array(count);
        const colors = new Float32Array(count * 3);

        this.shapeNebula = new Float32Array(count * 3);
        this.shapeBH_R = new Float32Array(count);
        this.shapeBH_A = new Float32Array(count);
        this.shapeBH_Y = new Float32Array(count);

        const clusterCenters = Array.from({length: 8}, () => ({
            x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 8,
            radius: 1.5 + Math.random() * 2.5
        }));

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const pid = i / count;
            this.phases[i] = Math.random() * Math.PI * 2;

            // 星云 fBM 原版算法
            const cluster = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
            const r_neb = cluster.radius * Math.pow(Math.random(), 0.5);
            const theta_neb = Math.random() * Math.PI * 2;
            const phi_neb = Math.acos(2.0 * Math.random() - 1.0);

            let nx = cluster.x + r_neb * Math.sin(phi_neb) * Math.cos(theta_neb);
            let ny = cluster.y + r_neb * Math.sin(phi_neb) * Math.sin(theta_neb) * 0.6;
            let nz = cluster.z + r_neb * Math.cos(phi_neb);

            nx += Math.sin(ny * 1.5) * 0.8;
            ny += Math.cos(nx * 1.5) * 0.5;
            nz += Math.sin(nx * 1.5) * 0.8;

            this.shapeNebula[i3] = nx;
            this.shapeNebula[i3+1] = ny;
            this.shapeNebula[i3+2] = nz;

            // 黑洞原版算法
            this.shapeBH_A[i] = Math.random() * Math.PI * 2;
            let r_bh;
            if (pid < 0.15) {
                r_bh = 1.25 + (pid / 0.15) * 0.1;
            } else {
                const trackId = Math.floor(((pid - 0.15) / 0.85) * 120) / 120;
                r_bh = 1.35 + Math.pow(trackId, 1.8) * 6.5;
            }
            this.shapeBH_R[i] = r_bh;
            this.shapeBH_Y[i] = (Math.random() - 0.5) * Math.max(0.01, (r_bh - 1.25) * 0.08);

            this.positions[i3] = nx;
            this.positions[i3+1] = ny;
            this.positions[i3+2] = nz;

            colors[i3] = 1.0; colors[i3+1] = 1.0; colors[i3+2] = 1.0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: this.params.particleSize,
            map: this.generateGaussianPlasma(),
            transparent: true, opacity: 0.85,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false, sizeAttenuation: true
        });
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    // 原汁原味的物理黑体辐射，拒绝数学阉割
    getBlackbodyColor(temperature, dopplerFactor, baseLight) {
        let r, g, b;
        if (temperature < 0.2) {
            r = 0.5 * (temperature / 0.2); g = 0.05 * (temperature / 0.2); b = 0.0;
        } else if (temperature < 0.6) {
            const t = (temperature - 0.2) / 0.4;
            r = 0.5 + t * 0.5; g = 0.05 + t * 0.75; b = t * 0.2;
        } else if (temperature < 0.9) {
            const t = (temperature - 0.6) / 0.3;
            r = 1.0; g = 0.8 + t * 0.2; b = 0.2 + t * 0.8;
        } else {
            const t = (temperature - 0.9) / 0.1;
            r = 1.0 - t * 0.2; g = 1.0; b = 1.0;
        }

        if (dopplerFactor > 1.3) {
            r *= 0.8; g *= 0.9; b = Math.min(1.0, b * 1.5);
        }

        const exposure = baseLight * dopplerFactor;
        return { r: Math.min(1.0, r * exposure), g: Math.min(1.0, g * exposure), b: Math.min(1.0, b * exposure) };
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.85;
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.8;
        } catch (e) {}
    }
    async loadAudioFile(file) {
        if (!this.audioContext) this.initAudio();
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            document.getElementById('status').textContent = file.name;
            document.getElementById('total-time').textContent = this.formatTime(this.audioBuffer.duration);
            this.pauseTime = 0; this.updateProgress(); return true;
        } catch (e) { return false; }
    }
    play(force = false) {
        if (!this.audioBuffer) return;
        if (!force && this.isPlaying) { this.pause(); return; }
        if (this.audioSource) { this.audioSource.onended = null; this.audioSource.stop(); this.audioSource = null; }
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
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
        document.getElementById('btn-play').classList.add('playing');
        document.getElementById('status').textContent = '播放中...';
    }
    pause() {
        if (this.audioSource) { this.audioSource.onended = null; this.pauseTime = this.audioContext.currentTime - this.startTime; this.audioSource.stop(); this.audioSource = null; }
        this.isPlaying = false; document.getElementById('btn-play').classList.remove('playing'); document.getElementById('status').textContent = '已暂停';
    }
    stop() {
        if (this.audioSource) { this.audioSource.onended = null; this.audioSource.stop(); this.audioSource = null; }
        this.isPlaying = false; this.pauseTime = 0; document.getElementById('btn-play').classList.remove('playing'); this.updateProgress();
    }
    seek(time) {
        const wasPlaying = this.isPlaying; this.pauseTime = Math.max(0, Math.min(time, this.audioBuffer.duration));
        if (wasPlaying) { if (this.audioSource) { this.audioSource.onended = null; this.audioSource.stop(); this.audioSource = null; } this.isPlaying = false; this.play(true); } else { this.updateProgress(); }
    }
    skip(seconds) { if (!this.audioBuffer) return; const current = this.isPlaying ? this.audioContext.currentTime - this.startTime : this.pauseTime; this.seek(current + seconds); }
    formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return '0:00'; const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return m + ':' + s.toString().padStart(2, '0'); }
    getBandEnergy(start, end) { let sum = 0; for (let i = start; i < end && i < this.frequencyData.length; i++) { sum += this.frequencyData[i]; } return (sum / (end - start)) / 255; }

    updateParticles() {
        let rawBass = 0, rawMid = 0, rawTreble = 0;
        if (this.analyser && (this.isPlaying || this.isMicActive)) {
            this.analyser.getByteFrequencyData(this.frequencyData);
            rawBass = this.getBandEnergy(0, 10);
            rawMid = this.getBandEnergy(10, 60);
            rawTreble = this.getBandEnergy(60, 150);
        }

        const attack = 0.25; const release = 0.96;
        this.smoothedAudio.bass = rawBass > this.smoothedAudio.bass ? (rawBass * attack + this.smoothedAudio.bass * (1 - attack)) : (this.smoothedAudio.bass * release);
        this.smoothedAudio.treble = rawTreble > this.smoothedAudio.treble ? (rawTreble * attack + this.smoothedAudio.treble * (1 - attack)) : (this.smoothedAudio.treble * release);

        const bass = this.smoothedAudio.bass;

        if (rawBass > 0.85) { this.targetShake = 0.08 + Math.random() * 0.05; }
        this.currentShake += (this.targetShake - this.currentShake) * 0.15;
        this.targetShake *= 0.8;

        let tNeb = 0, tBh = 0, tWh = 0;
        if (this.isDragging) {
            tWh = 1.0;
        } else if (this.isPlaying || this.isMicActive) {
            tBh = 1.0;
        } else {
            tNeb = 1.0;
        }

        const morphSpeed = this.isDragging ? 0.05 : 0.015;
        this.stateWeights.nebula += (tNeb - this.stateWeights.nebula) * morphSpeed;
        this.stateWeights.blackhole += (tBh - this.stateWeights.blackhole) * morphSpeed;
        this.stateWeights.wormhole += (tWh - this.stateWeights.wormhole) * morphSpeed;

        const wSum = this.stateWeights.nebula + this.stateWeights.blackhole + this.stateWeights.wormhole;
        const wN = this.stateWeights.nebula / wSum;
        const wB = this.stateWeights.blackhole / wSum;
        const wW = this.stateWeights.wormhole / wSum;

        this.blackHoleMesh.scale.setScalar(Math.max(0.001, wB * 1.0));
        this.blackHoleMesh.visible = (wB > 0.01);

        const time = performance.now() * 0.001;
        const count = this.params.particleCount;
        const flowMultiplier = this.params.flowSpeed * 0.2;

        const positions = this.particles ? this.particles.geometry.attributes.position.array : null;
        const colors = this.particles ? this.particles.geometry.attributes.color.array : null;

        if (!positions || !colors) return;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const pid = i / count;

            // 星云态原版推算
            const nX = this.shapeNebula[i3];
            const nY = this.shapeNebula[i3+1];
            const nZ = this.shapeNebula[i3+2];

            const driftX = Math.sin(time * flowMultiplier * 0.5 + nY) * 0.2;
            const driftY = Math.cos(time * flowMultiplier * 0.4 + nX) * 0.2;
            const driftZ = Math.sin(time * flowMultiplier * 0.6 + nZ) * 0.2;

            // 黑洞态原版推算
            const r = this.shapeBH_R[i];
            let bX = 0, bY = 0, bZ = 0;
            let bhTemp = 0, bhDoppler = 1.0;

            if (wB > 0.001) {
                const baseSpeed = 0.008 / Math.pow(r, 1.5) * flowMultiplier;
                const audioSpeed = (bass * 0.08) / Math.pow(r, 1.2);

                this.shapeBH_A[i] -= (baseSpeed + audioSpeed);
                const angle = this.shapeBH_A[i];

                let diskX = Math.cos(angle) * r;
                let diskZ = Math.sin(angle) * r;
                let diskY = this.shapeBH_Y[i];

                const velocityDotView = -Math.sin(angle);
                bhDoppler = Math.pow(1.0 + velocityDotView * 0.55, 5.0);

                bhTemp = Math.max(0.0, 1.0 - (r - 1.25) / 5.5);
                if (r < 1.35) bhTemp = Math.min(1.0, bhTemp + 0.4);

                if (diskZ < -0.1) {
                    const impactParam = Math.abs(diskX);
                    if (impactParam < 2.8) {
                        const lensAmount = Math.pow((2.8 - impactParam) / 2.8, 3.5);
                        const upOrDown = (i % 2 === 0) ? 1 : -1;
                        diskY += upOrDown * lensAmount * (Math.abs(diskZ) * 1.5 + 1.2);
                        diskZ = diskZ * 0.05;
                        bhDoppler *= 1.3;
                    }
                }
                bX = diskX; bY = diskY; bZ = diskZ;
            }

            // 虫洞态原版推算
            let whX = 0, whY = 0, whZ = 0;
            if (wW > 0.001) {
                const tubeRadius = 1.5 + Math.sin(pid * Math.PI * 10) * 0.2;
                const tubeLength = 80.0;
                const tubeZ = (pid - 0.5) * tubeLength;

                const warpSpeed = this.dragVelocity * 60.0;
                let dynamicZ = (tubeZ + time * warpSpeed) % tubeLength;
                if (dynamicZ > tubeLength/2) dynamicZ -= tubeLength;
                if (dynamicZ < -tubeLength/2) dynamicZ += tubeLength;

                const tubeAngle = this.shapeBH_A[i] * 2.0;
                whX = Math.cos(tubeAngle) * tubeRadius;
                whY = Math.sin(tubeAngle) * tubeRadius;
                whZ = dynamicZ;
            }

            // 混合坐标
            let targetX = (nX + driftX) * wN + bX * wB + whX * wW;
            let targetY = (nY + driftY) * wN + bY * wB + whY * wW;
            let targetZ = (nZ + driftZ) * wN + bZ * wB + whZ * wW;

            let springForce = 0.05;
            if (wB > 0.8) springForce = 1.0;
            else if (wB > 0.01) springForce = 0.1;
            if (wW > 0.5) springForce = 0.8;

            this.velocities[i3] += (targetX - this.positions[i3]) * springForce;
            this.velocities[i3+1] += (targetY - this.positions[i3+1]) * springForce;
            this.velocities[i3+2] += (targetZ - this.positions[i3+2]) * springForce;

            let friction = (wB > 0.5) ? 0.65 : 0.85;
            if (wN > 0.5) friction = 0.90;

            this.velocities[i3] *= friction; this.velocities[i3+1] *= friction; this.velocities[i3+2] *= friction;
            this.positions[i3] += this.velocities[i3]; this.positions[i3+1] += this.velocities[i3+1]; this.positions[i3+2] += this.velocities[i3+2];

            // 【色彩终极渲染：仅去除了 new THREE.Color 解决卡顿，保留所有原版视觉参数！】
            if (colors) {
                const twinkle = Math.sin(time * 1.5 + this.phases[i]) * 0.3;

                const nebHue = (this.params.baseHue + (Math.sin(pid * 10) * 15)) / 360;
                this._tempColorNeb.setHSL(nebHue, 0.8, 0.4 + twinkle * 0.5);

                const bhBaseLight = 0.3 + twinkle * 0.5 + (bass * 0.6);
                const bhColor = this.getBlackbodyColor(bhTemp, bhDoppler, bhBaseLight);

                const whHue = (this.dragVelocity > 0 ? 0.55 : 0.75) + (Math.random() * 0.1);
                this._tempColorWh.setHSL(whHue, 0.9, 0.6 + Math.random() * 0.4);

                colors[i3] = this._tempColorNeb.r * wN + bhColor.r * wB + this._tempColorWh.r * wW;
                colors[i3+1] = this._tempColorNeb.g * wN + bhColor.g * wB + this._tempColorWh.g * wW;
                colors[i3+2] = this._tempColorNeb.b * wN + bhColor.b * wB + this._tempColorWh.b * wW;
            }
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
    }

    updateCameraPosition() {
        const phi = this.cameraRotation.x;
        const theta = this.cameraRotation.y;
        let camX = this.cameraDistance * Math.sin(phi) * Math.cos(theta);
        let camY = this.cameraDistance * Math.cos(phi);
        let camZ = this.cameraDistance * Math.sin(phi) * Math.sin(theta);

        if (this.isDragging) {
            this.targetFov = 120;
            this.currentShake = Math.abs(this.dragVelocity) * 0.3;
            camX = 0; camY = 0; camZ = 0.5;
        } else {
            this.targetFov = 60;
        }

        if (Math.abs(this.camera.fov - this.targetFov) > 0.5) {
            this.camera.fov += (this.targetFov - this.camera.fov) * 0.15;
            this.camera.updateProjectionMatrix();
        }

        if (this.currentShake > 0.005) {
            camX += (Math.random() - 0.5) * this.currentShake;
            camY += (Math.random() - 0.5) * this.currentShake;
            camZ += (Math.random() - 0.5) * this.currentShake;
        }

        this.camera.position.set(camX, camY, camZ);
        if (this.isDragging) {
            this.camera.lookAt(0, 0, -10);
        } else {
            this.camera.lookAt(0, 0, 0);
        }
    }

    initInteraction() {
        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousedown', (e) => { this.isCameraDragging = true; this.previousMousePosition = { x: e.clientX, y: e.clientY }; });
        window.addEventListener('mousemove', (e) => {
            if (!this.isCameraDragging) return;
            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;
            this.cameraRotation.y += deltaX * 0.01;
            this.cameraRotation.x += deltaY * 0.01;
            this.cameraRotation.x = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraRotation.x));
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('mouseup', () => { this.isCameraDragging = false; });
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraDistance += e.deltaY * 0.003;
            this.cameraDistance = Math.max(2, Math.min(15, this.cameraDistance));
        });
        window.addEventListener('resize', () => { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.updateParticles();
        this.updateCameraPosition();

        if (this.particles && !this.isDragging) {
            let rotationSpeed = 0.0008;
            if (this.stateWeights.blackhole > 0.5) rotationSpeed = 0.0001;

            this.particles.rotation.y += rotationSpeed * (this.params.flowSpeed * 0.5);
        }

        this.updateProgress();
        this.renderer.render(this.scene, this.camera);

        this.dragVelocity *= 0.9;
    }

    initUI() {
        document.getElementById('btn-play').addEventListener('click', () => this.play());
        document.getElementById('btn-prev').addEventListener('click', () => this.skip(-10));
        document.getElementById('btn-next').addEventListener('click', () => this.skip(10));
        document.getElementById('btn-file').addEventListener('click', () => { document.getElementById('file-input').click(); });
        document.getElementById('file-input').addEventListener('change', async (e) => { const file = e.target.files[0]; if (file) await this.loadAudioFile(file); });

        const container = document.getElementById('progress-container');
        const getPercent = (clientX) => { const rect = container.getBoundingClientRect(); return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)); };

        container.addEventListener('pointerdown', (e) => {
            if (!this.audioBuffer) return;
            e.preventDefault();
            this.isDragging = true;
            this.wasPlayingBeforeDrag = this.isPlaying;
            container.classList.add('dragging');
            container.setPointerCapture(e.pointerId);
            const percent = getPercent(e.clientX);
            this.lastDragPercent = percent;
            this.dragVelocity = 0;
            this.updateProgressVisual(percent);
        });

        container.addEventListener('pointermove', (e) => {
            if (!this.isDragging || !this.audioBuffer) return;
            e.preventDefault();
            const percent = getPercent(e.clientX);
            if (this.lastDragPercent !== undefined) {
                this.dragVelocity = (percent - this.lastDragPercent) * 2.0;
            }
            this.lastDragPercent = percent;
            this.updateProgressVisual(percent);
        });

        container.addEventListener('pointerup', (e) => {
            if (!this.isDragging || !this.audioBuffer) return;
            e.preventDefault();
            this.isDragging = false;
            this.lastDragPercent = undefined;
            container.classList.remove('dragging');
            this.seek((getPercent(e.clientX) / 100) * this.audioBuffer.duration);
            try { container.releasePointerCapture(e.pointerId); } catch (err) {}
        });

        const detailEl = document.getElementById('detail');
        if (detailEl) { detailEl.addEventListener('input', (e) => { this.params.particleCount = parseInt(e.target.value); document.getElementById('detail-val').textContent = (this.params.particleCount / 1000).toFixed(0) + 'k'; }); detailEl.addEventListener('change', () => { this.recreateParticles(); }); }
        const flowEl = document.getElementById('flow');
        if (flowEl) flowEl.addEventListener('input', (e) => { this.params.flowSpeed = parseFloat(e.target.value); document.getElementById('flow-val').textContent = this.params.flowSpeed.toFixed(1); });
        const colorEl = document.getElementById('color');
        if (colorEl) colorEl.addEventListener('input', (e) => { this.params.baseHue = parseInt(e.target.value); document.getElementById('color-val').textContent = this.params.baseHue + '°'; });
    }

    recreateParticles() {
        this.scene.remove(this.particles);
        if (this.particles) { this.particles.geometry.dispose(); this.particles.material.dispose(); }
        this.initParticles();
    }
    updateProgressVisual(percent) {
        document.getElementById('progress-bar').style.width = percent + '%'; document.getElementById('progress-handle').style.left = percent + '%';
        if (this.audioBuffer) document.getElementById('current-time').textContent = this.formatTime((percent / 100) * this.audioBuffer.duration);
    }
    updateProgress() {
        if (this.isDragging || !this.audioBuffer) return;
        const current = this.isPlaying ? this.audioContext.currentTime - this.startTime : this.pauseTime;
        let percent = (current / this.audioBuffer.duration) * 100;
        if (isNaN(percent)) percent = 0;
        document.getElementById('progress-bar').style.width = percent + '%'; document.getElementById('progress-handle').style.left = percent + '%'; document.getElementById('current-time').textContent = this.formatTime(current);
    }
}
document.addEventListener('DOMContentLoaded', () => { window.visualizer = new QuantumVisualizer(); });