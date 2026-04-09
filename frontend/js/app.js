/**
 * Cyber-Chladni Visualizer
 * 完整的音乐可视化应用
 */

class ChladniApp {
    constructor() {
        this.canvas = document.getElementById('chladni-canvas');
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
            zScale: 0.3,
            damping: 0.95,
            rotationSpeed: 0.001
        };
        
        // Three.js 对象
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particleSystem = null;
        this.surfaceMesh = null;
        
        // 性能监控
        this.latencyHistory = [];
        this.frameCount = 0;
        this.lastFpsTime = performance.now();
        
        this.init();
    }
    
    async init() {
        this.initThreeJS();
        this.initUI();
        await this.connectWebSocket();
        document.getElementById('loader').classList.add('hidden');
    }
    
    // ============ Three.js 初始化 ============
    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.2);
        
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
        this.camera.position.set(0, 1.8, 2.5);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        
        this.setupLighting();
        this.createParticles();
        this.createSurface();
        this.animate();
        
        window.addEventListener('resize', () => this.onResize());
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
        mainLight.position.set(2, 3, 2);
        this.scene.add(mainLight);
        
        const rimLight1 = new THREE.PointLight(0x007AFF, 0.5, 10);
        rimLight1.position.set(-2, 1, -2);
        this.scene.add(rimLight1);
        
        const rimLight2 = new THREE.PointLight(0xFF375F, 0.3, 10);
        rimLight2.position.set(2, -1, -2);
        this.scene.add(rimLight2);
    }
    
    createParticles() {
        const count = this.config.particleCount;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 2;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = (Math.random() - 0.5) * 2;
            
            const hue = 0.55 + Math.random() * 0.15;
            const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.025,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
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
            opacity: 0.15
        });
        
        this.surfaceMesh = new THREE.Mesh(geometry, material);
        this.surfaceMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.surfaceMesh);
    }
    
    // ============ WebSocket ============
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`ws://localhost:8000/ws`);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateStatus('connected');
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.updateStatus('disconnected');
                setTimeout(() => this.connectWebSocket(), 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
        });
    }
    
    handleWebSocketMessage(data) {
        if (data.type === 'visualization') {
            this.updateVisualization(data.data);
            
            const latency = performance.now() - (data.data.timestamp * 1000);
            this.latencyHistory.push(latency);
            if (this.latencyHistory.length > 30) this.latencyHistory.shift();
            
            const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
            document.getElementById('latency').textContent = `${Math.round(avgLatency)} ms`;
        } else if (data.type === 'config') {
            Object.assign(this.config, data.data);
            this.updateUIFromConfig();
        }
    }
    
    updateVisualization(data) {
        if (data.modes) {
            document.getElementById('mode-display').textContent = 
                `Mode: ${data.modes.n}, ${data.modes.m}`;
        }
        
        if (data.particles && this.particleSystem) {
            const positions = this.particleSystem.geometry.attributes.position.array;
            const colors = this.particleSystem.geometry.attributes.color.array;
            const particles = data.particles;
            
            for (let i = 0; i < Math.min(particles.length, this.config.particleCount); i++) {
                const i3 = i * 3;
                const p = particles[i];
                
                positions[i3] = p[0];
                positions[i3 + 2] = p[1];
                positions[i3 + 1] = p[2];
                
                const height = Math.abs(p[2]);
                const hue = 0.55 + height * 0.2;
                const color = new THREE.Color().setHSL(hue, 0.8, 0.5 + height * 0.3);
                colors[i3] = color.r;
                colors[i3 + 1] = color.g;
                colors[i3 + 2] = color.b;
            }
            
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
            this.particleSystem.geometry.attributes.color.needsUpdate = true;
        }
        
        if (data.surface && this.surfaceMesh) {
            const z = data.surface.z;
            const positions = this.surfaceMesh.geometry.attributes.position.array;
            
            for (let i = 0; i < positions.length / 3; i++) {
                const row = Math.floor(i / 51);
                const col = i % 51;
                if (row < z.length && col < z[0].length) {
                    positions[i * 3 + 2] = z[row][col] * this.config.zScale;
                }
            }
            
            this.surfaceMesh.geometry.attributes.position.needsUpdate = true;
            this.surfaceMesh.geometry.computeVertexNormals();
        }
    }
    
    // ============ 音频处理 ============
    async initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100,
                latencyHint: 'interactive'
            });
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
        }
        
        if (!this.gainNode) {
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.8;
        }
    }
    
    async loadAudioFile(file) {
        await this.initAudioContext();
        
        const arrayBuffer = await file.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        document.getElementById('current-file').textContent = file.name;
        document.getElementById('total-time').textContent = this.formatTime(this.audioBuffer.duration);
        document.getElementById('audio-time').textContent = 
            `00:00 / ${this.formatTime(this.audioBuffer.duration)}`;
        
        return true;
    }
    
    play(force = false) {
        if (!this.audioBuffer) return;
        
        // 如果没有 force 且正在播放，则暂停
        if (!force && this.isPlaying) {
            this.pause();
            return;
        }
        
        this.initAudioContext();
        
        // 如果已有 source 在运行，先停止
        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource = null;
        }
        
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        
        // 连接: source -> analyser -> gain -> destination
        this.audioSource.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        
        const offset = this.pauseTime;
        this.audioSource.start(0, offset);
        this.startTime = this.audioContext.currentTime - offset;
        this.isPlaying = true;
        
        this.audioSource.onended = () => {
            if (this.isPlaying) {
                this.stop();
            }
        };
        
        // 重新启动音频流
        this.startAudioStreaming();
        this.updatePlayButton();
        this.updateStatus('active');
    }
    
    pause() {
        if (this.audioSource) {
            this.pauseTime = this.audioContext.currentTime - this.startTime;
            this.audioSource.stop();
            this.audioSource = null;
        }
        this.isPlaying = false;
        // 注意：不设置 isStreaming = false，保持可视化继续运行
        this.updatePlayButton();
        this.updateStatus('connected');
    }
    
    stop() {
        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource = null;
        }
        this.isPlaying = false;
        this.isStreaming = false;
        this.pauseTime = 0;
        this.startTime = 0;
        this.updatePlayButton();
        this.updateProgress();
        this.updateStatus('connected');
    }
    
    seek(time) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.pause();
        }
        this.pauseTime = Math.max(0, Math.min(time, this.audioBuffer.duration));
        this.updateProgress();
        if (wasPlaying) {
            this.play();
        }
    }

    // 丝滑跳转 - 不暂停直接跳转
    seekWithoutPause(time) {
        if (!this.audioBuffer) return;
        
        const targetTime = Math.max(0, Math.min(time, this.audioBuffer.duration));
        const wasPlaying = this.isPlaying;
        
        // 停止当前音频源
        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource = null;
        }
        
        // 更新时间点
        this.pauseTime = targetTime;
        this.updateProgress();
        
        // 如果正在播放，无缝继续
        if (wasPlaying) {
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = this.audioBuffer;
            this.audioSource.connect(this.analyser);
            this.analyser.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
            
            this.audioSource.start(0, targetTime);
            this.startTime = this.audioContext.currentTime - targetTime;
            this.isPlaying = true;
            
            this.audioSource.onended = () => {
                if (this.isPlaying) {
                    this.stop();
                }
            };
        }
    }


    
    skip(seconds) {
        if (!this.audioBuffer) return;
        const currentTime = this.isPlaying ? this.audioContext.currentTime - this.startTime : this.pauseTime;
        this.seek(currentTime + seconds);
    }
    
    startAudioStreaming() {
        // 避免重复启动
        if (this.isStreaming && this.isPlaying) return;
        
        this.isStreaming = true;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        
        const sendAudioData = () => {
            if (!this.isStreaming) return;
            
            this.analyser.getFloatTimeDomainData(dataArray);
            
            const downsampled = new Float32Array(Math.floor(dataArray.length / 4));
            for (let i = 0; i < downsampled.length; i++) {
                downsampled[i] = dataArray[i * 4];
            }
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'audio_data',
                    audio: Array.from(downsampled)
                }));
            }
            
            if (this.isPlaying) {
                this.updateProgress();
            }
            
            requestAnimationFrame(sendAudioData);
        };
        
        sendAudioData();
    }
    
    async startMicrophone() {
        if (this.isMicActive) {
            this.stopMicrophone();
            return;
        }
        
        try {
            await this.initAudioContext();
            
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            const micSource = this.audioContext.createMediaStreamSource(stream);
            micSource.connect(this.analyser);
            
            this.micStream = stream;
            this.isMicActive = true;
            this.isStreaming = true;
            
            document.getElementById('btn-mic').classList.add('active');
            document.getElementById('current-file').textContent = '🎤 麦克风输入中...';
            
            this.startAudioStreaming();
            this.updateStatus('active');
            
        } catch (error) {
            console.error('Microphone error:', error);
            alert('无法访问麦克风: ' + error.message);
        }
    }
    
    stopMicrophone() {
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
            this.micStream = null;
        }
        this.isMicActive = false;
        this.isStreaming = false;
        document.getElementById('btn-mic').classList.remove('active');
        document.getElementById('current-file').textContent = '未选择文件';
        this.updateStatus('connected');
    }
    
    // ============ UI ============
    initUI() {
        // 播放控制
        document.getElementById('btn-play').addEventListener('click', () => this.play());
        document.getElementById('btn-prev').addEventListener('click', () => this.skip(-10));
        document.getElementById('btn-next').addEventListener('click', () => this.skip(10));
        
        // 进度条 - 苹果音乐风格丝滑体验
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressHandle = document.getElementById('progress-handle');
        
        let isDragging = false;
        let wasPlaying = false;
        let dragPercent = 0;

        const updateProgressVisual = (percent) => {
            progressBar.style.width = `${percent}%`;
            progressHandle.style.left = `${percent}%`;
        };

        const getPercentFromEvent = (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const x = e.clientX || (e.touches && e.touches[0].clientX);
            return Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
        };

        // 鼠标/触摸按下 - 暂停但记录状态
        const startDrag = (e) => {
            if (!this.audioBuffer) return;
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = true;
            wasPlaying = this.isPlaying;
            dragPercent = getPercentFromEvent(e);
            
            // 暂停播放
            if (this.isPlaying) {
                this.pause();
            }
            
            updateProgressVisual(dragPercent);
            const time = (dragPercent / 100) * this.audioBuffer.duration;
            document.getElementById('current-time').textContent = this.formatTime(time);
        };

        // 拖动中 - 实时更新视觉
        const doDrag = (e) => {
            if (!isDragging || !this.audioBuffer) return;
            e.preventDefault();
            
            dragPercent = getPercentFromEvent(e);
            updateProgressVisual(dragPercent);
            
            const time = (dragPercent / 100) * this.audioBuffer.duration;
            document.getElementById('current-time').textContent = this.formatTime(time);
        };

        // 松手 - 跳转并恢复播放
        const endDrag = () => {
            if (!isDragging || !this.audioBuffer) return;
            
            isDragging = false;
            const time = (dragPercent / 100) * this.audioBuffer.duration;
            
            // 跳转到目标位置
            this.pauseTime = Math.max(0, Math.min(time, this.audioBuffer.duration));
            
            // 更新进度条
            this.updateProgress();
            
            // 恢复播放状态 (force = true 强制播放)
            if (wasPlaying) {
                this.play(true);
            }
        };

        // 绑定事件
        progressContainer.addEventListener('mousedown', startDrag);
        progressContainer.addEventListener('touchstart', startDrag, { passive: false });

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('touchmove', doDrag, { passive: false });

        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
        
        // 音量
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            if (this.gainNode) {
                this.gainNode.gain.value = e.target.value / 100;
            }
        });
        
        // 麦克风
        document.getElementById('btn-mic').addEventListener('click', () => this.startMicrophone());
        
        // 文件选择
        document.getElementById('btn-file').addEventListener('click', () => {
            document.getElementById('audio-file').click();
        });
        
        document.getElementById('audio-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.loadAudioFile(file);
            }
        });
        
        // 参数滑块
        document.getElementById('particle-density').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('density-value').textContent = value;
            this.config.particleCount = value;
            this.sendConfig({ particleCount: value });
            this.recreateParticles();
        });
        
        document.getElementById('z-scale').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('z-value').textContent = value.toFixed(2);
            this.config.zScale = value;
            this.sendConfig({ z_scale: value });
        });
        
        document.getElementById('damping').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('damping-value').textContent = value.toFixed(2);
            this.config.damping = value;
            this.sendConfig({ damping: value });
        });
        
        document.getElementById('rotation-speed').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('rotation-value').textContent = value.toFixed(1);
            this.config.rotationSpeed = value * 0.001;
        });
    }
    
    sendConfig(config) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'update_config',
                config: config
            }));
        }
    }
    
    recreateParticles() {
        if (this.particleSystem) {
            this.scene.remove(this.particleSystem);
            this.particleSystem.geometry.dispose();
            this.particleSystem.material.dispose();
        }
        this.createParticles();
    }
    
    updatePlayButton() {
        const btn = document.getElementById('btn-play');
        btn.textContent = this.isPlaying ? '⏸' : '▶';
    }
    
    updateProgress() {
        if (!this.audioBuffer) return;
        
        const currentTime = this.isPlaying ? this.audioContext.currentTime - this.startTime : this.pauseTime;
        const progress = (currentTime / this.audioBuffer.duration) * 100;
        
        // 更新自定义进度条
        document.getElementById('progress-bar').style.width = `${progress}%`;
        document.getElementById('progress-handle').style.left = `${progress}%`;
        document.getElementById('current-time').textContent = this.formatTime(currentTime);
        document.getElementById('audio-time').textContent = 
            `${this.formatTime(currentTime)} / ${this.formatTime(this.audioBuffer.duration)}`;
    }
    
    updateStatus(status) {
        const dot = document.querySelector('.status-dot');
        const text = document.querySelector('.status-text');
        
        dot.classList.remove('connected', 'active');
        
        switch (status) {
            case 'connected':
                dot.classList.add('connected');
                text.textContent = '已连接';
                break;
            case 'active':
                dot.classList.add('active');
                text.textContent = '音频输入中';
                break;
            default:
                text.textContent = '等待连接';
        }
    }
    
    updateUIFromConfig() {
        document.getElementById('particle-density').value = this.config.particleCount;
        document.getElementById('density-value').textContent = this.config.particleCount;
        document.getElementById('z-scale').value = this.config.zScale;
        document.getElementById('z-value').textContent = this.config.zScale.toFixed(2);
        document.getElementById('damping').value = this.config.damping;
        document.getElementById('damping-value').textContent = this.config.damping.toFixed(2);
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // ============ 渲染循环 ============
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const time = performance.now() * 0.001;
        
        // 旋转
        if (this.particleSystem) {
            this.particleSystem.rotation.y += this.config.rotationSpeed;
        }
        if (this.surfaceMesh) {
            this.surfaceMesh.rotation.z += this.config.rotationSpeed;
        }
        
        // 相机轻微摆动
        this.camera.position.x = Math.sin(time * 0.2) * 0.1;
        this.camera.lookAt(0, 0, 0);
        
        this.renderer.render(this.scene, this.camera);
        
        // FPS
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsTime >= 1000) {
            document.getElementById('fps-display').textContent = `${this.frameCount} FPS`;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }
    }
    
    onResize() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChladniApp();
});
