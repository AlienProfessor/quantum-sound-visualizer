import numpy as np
from typing import Dict, Tuple, List
import time


class ChladniPhysics:
    """
    AI-Enhanced 克拉尼图形物理引擎
    引入真实的克拉尼干涉方程与情感特征提取
    """

    def __init__(self,
                 grid_size: int = 100,
                 plate_size: float = 2.0,
                 n_particles: int = 8000):
        self.grid_size = grid_size
        self.plate_size = plate_size
        self.n_particles = n_particles

        # 创建网格
        x = np.linspace(-plate_size / 2, plate_size / 2, grid_size)
        y = np.linspace(-plate_size / 2, plate_size / 2, grid_size)
        self.X, self.Y = np.meshgrid(x, y)

        # 粒子位置 (3D)
        self.particles = self._init_particles()

        # 配置参数 (与前端生物流体力学配合)
        self.config = {
            "damping": 0.95,
            "particle_speed": 0.015,  # 稍微调快，前端有平滑阻尼
            "z_scale": 0.35,
            "rotation_speed": 0.001
        }

        # 情感与模式状态
        self.current_n = 2.0
        self.current_m = 2.0
        self.chladni_sign = 1.0  # 决定是相加还是相减，产生截然不同的拓扑图案
        self.last_beat_time = 0

    def _init_particles(self) -> np.ndarray:
        """初始化粒子位置"""
        particles = np.random.rand(self.n_particles, 3)
        particles[:, 0] = (particles[:, 0] - 0.5) * self.plate_size
        particles[:, 1] = (particles[:, 1] - 0.5) * self.plate_size
        particles[:, 2] = 0
        return particles.astype(np.float32)

    def update_config(self, config: Dict):
        for key, value in config.items():
            if key in self.config:
                self.config[key] = value

    def update_particle_count(self, count: int):
        self.n_particles = count
        self.particles = self._init_particles()

    def map_fft_to_modes(self, fft_data: np.ndarray) -> Dict:
        """
        AI 情感大脑：将音频频段映射到真实的克拉尼干涉模式
        """
        n_bands = len(fft_data)

        # 提取频段特征 (假设 64 个频段)
        bass = np.mean(fft_data[:8])  # 0-8: 低频轰炸 (底鼓/贝斯)
        mid = np.mean(fft_data[8:32])  # 8-32: 中频旋律 (人声/吉他)
        treble = np.mean(fft_data[32:])  # 32+: 高频细节 (镲片/合成器)

        # 1. 结构突变检测 (Beat Detection)
        # 如果低频能量超过阈值，且距离上次跳动超过一定时间，触发模式翻转
        current_time = time.time()
        if bass > 0.65 and (current_time - self.last_beat_time) > 0.5:
            self.chladni_sign *= -1  # 翻转符号，瞬间改变图形结构（如从十字变成圈）
            self.last_beat_time = current_time

        # 2. 计算目标模式 (Target Modes)
        # 悲伤/平缓 -> 低 m,n；激昂 -> 高 m,n
        target_n = 1.0 + treble * 6.0  # 高频带来细密的纹理
        target_m = 1.0 + mid * 5.0  # 中频带来整体的区块分割

        # 3. 有机平滑过渡 (让图形是“变形”的而不是“闪烁”的)
        transition_speed = 0.08 + (bass * 0.1)  # 节奏越强，变形越快
        self.current_n += (target_n - self.current_n) * transition_speed
        self.current_m += (target_m - self.current_m) * transition_speed

        # 振幅基于整体能量，放大视觉冲击
        amplitude = np.mean(fft_data) * 2.5

        return {
            "n": self.current_n,
            "m": self.current_m,
            "sign": self.chladni_sign,
            "amplitude": float(amplitude)
        }

    def calculate_chladni_pattern(self, n: float, m: float, sign: float, amplitude: float) -> np.ndarray:
        """
        核心：真实的二维克拉尼驻波干涉方程
        Chladni(x,y) = sin(n*x)*sin(m*y) ± sin(m*x)*sin(n*y)
        """
        L = self.plate_size
        pi_x = np.pi * (self.X + L / 2) / L
        pi_y = np.pi * (self.Y + L / 2) / L

        # 真实克拉尼干涉公式
        term1 = np.sin(n * pi_x) * np.sin(m * pi_y)
        term2 = np.sin(m * pi_x) * np.sin(n * pi_y)

        z = amplitude * (term1 + sign * term2)

        # 边缘平滑衰减，让图形看起来像悬浮的岛屿
        r = np.sqrt(self.X ** 2 + self.Y ** 2)
        edge_mask = np.clip(1.0 - (r / (L / 2)) ** 2, 0, 1)
        z = z * edge_mask

        return z

    def calculate_particles(self, modes: Dict) -> np.ndarray:
        """
        计算粒子目标：粒子像水流一样滑向驻波的“波节线”（Nodes）
        """
        n, m = modes["n"], modes["m"]
        sign, amplitude = modes["sign"], modes["amplitude"]

        # 计算当前物理场
        z_field = self.calculate_chladni_pattern(n, m, sign, amplitude)

        # 获取粒子坐标并映射到网格
        p_x = self.particles[:, 0]
        p_y = self.particles[:, 1]

        grid_x = np.clip((p_x + self.plate_size / 2) / self.plate_size * (self.grid_size - 1), 0,
                         self.grid_size - 1).astype(int)
        grid_y = np.clip((p_y + self.plate_size / 2) / self.plate_size * (self.grid_size - 1), 0,
                         self.grid_size - 1).astype(int)

        # 获取粒子处的振幅
        particle_amplitude = z_field[grid_y, grid_x]

        # 为了让粒子向振幅为 0 的地方移动（波节），我们对 Z的绝对值 求梯度
        z_abs = np.abs(z_field)
        dz_dx = np.gradient(z_abs, axis=1)[grid_y, grid_x]
        dz_dy = np.gradient(z_abs, axis=0)[grid_y, grid_x]

        # 移动粒子（梯度下降法找波节）
        speed = self.config["particle_speed"]
        self.particles[:, 0] -= dz_dx * speed
        self.particles[:, 1] -= dz_dy * speed

        # 更新 Z 轴（高度）
        self.particles[:, 2] = particle_amplitude * self.config["z_scale"]

        # 情感温度扰动：音量越大，粒子越“兴奋”，防止聚成一条死板的死线
        temperature = amplitude * 0.008
        self.particles[:, 0] += np.random.randn(self.n_particles) * temperature
        self.particles[:, 1] += np.random.randn(self.n_particles) * temperature

        # 边界约束
        limit = self.plate_size / 2
        self.particles[:, 0] = np.clip(self.particles[:, 0], -limit, limit)
        self.particles[:, 1] = np.clip(self.particles[:, 1], -limit, limit)

        return self.particles

    def get_surface_mesh(self, modes: Dict) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        z = self.calculate_chladni_pattern(modes["n"], modes["m"], modes["sign"], modes["amplitude"])
        z = z * self.config["z_scale"]
        return self.X, self.Y, z