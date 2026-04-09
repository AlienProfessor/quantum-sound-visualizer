/**
 * Audio Client
 * WebSocket 连接和音频处理
 */

class AudioClient {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.isStreaming = false;
        this.stream = null;
        
        this.onVisualizationData = null;
        this.onConnectionChange = null;
        
        // 性能监控
        this.latencyHistory = [];
        this.frameCount = 0;
        this.lastFpsTime = performance.now();
    }
    
    async connect() {
        const wsUrl = `ws://${window.location.host}/ws`;
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('connected');
                if (this.onConnectionChange) this.onConnectionChange(true);
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.updateConnectionStatus('disconnected');
                if (this.onConnectionChange) this.onConnectionChange(false);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
        });
    }
    
    handleMessage(data) {
        if (data.type === 'visualization') {
            // 计算延迟
            const latency = performance.now() - (data.timestamp * 1000);
            this.latencyHistory.push(latency);
            if (this.latencyHistory.length > 30) this.latencyHistory.shift();
            
            // 更新延迟显示
            const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
            document.getElementById('latency').textContent = `${Math.round(avgLatency)} ms`;
            
            // 回调可视化数据
            if (this.onVisualizationData) {
                this.onVisualizationData(data);
            }
            
            // 更新 FPS
            this.frameCount++;
            const now = performance.now();
            if (now - this.lastFpsTime >= 1000) {
                document.getElementById('fps-display').textContent = `${this.frameCount} FPS`;
                this.frameCount = 0;
                this.lastFpsTime = now;
            }
        }
    }
    
    async initAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 44100,
            latencyHint: 'interactive'
        });
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
    }
    
    async startMicrophone() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            await this.initAudioContext();
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);
            
            this.isStreaming = true;
            this.startStreaming();
            
            this.updateConnectionStatus('active');
            return true;
        } catch (error) {
            console.error('Microphone error:', error);
            alert('无法访问麦克风: ' + error.message);
            return false;
        }
    }
    
    async startFile(file) {
        try {
            await this.initAudioContext();
            
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.source = this.audioContext.createBufferSource();
            this.source.buffer = audioBuffer;
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            this.source.start();
            
            this.isStreaming = true;
            this.startStreaming();
            
            this.updateConnectionStatus('active');
            
            // 播放结束后停止
            this.source.onended = () => {
                this.stop();
            };
            
            return true;
        } catch (error) {
            console.error('File playback error:', error);
            alert('无法播放文件: ' + error.message);
            return false;
        }
    }
    
    startStreaming() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        
        const sendAudioData = () => {
            if (!this.isStreaming) return;
            
            this.analyser.getFloatTimeDomainData(dataArray);
            
            // 降采样以减少传输数据量
            const downsampled = this.downsample(dataArray, 4);
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'audio_chunk',
                    audio: Array.from(downsampled),
                    timestamp: performance.now()
                }));
            }
            
            requestAnimationFrame(sendAudioData);
        };
        
        sendAudioData();
    }
    
    downsample(data, factor) {
        const result = new Float32Array(Math.floor(data.length / factor));
        for (let i = 0; i < result.length; i++) {
            result[i] = data[i * factor];
        }
        return result;
    }
    
    stop() {
        this.isStreaming = false;
        
        if (this.source) {
            try {
                this.source.stop();
                this.source.disconnect();
            } catch (e) {}
            this.source = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.updateConnectionStatus('connected');
    }
    
    updateConnectionStatus(status) {
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
    
    sendConfig(config) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'config',
                config: config
            }));
        }
    }
}

// 导出
window.AudioClient = AudioClient;
