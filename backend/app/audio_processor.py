import numpy as np
from typing import Dict, List, Tuple


class AudioProcessor:
    """AI-Enhanced 音频处理模块 (贾维斯听觉中枢)"""

    def __init__(self,
                 sample_rate: int = 44100,
                 fft_size: int = 2048,
                 hop_length: int = 512,
                 n_bands: int = 64):
        self.sample_rate = sample_rate
        self.fft_size = fft_size
        self.hop_length = hop_length
        self.n_bands = n_bands

        # 频段划分 (20Hz - 20kHz，非线性映射，偏重低频下潜)
        self.freq_bands = self._create_freq_bands()

        # 情感平滑记忆 (用于非对称平滑)
        self.smoothed_energy = np.zeros(self.n_bands)

        # 窗口函数
        self.window = np.hanning(fft_size)

    def _create_freq_bands(self) -> List[Tuple[float, float]]:
        """创建非线性频段划分，增强低频和人声的分辨率"""
        freqs = np.logspace(np.log10(20), np.log10(20000), self.n_bands + 1)
        return [(freqs[i], freqs[i + 1]) for i in range(self.n_bands)]

    def process(self, audio_chunk: np.ndarray) -> np.ndarray:
        """
        处理音频块，提取带有情感张力的频段振幅
        """
        if len(audio_chunk) < self.fft_size:
            padded = np.zeros(self.fft_size)
            padded[:len(audio_chunk)] = audio_chunk
            audio_chunk = padded

        # 应用窗口函数并进行FFT
        windowed = audio_chunk[:self.fft_size] * self.window
        fft = np.fft.rfft(windowed)
        magnitude = np.abs(fft)
        freqs = np.fft.rfftfreq(self.fft_size, 1 / self.sample_rate)

        # 提取各个频段的实时能量
        current_energies = np.zeros(self.n_bands)
        for i, (low, high) in enumerate(self.freq_bands):
            mask = (freqs >= low) & (freqs < high)
            if np.any(mask):
                current_energies[i] = np.sqrt(np.mean(magnitude[mask] ** 2))

        # 对数压缩，模拟人类听觉的非线性
        current_energies = np.log1p(current_energies)

        # ==========================================
        # 核心生物学优化：非对称情感平滑 (Fast Attack, Slow Release)
        # ==========================================
        # 音乐爆发时（Attack），系统瞬间反应；音乐安静时（Release），系统温柔回落
        attack_rate = 0.85  # 爆发敏感度 (0-1，越高越快)
        release_rate = 0.15  # 衰减柔和度 (0-1，越低越慢)

        # 找出当前能量比记忆能量高的部分（爆发点）
        attack_mask = current_energies > self.smoothed_energy

        # 对爆发点应用快速响应
        self.smoothed_energy[attack_mask] = (attack_rate * current_energies[attack_mask] +
                                             (1 - attack_rate) * self.smoothed_energy[attack_mask])
        # 对回落点应用缓慢衰减
        self.smoothed_energy[~attack_mask] = (release_rate * current_energies[~attack_mask] +
                                              (1 - release_rate) * self.smoothed_energy[~attack_mask])

        # 归一化到 0-1 输出给前端
        max_val = np.max(self.smoothed_energy) if np.max(self.smoothed_energy) > 0 else 1
        normalized = self.smoothed_energy / max_val

        return normalized